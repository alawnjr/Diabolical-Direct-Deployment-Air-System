from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GRID_SIZE = 200          # 200×200 mile map
MAX_TICKS = 60           # 1-hour mission in 1-minute ticks
DRONE_SPEED = 5.0        # miles per tick  (300 mi / 60 ticks)
MAX_FLIGHT = 300.0       # miles per drone over full mission

RADAR_SIGHT = 100.0      # miles — triggers a ping if LUCAS enters this radius
RADAR_PING_INTERVAL = 30 # ticks — periodic blind ping regardless of LUCAS proximity
RADAR_VALUE = 4

MISSILE_FIRE_RANGE = 25.0
MISSILE_VALUE = 3

GAS_VALUE = 1

DESTROY_THRESHOLD = 3.0  # miles — distance at which a drone "hits" a target

NUM_RADARS = 6
NUM_LAUNCHERS = 6
NUM_GAS = 4
DEFAULT_BAIT = 10
DEFAULT_RECV = 10


# ---------------------------------------------------------------------------
# Entity dataclasses
# ---------------------------------------------------------------------------

@dataclass
class Radar:
    id: str
    x: float
    y: float
    revealed: bool = False
    destroyed: bool = False


@dataclass
class MissileLauncher:
    id: str
    x: float
    y: float
    revealed: bool = False
    fired: bool = False


@dataclass
class GasTarget:
    id: str
    x: float
    y: float
    revealed: bool = False
    destroyed: bool = False


@dataclass
class LucasDrone:
    id: str
    drone_type: str  # "bait" | "radar_receiver"
    x: float
    y: float
    alive: bool = True
    miles_flown: float = 0.0


@dataclass
class SimState:
    tick: int = 0
    score: int = 0
    complete: bool = False
    radars: list[Radar] = field(default_factory=list)
    missile_launchers: list[MissileLauncher] = field(default_factory=list)
    gas_targets: list[GasTarget] = field(default_factory=list)
    lucas_drones: list[LucasDrone] = field(default_factory=list)
    events: list[dict] = field(default_factory=list)
    # Updated whenever a radar pings; radar_receiver drones read this to navigate.
    revealed_radar_positions: dict[str, tuple[float, float]] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def _dist(x1: float, y1: float, x2: float, y2: float) -> float:
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def _random_positions(n: int, margin: float = 10.0, min_sep: float = 20.0) -> list[tuple[float, float]]:
    """Generate n positions on the grid with a minimum separation between each pair."""
    positions: list[tuple[float, float]] = []
    for _ in range(100_000):
        if len(positions) == n:
            break
        x = random.uniform(margin, GRID_SIZE - margin)
        y = random.uniform(margin, GRID_SIZE - margin)
        if all(_dist(x, y, px, py) >= min_sep for px, py in positions):
            positions.append((x, y))
    return positions


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def initialize_sim(num_bait: int = DEFAULT_BAIT, num_receiver: int = DEFAULT_RECV) -> SimState:
    """
    Create and return a fresh SimState.

    Adversary assets are placed randomly with at least 20 miles separation.
    All LUCAS drones launch from (0, 0) — the SW corner.
    Bait drones know all gas-target positions (pre-mission intelligence);
    that information is embedded in their targeting logic, not in the public API.
    """
    state = SimState()

    all_pos = _random_positions(NUM_RADARS + NUM_LAUNCHERS + NUM_GAS)
    r_pos   = all_pos[:NUM_RADARS]
    ml_pos  = all_pos[NUM_RADARS : NUM_RADARS + NUM_LAUNCHERS]
    g_pos   = all_pos[NUM_RADARS + NUM_LAUNCHERS :]

    state.radars           = [Radar(id=f"r{i+1}",  x=x, y=y) for i, (x, y) in enumerate(r_pos)]
    state.missile_launchers= [MissileLauncher(id=f"ml{i+1}", x=x, y=y) for i, (x, y) in enumerate(ml_pos)]
    state.gas_targets      = [GasTarget(id=f"gt{i+1}", x=x, y=y) for i, (x, y) in enumerate(g_pos)]

    drones: list[LucasDrone] = []
    for i in range(num_bait):
        drones.append(LucasDrone(id=f"bait_{i+1}", drone_type="bait", x=0.0, y=0.0))
    for i in range(num_receiver):
        drones.append(LucasDrone(id=f"recv_{i+1}", drone_type="radar_receiver", x=0.0, y=0.0))
    state.lucas_drones = drones

    return state


# ---------------------------------------------------------------------------
# Drone AI
# ---------------------------------------------------------------------------

def _drone_target(drone: LucasDrone, state: SimState) -> Optional[tuple[float, float]]:
    """
    Return the (x, y) the drone should move toward this tick.

    Bait:
      1. Nearest revealed (not yet destroyed) radar  — keeps triggering pings
      2. Nearest alive gas target  — pre-mission intel, so positions are known
      3. Map centre as fallback

    Radar-receiver:
      1. Nearest revealed (not yet destroyed) radar  — navigate to destroy it
      2. Map centre as fallback (patrol while waiting for pings)
    """
    if drone.drone_type == "bait":
        revealed = [r for r in state.radars if r.revealed and not r.destroyed]
        if revealed:
            best = min(revealed, key=lambda r: _dist(drone.x, drone.y, r.x, r.y))
            return best.x, best.y

        alive_gas = [t for t in state.gas_targets if not t.destroyed]
        if alive_gas:
            best = min(alive_gas, key=lambda t: _dist(drone.x, drone.y, t.x, t.y))
            return best.x, best.y

        return GRID_SIZE / 2, GRID_SIZE / 2

    # radar_receiver
    alive_radar_ids = {r.id for r in state.radars if not r.destroyed}
    candidates = [
        (rid, pos)
        for rid, pos in state.revealed_radar_positions.items()
        if rid in alive_radar_ids
    ]
    if candidates:
        best = min(candidates, key=lambda rp: _dist(drone.x, drone.y, rp[1][0], rp[1][1]))
        return best[1]

    return GRID_SIZE / 2, GRID_SIZE / 2


def _move_drone(drone: LucasDrone, tx: float, ty: float) -> None:
    remaining = MAX_FLIGHT - drone.miles_flown
    if remaining <= 0:
        return
    dx, dy = tx - drone.x, ty - drone.y
    d = math.sqrt(dx * dx + dy * dy)
    if d < 1e-6:
        return
    step = min(DRONE_SPEED, d, remaining)
    ratio = step / d
    drone.x = max(0.0, min(float(GRID_SIZE - 1), drone.x + dx * ratio))
    drone.y = max(0.0, min(float(GRID_SIZE - 1), drone.y + dy * ratio))
    drone.miles_flown += step


# ---------------------------------------------------------------------------
# Core simulation tick
# ---------------------------------------------------------------------------

def advance_tick(state: SimState) -> list[dict]:
    """
    Advance the simulation by exactly one minute.

    Returns the list of events that fired this tick (also appended to state.events).

    Tick order:
      1. Move all alive LUCAS drones toward their current target
      2. Radar sight-range check → ping (reveals radar to all receiver drones)
      3. Radar periodic ping (every 30 ticks, regardless of LUCAS proximity)
      4. Missile launchers fire at nearest LUCAS in range (one salvo lifetime)
      5. Surviving drones that reached targets → destroy target, add score
      6. Check completion (tick ≥ 60)
    """
    if state.complete:
        return []

    state.tick += 1
    tick_events: list[dict] = []

    alive_drones    = [d for d in state.lucas_drones if d.alive]
    alive_radars    = [r for r in state.radars if not r.destroyed]
    unfired         = [ml for ml in state.missile_launchers if not ml.fired]
    alive_gas       = [t for t in state.gas_targets if not t.destroyed]

    # --- 1. Move drones ---
    for drone in alive_drones:
        target = _drone_target(drone, state)
        if target:
            _move_drone(drone, *target)

    # --- 2 & 3. Radar pings ---
    alive_drones_post_move = [d for d in state.lucas_drones if d.alive]
    periodic = (state.tick % RADAR_PING_INTERVAL == 0)
    for radar in alive_radars:
        triggered = any(
            _dist(radar.x, radar.y, d.x, d.y) <= RADAR_SIGHT
            for d in alive_drones_post_move
        )
        if periodic or triggered:
            radar.revealed = True
            state.revealed_radar_positions[radar.id] = (radar.x, radar.y)
            ev: dict = {
                "tick": state.tick,
                "type": "radar_ping",
                "radar_id": radar.id,
                "x": round(radar.x, 2),
                "y": round(radar.y, 2),
            }
            tick_events.append(ev)
            state.events.append(ev)

    # --- 4. Missile launches ---
    currently_alive = [d for d in state.lucas_drones if d.alive]
    for launcher in unfired:
        in_range = [
            d for d in currently_alive
            if _dist(launcher.x, launcher.y, d.x, d.y) <= MISSILE_FIRE_RANGE
        ]
        if not in_range:
            continue
        victim = min(in_range, key=lambda d: _dist(launcher.x, launcher.y, d.x, d.y))
        victim.alive = False
        launcher.fired = True
        launcher.revealed = True
        ev = {
            "tick": state.tick,
            "type": "missile_fired",
            "launcher_id": launcher.id,
            "target_drone_id": victim.id,
            "launcher_x": round(launcher.x, 2),
            "launcher_y": round(launcher.y, 2),
        }
        tick_events.append(ev)
        state.events.append(ev)
        currently_alive = [d for d in currently_alive if d.alive]

    # --- 5. Destructions (surviving drones reach targets) ---
    surviving = [d for d in state.lucas_drones if d.alive]
    for drone in surviving:
        if drone.drone_type == "radar_receiver":
            for radar in alive_radars:
                if radar.destroyed:
                    continue
                if _dist(drone.x, drone.y, radar.x, radar.y) <= DESTROY_THRESHOLD:
                    radar.destroyed = True
                    radar.revealed = True
                    state.score += RADAR_VALUE
                    ev = {
                        "tick": state.tick,
                        "type": "radar_destroyed",
                        "radar_id": radar.id,
                        "drone_id": drone.id,
                        "score_gained": RADAR_VALUE,
                        "x": round(radar.x, 2),
                        "y": round(radar.y, 2),
                    }
                    tick_events.append(ev)
                    state.events.append(ev)

        for gas in alive_gas:
            if gas.destroyed:
                continue
            if _dist(drone.x, drone.y, gas.x, gas.y) <= DESTROY_THRESHOLD:
                gas.destroyed = True
                gas.revealed = True
                state.score += GAS_VALUE
                ev = {
                    "tick": state.tick,
                    "type": "gas_target_destroyed",
                    "target_id": gas.id,
                    "drone_id": drone.id,
                    "score_gained": GAS_VALUE,
                    "x": round(gas.x, 2),
                    "y": round(gas.y, 2),
                }
                tick_events.append(ev)
                state.events.append(ev)

    # --- 6. Completion check ---
    if state.tick >= MAX_TICKS:
        state.complete = True

    return tick_events


def run_to_completion(state: SimState) -> None:
    """Advance the simulation until tick 60."""
    while not state.complete:
        advance_tick(state)


# ---------------------------------------------------------------------------
# Public state serialisation
# ---------------------------------------------------------------------------

def get_public_state(state: SimState) -> dict[str, Any]:
    """
    Serialise SimState for API consumers.

    Adversary entities (radars, missile_launchers, gas_targets) only include
    coordinates when revealed=True.  LUCAS drones are always fully visible.

    Entity value fields are included so the frontend can display a score legend
    without hardcoding the point values.
    """

    def radar_view(r: Radar) -> dict:
        d: dict = {"id": r.id, "revealed": r.revealed, "destroyed": r.destroyed, "value": RADAR_VALUE}
        if r.revealed:
            d["x"] = round(r.x, 2)
            d["y"] = round(r.y, 2)
        return d

    def launcher_view(ml: MissileLauncher) -> dict:
        d: dict = {"id": ml.id, "revealed": ml.revealed, "fired": ml.fired, "value": MISSILE_VALUE}
        if ml.revealed:
            d["x"] = round(ml.x, 2)
            d["y"] = round(ml.y, 2)
        return d

    def gas_view(t: GasTarget) -> dict:
        d: dict = {"id": t.id, "revealed": t.revealed, "destroyed": t.destroyed, "value": GAS_VALUE}
        if t.revealed:
            d["x"] = round(t.x, 2)
            d["y"] = round(t.y, 2)
        return d

    def drone_view(d: LucasDrone) -> dict:
        return {
            "id": d.id,
            "type": d.drone_type,
            "x": round(d.x, 2),
            "y": round(d.y, 2),
            "alive": d.alive,
            "miles_flown": round(d.miles_flown, 2),
        }

    return {
        "tick": state.tick,
        "score": state.score,
        "complete": state.complete,
        "drones_alive": sum(1 for d in state.lucas_drones if d.alive),
        "drones_total": len(state.lucas_drones),
        "entities": {
            "radars": [radar_view(r) for r in state.radars],
            "missile_launchers": [launcher_view(ml) for ml in state.missile_launchers],
            "gas_targets": [gas_view(t) for t in state.gas_targets],
            "lucas_drones": [drone_view(d) for d in state.lucas_drones],
        },
        # Capped at 100 most-recent events to keep payload size sane.
        "events": state.events[-100:],
    }


# ---------------------------------------------------------------------------
# Legacy one-shot runner (called by POST /api/simulate for frontend compat)
# ---------------------------------------------------------------------------

def run_simulation(config: dict[str, Any]) -> dict[str, Any]:
    """
    Start a fresh simulation and run it for up to `steps` ticks (max 60),
    returning the full per-tick history.

    This function signature is preserved for backward-compatibility with the
    existing /api/simulate endpoint.

    config keys (all optional):
      steps       int  number of ticks to run    (default 10, max 60)
      num_bait    int  bait drone count           (default 10)
      num_receiver int radar-receiver drone count (default 10)

    Returns:
      { "steps": int, "results": [{ "step": int, "state": <SimStateResponse> }] }
    """
    steps        = min(int(config.get("steps", 10)), MAX_TICKS)
    num_bait     = int(config.get("num_bait", DEFAULT_BAIT))
    num_receiver = int(config.get("num_receiver", DEFAULT_RECV))

    state   = initialize_sim(num_bait, num_receiver)
    results = []

    for _ in range(steps):
        advance_tick(state)
        results.append({"step": state.tick, "state": get_public_state(state)})

    return {"steps": steps, "results": results}
