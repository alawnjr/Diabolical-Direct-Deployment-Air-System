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
DRONE_SPEED = 5.0        # miles/tick for radar_receiver drones (~300 mph)
BAIT_DRONE_SPEED = 200.0 / 60.0  # miles/tick for bait drones (~3.33 mi/tick = 200 mph)
MAX_FLIGHT = 300.0       # miles per drone over full mission

RADAR_SIGHT = 100.0      # miles — default radar detection radius
RADAR_PING_INTERVAL = 30 # ticks — periodic blind ping regardless of LUCAS proximity
RADAR_WANDER = 5.0       # radars drift up to 5 miles from initial pos each tick (10×10 box)
RADAR_VALUE = 4

SAM_MISSILES = 2             # starting missiles per launcher
MISSILE_HIT_RATE = 0.99      # probability a fired missile kills its target
MISSILE_FIRE_RANGE = 25.0    # miles — default SAM engagement radius from launcher
MISSILE_VALUE = 3
SAM_PLACEMENT_RADIUS = 10.0  # launchers placed within this distance of their radar

GAS_VALUE = 1

DESTROY_THRESHOLD = 3.0  # miles — distance at which a drone "hits" a target

NUM_RADARS = 6
NUM_LAUNCHERS = 6        # one per radar
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
    initial_x: float = 0.0
    initial_y: float = 0.0
    revealed: bool = False
    destroyed: bool = False


@dataclass
class MissileLauncher:
    id: str
    x: float
    y: float
    radar_id: str = ""
    missiles_remaining: int = SAM_MISSILES


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
    radar_sight: float = RADAR_SIGHT
    missile_fire_range: float = MISSILE_FIRE_RANGE
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


def _launcher_near_radar(radar: Radar) -> tuple[float, float]:
    """Return a random position within SAM_PLACEMENT_RADIUS miles of the radar."""
    for _ in range(10_000):
        angle = random.uniform(0, 2 * math.pi)
        d = random.uniform(0, SAM_PLACEMENT_RADIUS)
        x = radar.x + d * math.cos(angle)
        y = radar.y + d * math.sin(angle)
        if 5.0 <= x <= GRID_SIZE - 5.0 and 5.0 <= y <= GRID_SIZE - 5.0:
            return x, y
    return radar.x, radar.y  # fallback


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def initialize_sim(
    num_bait: int = DEFAULT_BAIT,
    num_receiver: int = DEFAULT_RECV,
    radar_sight: float = RADAR_SIGHT,
    missile_fire_range: float = MISSILE_FIRE_RANGE,
) -> SimState:
    """
    Create and return a fresh SimState.

    Radars and gas targets are placed randomly with at least 20 miles separation.
    Each missile launcher is placed within 10 miles of its paired radar.
    All LUCAS drones launch from (0, 0) — the SW corner.
    Bait drones target gas targets; they cannot detect radar.
    """
    state = SimState(radar_sight=radar_sight, missile_fire_range=missile_fire_range)

    all_pos = _random_positions(NUM_RADARS + NUM_GAS)
    r_pos = all_pos[:NUM_RADARS]
    g_pos = all_pos[NUM_RADARS:]

    state.radars = [
        Radar(id=f"r{i+1}", x=x, y=y, initial_x=x, initial_y=y)
        for i, (x, y) in enumerate(r_pos)
    ]

    # Each launcher is paired with a radar and placed within 10 miles of it.
    state.missile_launchers = []
    for radar in state.radars:
        lx, ly = _launcher_near_radar(radar)
        state.missile_launchers.append(
            MissileLauncher(id=f"ml{radar.id[1:]}", x=lx, y=ly, radar_id=radar.id)
        )

    state.gas_targets = [GasTarget(id=f"gt{i+1}", x=x, y=y) for i, (x, y) in enumerate(g_pos)]

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

    Bait LUCAS drones cannot detect radar — they target gas targets for pre-mission
    intelligence value, then fall back to map centre.

    Radar-receiver drones navigate to the nearest revealed (not yet destroyed) radar
    to destroy it, or patrol the map centre while waiting for pings.
    """
    if drone.drone_type == "bait":
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


def _move_drone(drone: LucasDrone, tx: float, ty: float, speed: float = DRONE_SPEED) -> None:
    remaining = MAX_FLIGHT - drone.miles_flown
    if remaining <= 0:
        return
    dx, dy = tx - drone.x, ty - drone.y
    d = math.sqrt(dx * dx + dy * dy)
    if d < 1e-6:
        return
    step = min(speed, d, remaining)
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
      0. Radars drift randomly within their 10×10-mile wander box
      1. Move all alive LUCAS drones toward their current target
      2. Radar sight-range check → ping (reveals radar to receiver drones)
         Radar periodic ping (every 30 ticks, regardless of LUCAS proximity)
         On detection: associated SAM launcher fires once (99% hit rate)
      3. Surviving drones that reached a radar → radar explodes, drone explodes
         Surviving drones that reached gas targets → destroy target, add score
      4. Check completion (tick ≥ 60)
    """
    if state.complete:
        return []

    state.tick += 1
    tick_events: list[dict] = []

    alive_drones = [d for d in state.lucas_drones if d.alive]
    alive_radars = [r for r in state.radars if not r.destroyed]
    alive_gas = [t for t in state.gas_targets if not t.destroyed]

    # --- 0. Radar movement — drift within 10×10 wander box ---
    for radar in alive_radars:
        new_x = radar.initial_x + random.uniform(-RADAR_WANDER, RADAR_WANDER)
        new_y = radar.initial_y + random.uniform(-RADAR_WANDER, RADAR_WANDER)
        radar.x = max(0.0, min(float(GRID_SIZE - 1), new_x))
        radar.y = max(0.0, min(float(GRID_SIZE - 1), new_y))

    # --- 1. Move drones ---
    for drone in alive_drones:
        target = _drone_target(drone, state)
        if target:
            speed = BAIT_DRONE_SPEED if drone.drone_type == "bait" else DRONE_SPEED
            _move_drone(drone, *target, speed=speed)

    # --- 2. Radar pings and SAM cuing ---
    alive_drones_after_move = [d for d in state.lucas_drones if d.alive]
    periodic = (state.tick % RADAR_PING_INTERVAL == 0)

    for radar in alive_radars:
        drones_in_sight = [
            d for d in alive_drones_after_move
            if _dist(radar.x, radar.y, d.x, d.y) <= state.radar_sight
        ]
        triggered = len(drones_in_sight) > 0

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

            # SAM cuing: when radar detects drones, associated launcher fires once
            # if the nearest detected drone is also within the SAM's engagement range.
            if triggered:
                armed = [
                    ml for ml in state.missile_launchers
                    if ml.radar_id == radar.id and ml.missiles_remaining > 0
                ]
                if armed:
                    launcher = armed[0]
                    in_sam_range = [
                        d for d in drones_in_sight
                        if _dist(launcher.x, launcher.y, d.x, d.y) <= state.missile_fire_range
                    ]
                    if in_sam_range:
                        target_drone = min(
                            in_sam_range,
                            key=lambda d: _dist(launcher.x, launcher.y, d.x, d.y)
                        )
                        hit = random.random() < MISSILE_HIT_RATE
                        if hit:
                            target_drone.alive = False
                        launcher.missiles_remaining -= 1
                        missile_ev: dict = {
                            "tick": state.tick,
                            "type": "missile_fired",
                            "launcher_id": launcher.id,
                            "target_drone_id": target_drone.id,
                            "launcher_x": round(launcher.x, 2),
                            "launcher_y": round(launcher.y, 2),
                            "hit": hit,
                        }
                        tick_events.append(missile_ev)
                        state.events.append(missile_ev)
                        # Refresh alive list for subsequent radars this tick
                        alive_drones_after_move = [d for d in state.lucas_drones if d.alive]

    # --- 3. Destructions — drones reaching targets explode on contact ---
    surviving = [d for d in state.lucas_drones if d.alive]
    for drone in surviving:
        if not drone.alive:
            continue

        # Radar contact: receiver destroys radar, all drones explode
        for radar in alive_radars:
            if radar.destroyed:
                continue
            if _dist(drone.x, drone.y, radar.x, radar.y) <= DESTROY_THRESHOLD:
                if drone.drone_type == "radar_receiver":
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
                drone.alive = False  # drone explodes on radar contact regardless of type
                break

        if not drone.alive:
            continue

        # Gas target destruction
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

    # --- 4. Completion check ---
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

    Radars and gas targets include coordinates only when revealed.
    Missile launchers never expose coordinates — they are invisible to drones.
    LUCAS drones are always fully visible.
    """

    def radar_view(r: Radar) -> dict:
        d: dict = {"id": r.id, "revealed": r.revealed, "destroyed": r.destroyed, "value": RADAR_VALUE}
        if r.revealed:
            d["x"] = round(r.x, 2)
            d["y"] = round(r.y, 2)
        return d

    def launcher_view(ml: MissileLauncher) -> dict:
        return {
            "id": ml.id,
            "x": round(ml.x, 2),
            "y": round(ml.y, 2),
            "missiles_remaining": ml.missiles_remaining,
            "value": MISSILE_VALUE,
        }

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
        "radar_sight": state.radar_sight,
        "missile_fire_range": state.missile_fire_range,
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

    config keys (all optional):
      steps       int  number of ticks to run    (default 10, max 60)
      num_bait    int  bait drone count           (default 10)
      num_receiver int radar-receiver drone count (default 10)
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
