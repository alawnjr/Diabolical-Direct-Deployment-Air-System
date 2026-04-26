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
RADAR_CYCLE = 30         # ticks per on/off cycle (30 min on/off period)
RADAR_ON_DURATION = 5    # ticks the radar stays active per cycle (5-min window)
RADAR_VALUE = 4

SAM_MISSILES = 2             # starting missiles per launcher
MISSILE_HIT_RATE = 0.90      # probability a fired missile kills its target
MISSILE_FIRE_RANGE = 25.0    # miles — default SAM engagement radius from launcher
MISSILE_VALUE = 3
SAM_PLACEMENT_RADIUS = 10.0  # launchers placed within this distance of their radar

GAS_VALUE = 1
DESTROY_THRESHOLD = 3.0  # miles — distance at which a drone "hits" a target
STRIKE_REACTION_RADIUS = 50.0  # miles — strike drones lock onto a radar that pings them within this range

DEFAULT_NUM_RADARS = 6
DEFAULT_NUM_LAUNCHERS = 6
DEFAULT_NUM_GAS = 4
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
    power_offset: int = 0  # tick when this radar first turns on (0–25)


@dataclass
class MissileLauncher:
    id: str
    x: float
    y: float
    radar_id: str = ""
    missiles_remaining: int = SAM_MISSILES
    destroyed: bool = False


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
    angle: float = 0.0   # radians — fan-out heading assigned at init
    alive: bool = True
    miles_flown: float = 0.0
    target_x: Optional[float] = None  # set when strike drone locks onto a radar
    target_y: Optional[float] = None


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
    # Revealed radar positions, navigated toward by radar_receiver drones
    revealed_radar_positions: dict[str, tuple[float, float]] = field(default_factory=dict)
    # Shared visited grid cells — no two drones visit the same 1×1-mile cell
    visited_coords: set[tuple[int, int]] = field(default_factory=set)


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


def _launcher_near_radar_xy(rx: float, ry: float) -> tuple[float, float]:
    """Return a random position within SAM_PLACEMENT_RADIUS miles of (rx, ry)."""
    for _ in range(10_000):
        angle = random.uniform(0, 2 * math.pi)
        d = random.uniform(0, SAM_PLACEMENT_RADIUS)
        x = rx + d * math.cos(angle)
        y = ry + d * math.sin(angle)
        if 5.0 <= x <= GRID_SIZE - 5.0 and 5.0 <= y <= GRID_SIZE - 5.0:
            return x, y
    return rx, ry  # fallback


def _radar_is_on(radar: Radar, tick: int) -> bool:
    elapsed = tick - radar.power_offset
    return elapsed >= 0 and (elapsed % RADAR_CYCLE) < RADAR_ON_DURATION


def _radar_just_turned_on(radar: Radar, tick: int) -> bool:
    elapsed = tick - radar.power_offset
    return elapsed >= 0 and (elapsed % RADAR_CYCLE) == 0


# ---------------------------------------------------------------------------
# Map generation
# ---------------------------------------------------------------------------

def create_random_map(
    num_radars: int,
    num_launchers: int,
    num_gas: int,
) -> Optional[dict[str, list[tuple[float, float]]]]:
    """
    Generate a valid random map configuration.

    Radars and gas targets are placed with at least 20-mile separation.
    Launchers are placed near radars (round-robin if num_launchers > num_radars).

    Returns a dict with 'radars', 'launchers', 'gas' position lists,
    or None if a valid placement cannot be found ("can't generate one").
    """
    if num_radars < 0 or num_launchers < 0 or num_gas < 0:
        return None

    total_free = num_radars + num_gas
    if total_free == 0:
        return {"radars": [], "launchers": [], "gas": []}

    positions = _random_positions(total_free)
    if len(positions) < total_free:
        return None  # can't place all entities with required separation

    radar_positions = positions[:num_radars]
    gas_positions = positions[num_radars:]

    launcher_positions: list[tuple[float, float]] = []
    for i in range(num_launchers):
        if num_radars == 0:
            return None  # launchers need radars to pair with
        rx, ry = radar_positions[i % num_radars]
        launcher_positions.append(_launcher_near_radar_xy(rx, ry))

    return {
        "radars": radar_positions,
        "launchers": launcher_positions,
        "gas": gas_positions,
    }


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def initialize_sim(
    num_bait: int = DEFAULT_BAIT,
    num_receiver: int = DEFAULT_RECV,
    radar_sight: float = RADAR_SIGHT,
    missile_fire_range: float = MISSILE_FIRE_RANGE,
    num_radars: int = DEFAULT_NUM_RADARS,
    num_launchers: int = DEFAULT_NUM_LAUNCHERS,
    num_gas: int = DEFAULT_NUM_GAS,
) -> SimState:
    """
    Create and return a fresh SimState.

    Raises ValueError("can't generate one") if the map cannot be generated.
    All drones launch from (0, 0) — the SW corner — and fan out in unique directions
    spanning a 90° arc across the NE quadrant.
    """
    map_data = create_random_map(num_radars, num_launchers, num_gas)
    if map_data is None:
        raise ValueError("can't generate one")

    state = SimState(
        radar_sight=radar_sight,
        missile_fire_range=missile_fire_range,
        visited_coords={(0, 0)},
    )

    state.radars = [
        Radar(id=f"r{i+1}", x=x, y=y, power_offset=random.randint(0, 25))
        for i, (x, y) in enumerate(map_data["radars"])
    ]

    # Pair each launcher with a radar (round-robin)
    state.missile_launchers = []
    for i, (lx, ly) in enumerate(map_data["launchers"]):
        radar_id = state.radars[i % num_radars].id if num_radars > 0 else ""
        state.missile_launchers.append(
            MissileLauncher(id=f"ml{i+1}", x=lx, y=ly, radar_id=radar_id)
        )

    state.gas_targets = [
        GasTarget(id=f"gt{i+1}", x=x, y=y)
        for i, (x, y) in enumerate(map_data["gas"])
    ]

    # Fan-out angles: evenly spread across 0°–90° (NE quadrant from SW corner)
    total_drones = num_bait + num_receiver
    drones: list[LucasDrone] = []
    for i in range(num_bait):
        global_i = i
        angle = math.radians(90.0 * (global_i + 0.5) / total_drones) if total_drones > 0 else math.radians(45)
        drones.append(LucasDrone(id=f"bait_{i+1}", drone_type="bait", x=0.0, y=0.0, angle=angle))
    for i in range(num_receiver):
        global_i = num_bait + i
        angle = math.radians(90.0 * (global_i + 0.5) / total_drones) if total_drones > 0 else math.radians(45)
        drones.append(LucasDrone(id=f"recv_{i+1}", drone_type="radar_receiver", x=0.0, y=0.0, angle=angle))

    state.lucas_drones = drones
    return state


# ---------------------------------------------------------------------------
# Drone movement
# ---------------------------------------------------------------------------

# Rotation offsets (degrees) to try when a cell is already visited
_ROTATION_OFFSETS = [0, 15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90, 120, -120, 150, -150, 180]


def _move_drone_direction(drone: LucasDrone, state: SimState) -> None:
    """
    Move drone along its assigned heading, detouring to avoid visited cells.
    Marks the destination cell in the shared visited_coords set.
    """
    remaining = MAX_FLIGHT - drone.miles_flown
    if remaining <= 0:
        return
    speed = BAIT_DRONE_SPEED if drone.drone_type == "bait" else DRONE_SPEED
    step = min(speed, remaining)

    for rot_deg in _ROTATION_OFFSETS:
        angle = drone.angle + math.radians(rot_deg)
        nx = max(0.0, min(float(GRID_SIZE - 1), drone.x + math.cos(angle) * step))
        ny = max(0.0, min(float(GRID_SIZE - 1), drone.y + math.sin(angle) * step))
        cell = (round(nx), round(ny))
        if cell not in state.visited_coords:
            drone.x, drone.y = nx, ny
            drone.miles_flown += step
            state.visited_coords.add(cell)
            return

    # Fallback: advance straight even into a visited cell
    nx = max(0.0, min(float(GRID_SIZE - 1), drone.x + math.cos(drone.angle) * step))
    ny = max(0.0, min(float(GRID_SIZE - 1), drone.y + math.sin(drone.angle) * step))
    drone.x, drone.y = nx, ny
    drone.miles_flown += step
    state.visited_coords.add((round(drone.x), round(drone.y)))


def _move_drone_to_target(drone: LucasDrone) -> None:
    """Steer a strike drone straight toward its locked radar position."""
    remaining = MAX_FLIGHT - drone.miles_flown
    if remaining <= 0 or drone.target_x is None or drone.target_y is None:
        return
    dx = drone.target_x - drone.x
    dy = drone.target_y - drone.y
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

    Tick order:
      1. Move all alive LUCAS drones along their fan-out headings
      2. Radar sight-range check → ping (reveals radar to receiver drones)
         Radar periodic ping (every 30 ticks, regardless of LUCAS proximity)
         On detection: associated SAM launcher fires once (99% hit rate)
      3. Contact destructions:
           - Drone reaches radar     → radar destroyed, drone dies
           - Drone reaches launcher  → launcher destroyed, drone dies
           - Drone reaches gas target → gas destroyed, drone survives
      4. Check completion (tick ≥ 60)
    """
    if state.complete:
        return []

    state.tick += 1
    tick_events: list[dict] = []

    alive_drones = [d for d in state.lucas_drones if d.alive]
    alive_radars = [r for r in state.radars if not r.destroyed]
    alive_launchers = [ml for ml in state.missile_launchers if not ml.destroyed]
    alive_gas = [t for t in state.gas_targets if not t.destroyed]

    # --- 1. Move drones ---
    for drone in alive_drones:
        if drone.drone_type == "radar_receiver" and drone.target_x is not None:
            _move_drone_to_target(drone)
        else:
            _move_drone_direction(drone, state)

    # --- 2. Radar pings and SAM cuing ---
    alive_drones_now = [d for d in state.lucas_drones if d.alive]

    for radar in alive_radars:
        if not _radar_is_on(radar, state.tick):
            continue

        drones_in_sight = [
            d for d in alive_drones_now
            if _dist(radar.x, radar.y, d.x, d.y) <= state.radar_sight
        ]
        triggered = len(drones_in_sight) > 0
        just_turned_on = _radar_just_turned_on(radar, state.tick)

        if just_turned_on or triggered:
            radar.revealed = True
            state.revealed_radar_positions[radar.id] = (radar.x, radar.y)
            ev: dict = {
                "tick": state.tick,
                "type": "radar_ping",
                "radar_id": radar.id,
                "x": round(radar.x, 2),
                "y": round(radar.y, 2),
                "detected_drone_ids": [d.id for d in drones_in_sight],
            }
            tick_events.append(ev)
            state.events.append(ev)

            # Strike drones pinged within reaction radius lock onto this radar
            for d in drones_in_sight:
                if (d.drone_type == "radar_receiver"
                        and _dist(radar.x, radar.y, d.x, d.y) <= STRIKE_REACTION_RADIUS):
                    d.target_x = radar.x
                    d.target_y = radar.y

        if triggered:
            armed = [
                ml for ml in alive_launchers
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
                    alive_drones_now = [d for d in state.lucas_drones if d.alive]

    # --- 3. Contact destructions ---
    surviving = [d for d in state.lucas_drones if d.alive]

    for drone in surviving:
        if not drone.alive:
            continue

        # Radar contact: any drone type destroys radar and dies
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
                drone.alive = False
                break

        if not drone.alive:
            continue

        # Launcher contact: any drone type destroys launcher and dies
        for launcher in alive_launchers:
            if launcher.destroyed:
                continue
            if _dist(drone.x, drone.y, launcher.x, launcher.y) <= DESTROY_THRESHOLD:
                launcher.destroyed = True
                state.score += MISSILE_VALUE
                ev = {
                    "tick": state.tick,
                    "type": "launcher_destroyed",
                    "launcher_id": launcher.id,
                    "drone_id": drone.id,
                    "score_gained": MISSILE_VALUE,
                    "x": round(launcher.x, 2),
                    "y": round(launcher.y, 2),
                }
                tick_events.append(ev)
                state.events.append(ev)
                drone.alive = False
                break

        if not drone.alive:
            continue

        # Gas target: drone collects and survives
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
            "destroyed": ml.destroyed,
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
        "events": state.events[-100:],
    }


# ---------------------------------------------------------------------------
# Legacy one-shot runner (called by POST /api/simulate)
# ---------------------------------------------------------------------------

def run_simulation(config: dict[str, Any]) -> dict[str, Any]:
    steps        = min(int(config.get("steps", 10)), MAX_TICKS)
    num_bait     = int(config.get("num_bait", DEFAULT_BAIT))
    num_receiver = int(config.get("num_receiver", DEFAULT_RECV))

    state   = initialize_sim(num_bait, num_receiver)
    results = []

    for _ in range(steps):
        advance_tick(state)
        results.append({"step": state.tick, "state": get_public_state(state)})

    return {"steps": steps, "results": results}
