#!/usr/bin/env python3
"""
Run all 12 × 11 = 132 attack × defense matchups, N_RUNS each, and emit
frontend/src/lib/analytics-data.ts with the aggregated results.
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
from typing import Any

# Make sure we can import simulation from this directory
sys.path.insert(0, os.path.dirname(__file__))
from simulation import (
    VALID_ALGORITHMS,
    VALID_DEFENSE_ALGORITHMS,
    RADAR_VALUE,
    MISSILE_VALUE,
    GAS_VALUE,
    DEFAULT_NUM_RADARS,
    DEFAULT_NUM_LAUNCHERS,
    DEFAULT_NUM_GAS,
    DEFAULT_BAIT,
    DEFAULT_RECV,
    DEFAULT_CAMERA,
    initialize_sim,
    advance_tick,
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

N_RUNS = 25          # runs per (attack, defense) pair — enough to stabilise means
MAX_RETRIES = 20     # per run, retries on map-gen failure

NUM_BAIT     = DEFAULT_BAIT       # 10
NUM_RECV     = DEFAULT_RECV       # 10
NUM_CAMERA   = DEFAULT_CAMERA     # 4
NUM_RADARS   = DEFAULT_NUM_RADARS     # 6
NUM_LAUNCH   = DEFAULT_NUM_LAUNCHERS  # 6
NUM_GAS      = DEFAULT_NUM_GAS        # 4
RADAR_SIGHT  = 50.0
SAM_RANGE    = 25.0

MAX_POSSIBLE_SCORE = (NUM_RADARS * RADAR_VALUE
                      + NUM_LAUNCH * MISSILE_VALUE
                      + NUM_GAS * GAS_VALUE)
TOTAL_DRONES = NUM_BAIT + NUM_RECV + NUM_CAMERA

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_one(attack: str, defense: str) -> dict[str, Any] | None:
    """Run a single simulation to completion; return extracted stats or None on failure."""
    for _ in range(MAX_RETRIES):
        try:
            state = initialize_sim(
                num_bait=NUM_BAIT,
                num_receiver=NUM_RECV,
                radar_sight=RADAR_SIGHT,
                missile_fire_range=SAM_RANGE,
                num_radars=NUM_RADARS,
                num_launchers=NUM_LAUNCH,
                num_gas=NUM_GAS,
                num_camera=NUM_CAMERA,
                algorithm=attack,
                defense_algorithm=defense,
            )
        except ValueError:
            continue  # map-gen failure, retry

        while not state.complete:
            advance_tick(state)

        # Collect stats
        radars_destroyed = sum(1 for r in state.radars if r.destroyed)
        launchers_destroyed = sum(1 for ml in state.missile_launchers if ml.destroyed)
        gas_destroyed = sum(1 for t in state.gas_targets if t.destroyed)
        drones_lost = sum(1 for d in state.lucas_drones if not d.alive)

        # First kill tick — first tick where any target was destroyed
        first_kill_tick: float = float("nan")
        for ev in state.events:
            if isinstance(ev, dict):
                etype = ev.get("type", "")
            else:
                etype = getattr(ev, "type", "")
            if etype in ("radar_destroyed", "launcher_destroyed", "gas_target_destroyed"):
                if isinstance(ev, dict):
                    t_val = ev.get("tick", float("nan"))
                else:
                    t_val = getattr(ev, "tick", float("nan"))
                first_kill_tick = float(t_val)
                break

        return {
            "score": state.score,
            "radars_destroyed": radars_destroyed,
            "launchers_destroyed": launchers_destroyed,
            "gas_destroyed": gas_destroyed,
            "drones_lost": drones_lost,
            "first_kill_tick": first_kill_tick,
        }
    return None


def _mean(vals: list[float]) -> float:
    return sum(vals) / len(vals) if vals else 0.0


def _std(vals: list[float]) -> float:
    if len(vals) < 2:
        return 0.0
    m = _mean(vals)
    return math.sqrt(sum((v - m) ** 2 for v in vals) / (len(vals) - 1))


def _nanmean(vals: list[float]) -> float:
    good = [v for v in vals if not math.isnan(v)]
    return _mean(good) if good else float("nan")


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    total_combos = len(VALID_ALGORITHMS) * len(VALID_DEFENSE_ALGORITHMS)
    print(f"Running {total_combos} matchups × {N_RUNS} runs = {total_combos * N_RUNS} simulations")
    print(f"MAX_POSSIBLE_SCORE = {MAX_POSSIBLE_SCORE}")

    matchups: list[dict[str, Any]] = []
    combo_idx = 0
    t_start = time.time()

    for attack in VALID_ALGORITHMS:
        for defense in VALID_DEFENSE_ALGORITHMS:
            combo_idx += 1
            scores: list[float] = []
            radars_d: list[float] = []
            launchers_d: list[float] = []
            gas_d: list[float] = []
            drones_l: list[float] = []
            first_kills: list[float] = []
            failed = 0

            for _ in range(N_RUNS):
                result = _run_one(attack, defense)
                if result is None:
                    failed += 1
                    continue
                scores.append(result["score"])
                radars_d.append(result["radars_destroyed"])
                launchers_d.append(result["launchers_destroyed"])
                gas_d.append(result["gas_destroyed"])
                drones_l.append(result["drones_lost"])
                if not math.isnan(result["first_kill_tick"]):
                    first_kills.append(result["first_kill_tick"])

            elapsed = time.time() - t_start
            avg_score = _mean(scores)
            avg_destr = avg_score / MAX_POSSIBLE_SCORE * 100.0 if MAX_POSSIBLE_SCORE else 0.0
            avg_surv = (_mean([TOTAL_DRONES - d for d in drones_l]) / TOTAL_DRONES * 100.0
                        if TOTAL_DRONES else 0.0)
            eff = avg_score / (_mean(drones_l) + 1e-6)  # score per drone lost (avoid /0)

            entry: dict[str, Any] = {
                "attack": attack,
                "defense": defense,
                "n_runs": len(scores),
                "n_failed": failed,
                "avg_score": round(avg_score, 3),
                "std_score": round(_std(scores), 3),
                "avg_destruction_rate": round(avg_destr, 2),
                "avg_radars_destroyed": round(_mean(radars_d), 3),
                "avg_launchers_destroyed": round(_mean(launchers_d), 3),
                "avg_gas_destroyed": round(_mean(gas_d), 3),
                "avg_drones_lost": round(_mean(drones_l), 3),
                "avg_drone_survival_rate": round(avg_surv, 2),
                "avg_first_kill_tick": round(_nanmean(first_kills), 2) if first_kills else None,
                "efficiency": round(eff, 4),
            }
            matchups.append(entry)

            pct = combo_idx / total_combos * 100
            eta = elapsed / combo_idx * (total_combos - combo_idx)
            print(f"  [{combo_idx:3d}/{total_combos}] {attack:25s} vs {defense:25s} "
                  f"avg={avg_score:5.2f} ({avg_destr:5.1f}%)  ETA {eta:.0f}s")

    print(f"\nDone in {time.time() - t_start:.1f}s")

    # Per-attack summary
    atk_stats: dict[str, dict[str, Any]] = {}
    for atk in VALID_ALGORITHMS:
        rows = [m for m in matchups if m["attack"] == atk]
        atk_stats[atk] = {
            "avg_score": round(_mean([m["avg_score"] for m in rows]), 3),
            "avg_destruction_rate": round(_mean([m["avg_destruction_rate"] for m in rows]), 2),
            "avg_drones_lost": round(_mean([m["avg_drones_lost"] for m in rows]), 3),
            "avg_drone_survival_rate": round(_mean([m["avg_drone_survival_rate"] for m in rows]), 2),
            "avg_efficiency": round(_mean([m["efficiency"] for m in rows]), 4),
            "best_defense": max(rows, key=lambda m: m["avg_score"])["defense"],
            "worst_defense": min(rows, key=lambda m: m["avg_score"])["defense"],
        }

    # Per-defense summary
    def_stats: dict[str, dict[str, Any]] = {}
    for dfn in VALID_DEFENSE_ALGORITHMS:
        rows = [m for m in matchups if m["defense"] == dfn]
        def_stats[dfn] = {
            "avg_score_allowed": round(_mean([m["avg_score"] for m in rows]), 3),
            "avg_destruction_rate_allowed": round(_mean([m["avg_destruction_rate"] for m in rows]), 2),
            "best_attack_against": max(rows, key=lambda m: m["avg_score"])["attack"],
            "worst_attack_against": min(rows, key=lambda m: m["avg_score"])["attack"],
            "best_score_allowed": round(min(m["avg_score"] for m in rows), 3),
            "worst_score_allowed": round(max(m["avg_score"] for m in rows), 3),
        }

    # Optimal counter table: for each defense, best attack
    optimal_counters: list[dict[str, Any]] = []
    for dfn in VALID_DEFENSE_ALGORITHMS:
        rows = [m for m in matchups if m["defense"] == dfn]
        best = max(rows, key=lambda m: m["avg_score"])
        optimal_counters.append({
            "defense": dfn,
            "best_attack": best["attack"],
            "avg_score": best["avg_score"],
            "avg_destruction_rate": best["avg_destruction_rate"],
        })

    # ---------------------------------------------------------------------------
    # Emit TypeScript
    # ---------------------------------------------------------------------------

    out_path = os.path.join(
        os.path.dirname(__file__), "..", "frontend", "src", "lib", "analytics-data.ts"
    )
    out_path = os.path.normpath(out_path)

    ts = _build_ts(matchups, atk_stats, def_stats, optimal_counters)
    with open(out_path, "w") as f:
        f.write(ts)
    print(f"Wrote {out_path}  ({os.path.getsize(out_path):,} bytes)")


def _build_ts(matchups, atk_stats, def_stats, optimal_counters) -> str:
    def jd(obj: Any) -> str:
        return json.dumps(obj, indent=2)

    lines: list[str] = [
        "// AUTO-GENERATED by simulation/run_analytics.py — do not edit manually",
        "",
        f"export const MAX_POSSIBLE_SCORE = {MAX_POSSIBLE_SCORE};",
        f"export const TOTAL_DRONES = {TOTAL_DRONES};",
        f"export const SIM_RUNS_PER_PAIR = {N_RUNS};",
        "",
        f"export const ATTACK_ALGORITHMS = {jd(VALID_ALGORITHMS)} as const;",
        "",
        f"export const DEFENSE_ALGORITHMS = {jd(VALID_DEFENSE_ALGORITHMS)} as const;",
        "",
        "export type AttackAlgorithm = typeof ATTACK_ALGORITHMS[number];",
        "export type DefenseAlgorithm = typeof DEFENSE_ALGORITHMS[number];",
        "",
        "export interface MatchupResult {",
        "  attack: AttackAlgorithm;",
        "  defense: DefenseAlgorithm;",
        "  n_runs: number;",
        "  n_failed: number;",
        "  avg_score: number;",
        "  std_score: number;",
        "  avg_destruction_rate: number;",
        "  avg_radars_destroyed: number;",
        "  avg_launchers_destroyed: number;",
        "  avg_gas_destroyed: number;",
        "  avg_drones_lost: number;",
        "  avg_drone_survival_rate: number;",
        "  avg_first_kill_tick: number | null;",
        "  efficiency: number;",
        "}",
        "",
        "export interface AttackStats {",
        "  avg_score: number;",
        "  avg_destruction_rate: number;",
        "  avg_drones_lost: number;",
        "  avg_drone_survival_rate: number;",
        "  avg_efficiency: number;",
        "  best_defense: DefenseAlgorithm;",
        "  worst_defense: DefenseAlgorithm;",
        "}",
        "",
        "export interface DefenseStats {",
        "  avg_score_allowed: number;",
        "  avg_destruction_rate_allowed: number;",
        "  best_attack_against: AttackAlgorithm;",
        "  worst_attack_against: AttackAlgorithm;",
        "  best_score_allowed: number;",
        "  worst_score_allowed: number;",
        "}",
        "",
        "export interface OptimalCounter {",
        "  defense: DefenseAlgorithm;",
        "  best_attack: AttackAlgorithm;",
        "  avg_score: number;",
        "  avg_destruction_rate: number;",
        "}",
        "",
        f"export const MATCHUPS: MatchupResult[] = {jd(matchups)};",
        "",
        f"export const ATTACK_STATS: Record<AttackAlgorithm, AttackStats> = {jd(atk_stats)};",
        "",
        f"export const DEFENSE_STATS: Record<DefenseAlgorithm, DefenseStats> = {jd(def_stats)};",
        "",
        f"export const OPTIMAL_COUNTERS: OptimalCounter[] = {jd(optimal_counters)};",
        "",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    main()
