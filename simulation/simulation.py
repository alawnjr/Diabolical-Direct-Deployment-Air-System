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

RADAR_SIGHT = 50.0       # miles — default radar detection radius
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
CAMERA_DRONE_RANGE = 30.0  # miles — camera drone detection/lock-on radius

# Algorithms where bait drones launch this many ticks before strike/camera drones.
BAIT_HEAD_START = 8

# Algorithms that benefit from bait vanguard (all others launch all drones simultaneously).
_EARLY_BAIT_ALGOS = {"grid_sweep", "hotspot_reinforce", "scout_fix_finish", "saturation_fan", "meta_selector", "triangulation"}

DEFAULT_NUM_RADARS = 6
DEFAULT_NUM_LAUNCHERS = 6
DEFAULT_NUM_GAS = 4
DEFAULT_BAIT = 10
DEFAULT_RECV = 10
DEFAULT_CAMERA = 4

VALID_ALGORITHMS = [
    "grid_sweep",
    "spiral_outward",
    "saturation_fan",
    "bait_ladder",
    "reload_trap",
    "multi_azimuth",
    "random_walk",
    "sector_claim",
    "triangulation",
    "hotspot_reinforce",
    "scout_fix_finish",
    "meta_selector",
]

VALID_DEFENSE_ALGORITHMS = [
    "random",
    "perimeter_picket",
    "corner_anchors",
    "layered_rings",
    "fortress_core",
    "kill_channel",
    "sam_forward_screen",
    "magazine_wall",
    "dispersed_ambush",
    "staggered_emission_web",
    "honeycomb_grid",
]


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
    drone_type: str  # "bait" | "radar_receiver" | "camera"
    x: float
    y: float
    angle: float = 0.0   # radians — fan-out heading assigned at init
    alive: bool = True
    miles_flown: float = 0.0
    target_x: Optional[float] = None  # strike/camera: locked target position
    target_y: Optional[float] = None
    camera_on: bool = True  # camera drones only: toggles active scanning


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
    # Revealed radar positions, navigated toward by receiver drones
    revealed_radar_positions: dict[str, tuple[float, float]] = field(default_factory=dict)
    # Shared visited grid cells — no two drones visit the same 1×1-mile cell
    visited_coords: set[tuple[int, int]] = field(default_factory=set)
    algorithm: str = "grid_sweep"
    algorithm_state: dict[str, Any] = field(default_factory=dict)
    defense_algorithm: str = "random"


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


def _launcher_near_radar_xy_biased(rx: float, ry: float, preferred_angle: float) -> tuple[float, float]:
    """Place launcher within SAM_PLACEMENT_RADIUS of radar, biased toward preferred_angle (±60°)."""
    for _ in range(10_000):
        a = preferred_angle + random.uniform(-math.pi / 3, math.pi / 3)
        d = random.uniform(4.0, SAM_PLACEMENT_RADIUS)
        x = rx + d * math.cos(a)
        y = ry + d * math.sin(a)
        if 5.0 <= x <= GRID_SIZE - 5.0 and 5.0 <= y <= GRID_SIZE - 5.0:
            return x, y
    return _launcher_near_radar_xy(rx, ry)


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
    or None if a valid placement cannot be found.
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


def _random_positions_avoiding(
    n: int,
    existing: list[tuple[float, float]],
    margin: float = 10.0,
    min_sep: float = 20.0,
) -> list[tuple[float, float]]:
    """Generate n random positions that maintain min_sep from all existing positions."""
    positions: list[tuple[float, float]] = []
    for _ in range(100_000):
        if len(positions) == n:
            break
        x = random.uniform(margin, GRID_SIZE - margin)
        y = random.uniform(margin, GRID_SIZE - margin)
        all_taken = existing + positions
        if all(_dist(x, y, px, py) >= min_sep for px, py in all_taken):
            positions.append((x, y))
    return positions


def _defense_radar_positions(algorithm: str, num_radars: int) -> list[tuple[float, float]]:
    """
    Return deterministic radar positions for a named defense initialization algorithm.
    All returned positions are clamped within [12, 188] on both axes.
    """
    if num_radars <= 0:
        return []

    cx, cy = GRID_SIZE / 2, GRID_SIZE / 2   # 100, 100
    m = 12.0  # edge margin

    def clamp(v: float) -> float:
        return max(m, min(GRID_SIZE - m, v))

    if algorithm == "perimeter_picket":
        # Radars evenly distributed on a circle at 80 mi from center
        r = 80.0
        return [
            (clamp(cx + r * math.cos(2 * math.pi * i / num_radars)),
             clamp(cy + r * math.sin(2 * math.pi * i / num_radars)))
            for i in range(num_radars)
        ]

    elif algorithm == "corner_anchors":
        # 4 map corners, then center, then edge midpoints
        pool = [
            (m, m),
            (GRID_SIZE - m, m),
            (m, GRID_SIZE - m),
            (GRID_SIZE - m, GRID_SIZE - m),
            (cx, cy),
            (cx, m),
            (cx, GRID_SIZE - m),
            (m, cy),
            (GRID_SIZE - m, cy),
        ]
        return pool[:num_radars]

    elif algorithm == "layered_rings":
        # Outer ring at 75 mi radius, inner ring at 22 mi radius
        outer_n = max(1, num_radars // 2)
        inner_n = num_radars - outer_n
        outer_r = min(75.0, GRID_SIZE / 2 - m)
        inner_r = 22.0
        positions: list[tuple[float, float]] = []
        for i in range(outer_n):
            a = 2 * math.pi * i / outer_n
            positions.append((clamp(cx + outer_r * math.cos(a)), clamp(cy + outer_r * math.sin(a))))
        for i in range(inner_n):
            offset = math.pi / inner_n if inner_n > 0 else 0
            a = 2 * math.pi * i / inner_n + offset
            positions.append((cx + inner_r * math.cos(a), cy + inner_r * math.sin(a)))
        return positions

    elif algorithm == "fortress_core":
        # All radars clustered within 14 mi of map center
        if num_radars == 1:
            return [(cx, cy)]
        r = 14.0
        return [
            (cx + r * math.cos(2 * math.pi * i / num_radars),
             cy + r * math.sin(2 * math.pi * i / num_radars))
            for i in range(num_radars)
        ]

    elif algorithm == "kill_channel":
        # Dense column along the 45° NE axis from origin
        ax = math.cos(math.pi / 4)
        ay = math.sin(math.pi / 4)
        t0, t1 = 30.0, 155.0
        positions = []
        for i in range(num_radars):
            t = t0 + (t1 - t0) * i / max(num_radars - 1, 1) if num_radars > 1 else (t0 + t1) / 2
            positions.append((clamp(t * ax), clamp(t * ay)))
        return positions

    elif algorithm == "sam_forward_screen":
        # Forward radars near NE edge; rear radars in the SW interior
        fwd_n = max(1, num_radars // 2)
        rear_n = num_radars - fwd_n
        positions = []
        for i in range(fwd_n):
            t = i / max(fwd_n - 1, 1) if fwd_n > 1 else 0.5
            positions.append((clamp(130 + t * 55), clamp(175 - t * 55)))
        for i in range(rear_n):
            t = i / max(rear_n - 1, 1) if rear_n > 1 else 0.5
            positions.append((clamp(22 + t * 55), clamp(22 + t * 55)))
        return positions

    elif algorithm == "magazine_wall":
        # Cluster all radars around 2–3 hub positions for dense SAM packing
        num_hubs = min(3, num_radars)
        hubs = [(60.0, 100.0), (140.0, 100.0), (100.0, 155.0)][:num_hubs]
        slots = math.ceil((num_radars - num_hubs) / max(num_hubs, 1)) if num_radars > num_hubs else 1
        positions = []
        for i in range(num_radars):
            hx, hy = hubs[i % num_hubs]
            extra_idx = i // num_hubs
            if extra_idx == 0:
                positions.append((hx, hy))
            else:
                a = 2 * math.pi * (extra_idx - 1) / max(slots, 1)
                d = 6.0
                positions.append((clamp(hx + d * math.cos(a)), clamp(hy + d * math.sin(a))))
        return positions

    elif algorithm in ("dispersed_ambush", "staggered_emission_web"):
        # Maximum-spread uniform grid — timing offsets for staggered_emission_web set separately
        cols = math.ceil(math.sqrt(num_radars))
        rows = math.ceil(num_radars / cols)
        sx = (GRID_SIZE - 2 * m) / cols
        sy = (GRID_SIZE - 2 * m) / rows
        return [
            (m + sx * (c + 0.5), m + sy * (r + 0.5))
            for r in range(rows) for c in range(cols)
        ][:num_radars]

    elif algorithm == "honeycomb_grid":
        # Radars at vertices of a hexagon (radius 57 mi) centered on the map,
        # then the center, then inner ring at half-radius
        hex_r = 57.0
        positions = [
            (clamp(cx + hex_r * math.cos(k * math.pi / 3)),
             clamp(cy + hex_r * math.sin(k * math.pi / 3)))
            for k in range(6)
        ]
        positions.append((cx, cy))
        half_r = hex_r * 0.5
        for k in range(6):
            a = (k + 0.5) * math.pi / 3
            positions.append((clamp(cx + half_r * math.cos(a)), clamp(cy + half_r * math.sin(a))))
        return positions[:num_radars]

    # Fallback (should not reach here for valid algorithms)
    return _random_positions(num_radars)


def _launcher_preferred_angle(algorithm: str, rx: float, ry: float) -> Optional[float]:
    """
    Return a preferred placement angle (radians) for a launcher near (rx, ry),
    or None to use fully random placement.
    """
    cx, cy = GRID_SIZE / 2, GRID_SIZE / 2
    if algorithm == "perimeter_picket":
        return math.atan2(cy - ry, cx - rx)  # toward map center
    if algorithm == "fortress_core":
        return math.atan2(ry - cy, rx - cx)  # outward from center
    if algorithm == "kill_channel":
        return math.pi / 4                   # along the NE axis
    if algorithm == "sam_forward_screen" and rx + ry > 250:
        return math.atan2(cy - ry, cx - rx)  # forward launchers face inward
    return None


def create_algorithmic_map(
    defense_algorithm: str,
    num_radars: int,
    num_launchers: int,
    num_gas: int,
) -> Optional[dict[str, Any]]:
    """
    Generate a map using a specific defense initialization algorithm.

    Returns a dict with 'radars', 'launchers', 'gas' position lists and,
    for staggered_emission_web, an optional 'power_offsets' list.
    Returns None if placement fails.
    """
    if num_radars < 0 or num_launchers < 0 or num_gas < 0:
        return None
    if num_launchers > 0 and num_radars == 0:
        return None

    radar_positions = _defense_radar_positions(defense_algorithm, num_radars)
    if len(radar_positions) < num_radars:
        return None

    launcher_positions: list[tuple[float, float]] = []
    for i in range(num_launchers):
        rx, ry = radar_positions[i % num_radars] if num_radars > 0 else (0.0, 0.0)
        pref = _launcher_preferred_angle(defense_algorithm, rx, ry)
        if pref is not None:
            launcher_positions.append(_launcher_near_radar_xy_biased(rx, ry, pref))
        else:
            launcher_positions.append(_launcher_near_radar_xy(rx, ry))

    gas_positions = _random_positions_avoiding(num_gas, radar_positions)
    if len(gas_positions) < num_gas:
        return None

    result: dict[str, Any] = {
        "radars": radar_positions,
        "launchers": launcher_positions,
        "gas": gas_positions,
    }

    # Staggered emission web: evenly-spaced deterministic power offsets
    if defense_algorithm == "staggered_emission_web" and num_radars > 0:
        result["power_offsets"] = [
            int(i * RADAR_CYCLE / num_radars) % RADAR_CYCLE
            for i in range(num_radars)
        ]

    return result


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
    num_camera: int = DEFAULT_CAMERA,
    algorithm: str = "grid_sweep",
    defense_algorithm: str = "random",
) -> SimState:
    """
    Create and return a fresh SimState.

    Raises ValueError("can't generate one") if the map cannot be generated.
    All drones launch from (0, 0) — the SW corner — and fan out in unique directions
    spanning a 90° arc across the NE quadrant.
    """
    algo = algorithm if algorithm in VALID_ALGORITHMS else "grid_sweep"
    def_algo = defense_algorithm if defense_algorithm in VALID_DEFENSE_ALGORITHMS else "random"

    if def_algo == "random":
        map_data = create_random_map(num_radars, num_launchers, num_gas)
    else:
        map_data = create_algorithmic_map(def_algo, num_radars, num_launchers, num_gas)
    if map_data is None:
        raise ValueError("can't generate one")

    state = SimState(
        radar_sight=radar_sight,
        missile_fire_range=missile_fire_range,
        visited_coords={(0, 0)},
        algorithm=algo,
        defense_algorithm=def_algo,
    )

    power_offsets: Optional[list[int]] = map_data.get("power_offsets")  # type: ignore[assignment]
    state.radars = [
        Radar(
            id=f"r{i+1}", x=x, y=y,
            power_offset=power_offsets[i] if power_offsets else random.randint(0, 25),
        )
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
    total_drones = num_bait + num_receiver + num_camera
    drones: list[LucasDrone] = []
    for i in range(num_bait):
        global_i = i
        angle = math.radians(90.0 * (global_i + 0.5) / total_drones) if total_drones > 0 else math.radians(45)
        drones.append(LucasDrone(id=f"bait_{i+1}", drone_type="bait", x=0.0, y=0.0, angle=angle))
    for i in range(num_receiver):
        global_i = num_bait + i
        angle = math.radians(90.0 * (global_i + 0.5) / total_drones) if total_drones > 0 else math.radians(45)
        drones.append(LucasDrone(id=f"recv_{i+1}", drone_type="radar_receiver", x=0.0, y=0.0, angle=angle))
    for i in range(num_camera):
        global_i = num_bait + num_receiver + i
        angle = math.radians(90.0 * (global_i + 0.5) / total_drones) if total_drones > 0 else math.radians(45)
        drones.append(LucasDrone(id=f"cam_{i+1}", drone_type="camera", x=0.0, y=0.0, angle=angle))

    state.lucas_drones = drones
    _init_algorithm(state)
    return state


# ---------------------------------------------------------------------------
# Drone movement — base helpers
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


def _navigate_receiver_to_radar(drone: LucasDrone, state: SimState) -> None:
    """Steer a receiver drone toward the closest revealed alive radar each tick.
    Falls back to fan-out heading when no radar target is known yet."""
    remaining = MAX_FLIGHT - drone.miles_flown
    if remaining <= 0:
        return

    alive_radar_ids = {r.id for r in state.radars if not r.destroyed}
    candidates = [
        (rx, ry)
        for rid, (rx, ry) in state.revealed_radar_positions.items()
        if rid in alive_radar_ids
    ]

    if not candidates:
        _move_drone_direction(drone, state)
        return

    tx, ty = min(candidates, key=lambda p: _dist(drone.x, drone.y, p[0], p[1]))
    dx, dy = tx - drone.x, ty - drone.y
    d = math.sqrt(dx * dx + dy * dy)
    if d < 1e-6:
        return  # Already on top of target — contact destruction handles it this tick
    step = min(DRONE_SPEED, d, remaining)
    ratio = step / d
    drone.x = max(0.0, min(float(GRID_SIZE - 1), drone.x + dx * ratio))
    drone.y = max(0.0, min(float(GRID_SIZE - 1), drone.y + dy * ratio))
    drone.miles_flown += step
    state.visited_coords.add((round(drone.x), round(drone.y)))


def _move_drone_to_point(drone: LucasDrone, tx: float, ty: float, state: SimState) -> None:
    """Move a drone straight toward (tx, ty) at DRONE_SPEED.
    drone.angle is intentionally NOT updated so that falling back to the
    algorithm always uses the algorithm-assigned heading, not a stale homing direction."""
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
    state.visited_coords.add((round(drone.x), round(drone.y)))


# ---------------------------------------------------------------------------
# Algorithm initialisation and movement
# ---------------------------------------------------------------------------

def _init_algorithm(state: SimState) -> None:
    """Assign algorithm-specific state and angles to each non-camera drone."""
    algo = state.algorithm
    drones = [d for d in state.lucas_drones if d.drone_type != "camera"]
    bait_drones = [d for d in drones if d.drone_type == "bait"]
    recv_drones = [d for d in drones if d.drone_type == "radar_receiver"]
    n = len(drones)

    if algo in ("grid_sweep", "meta_selector"):
        # Bait drones cover the FULL latitude (10–190 NM) as a vanguard wave,
        # indexed among themselves so they spread evenly regardless of fleet size.
        for i, drone in enumerate(bait_drones):
            lane_y = 10.0 + 180.0 * i / max(len(bait_drones) - 1, 1)
            state.algorithm_state[drone.id] = {"lane_y": lane_y, "dir": 1}
        # Strike and camera drones also get full-latitude lanes (delayed launch).
        for i, drone in enumerate(recv_drones):
            lane_y = 10.0 + 180.0 * i / max(len(recv_drones) - 1, 1)
            state.algorithm_state[drone.id] = {"lane_y": lane_y, "dir": 1}
        camera_drones_gs = [d for d in state.lucas_drones if d.drone_type == "camera"]
        for i, drone in enumerate(camera_drones_gs):
            lane_y = 10.0 + 180.0 * i / max(len(camera_drones_gs) - 1, 1)
            state.algorithm_state[drone.id] = {"lane_y": lane_y, "dir": 1}
        if algo == "meta_selector":
            state.algorithm_state["__meta_phase"] = "grid_sweep"

    elif algo == "spiral_outward":
        # Each drone gets a different starting angle/radius for non-overlapping spirals
        for i, drone in enumerate(drones):
            spread = (math.pi / 4) * i / max(n, 1)
            state.algorithm_state[drone.id] = {
                "angle": math.radians(5) + spread,
                "radius": 5.0 + i * (GRID_SIZE * 0.9 / max(n, 1)),
            }

    elif algo == "saturation_fan":
        # Compress all drones into a tight 20° cone centred on 45°
        center = math.radians(45.0)
        half = math.radians(10.0)
        for i, drone in enumerate(drones):
            t = i / max(n - 1, 1)
            drone.angle = center - half + t * 2 * half

    elif algo == "bait_ladder":
        # Stagger bait drones: one activates every 2 ticks; receivers fan out immediately
        for i, drone in enumerate(bait_drones):
            state.algorithm_state[drone.id] = {"start_tick": i * 2 + 1}
        for drone in recv_drones:
            state.algorithm_state[drone.id] = {"start_tick": 0}

    elif algo == "reload_trap":
        # Wave 1: bait active ticks 1-25; Wave 2: receivers active ticks 26-60
        for drone in bait_drones:
            state.algorithm_state[drone.id] = {"active_from": 1, "active_to": 25}
        for drone in recv_drones:
            state.algorithm_state[drone.id] = {"active_from": 26, "active_to": 60}

    elif algo == "multi_azimuth":
        # Three bearing clusters at ~20°, ~45°, ~70° with ±4° spread
        cluster_centers = [math.radians(20), math.radians(45), math.radians(70)]
        spread = math.radians(4)
        for i, drone in enumerate(drones):
            cluster = cluster_centers[i % 3]
            drone.angle = cluster + random.uniform(-spread, spread)

    elif algo == "sector_claim":
        # Divide map into sqrt(n)×sqrt(n) grid; assign each drone one sector
        cols = max(1, math.ceil(math.sqrt(n)))
        rows = max(1, math.ceil(n / cols))
        sector_w = float(GRID_SIZE) / cols
        sector_h = float(GRID_SIZE) / rows
        for i, drone in enumerate(drones):
            col = i % cols
            row = i // cols
            sx = col * sector_w
            sy = row * sector_h
            ex = min(sx + sector_w, float(GRID_SIZE - 1))
            ey = min(sy + sector_h, float(GRID_SIZE - 1))
            cx, cy = (sx + ex) / 2, (sy + ey) / 2
            state.algorithm_state[drone.id] = {
                "x_min": sx, "x_max": ex,
                "y_min": sy, "y_max": ey,
                "sweep_y": sy + 5.0,
                "dir": 1,
            }
            drone.angle = math.atan2(cy, cx) if (cx > 0 or cy > 0) else math.radians(45)

    # triangulation, hotspot_reinforce, random_walk, scout_fix_finish:
    # keep the default fan-out angles assigned during initialize_sim

    # For algorithms that benefit from an early bait vanguard, delay launch of
    # all strike and camera drones so bait drones get a head start.
    if algo in _EARLY_BAIT_ALGOS:
        camera_drones = [d for d in state.lucas_drones if d.drone_type == "camera"]
        for drone in recv_drones + camera_drones:
            state.algorithm_state.setdefault(drone.id, {})["start_tick"] = BAIT_HEAD_START


def _algo_grid_sweep(drone: LucasDrone, state: SimState) -> None:
    """Fly to an assigned horizontal lane then sweep east-west."""
    remaining = MAX_FLIGHT - drone.miles_flown
    if remaining <= 0:
        return
    speed = BAIT_DRONE_SPEED if drone.drone_type == "bait" else DRONE_SPEED
    step = min(speed, remaining)

    ds = state.algorithm_state.get(drone.id)
    if not ds:
        _move_drone_direction(drone, state)
        return

    lane_y = ds["lane_y"]
    dy = lane_y - drone.y

    if abs(dy) > step:
        # Navigate north/south toward lane first
        drone.y = max(0.0, min(float(GRID_SIZE - 1), drone.y + math.copysign(step, dy)))
    else:
        # Arrived at lane — sweep horizontally
        drone.y = max(0.0, min(float(GRID_SIZE - 1), lane_y))
        dir_ = ds.get("dir", 1)
        new_x = drone.x + dir_ * step
        if new_x >= GRID_SIZE - 1:
            new_x = float(GRID_SIZE - 1)
            ds["dir"] = -1
        elif new_x <= 0.0:
            new_x = 0.0
            ds["dir"] = 1
        drone.x = new_x

    drone.miles_flown += step
    state.visited_coords.add((round(drone.x), round(drone.y)))


def _algo_spiral_outward(drone: LucasDrone, state: SimState) -> None:
    """Follow an Archimedean spiral outward from the launch origin."""
    remaining = MAX_FLIGHT - drone.miles_flown
    if remaining <= 0:
        return
    speed = BAIT_DRONE_SPEED if drone.drone_type == "bait" else DRONE_SPEED
    step = min(speed, remaining)

    ds = state.algorithm_state.get(drone.id)
    if not ds:
        _move_drone_direction(drone, state)
        return

    angle = ds["angle"]
    radius = ds["radius"]

    tx = max(0.0, min(float(GRID_SIZE - 1), radius * math.cos(angle)))
    ty = max(0.0, min(float(GRID_SIZE - 1), radius * math.sin(angle)))

    dx, dy = tx - drone.x, ty - drone.y
    d = math.sqrt(dx * dx + dy * dy)
    if d > 1e-6:
        ratio = min(step, d) / d
        drone.x = max(0.0, min(float(GRID_SIZE - 1), drone.x + dx * ratio))
        drone.y = max(0.0, min(float(GRID_SIZE - 1), drone.y + dy * ratio))

    ds["angle"] = angle + math.radians(8)
    ds["radius"] = min(radius + 6.0, float(GRID_SIZE) * 0.95)

    drone.miles_flown += step
    state.visited_coords.add((round(drone.x), round(drone.y)))


def _algo_bait_ladder(drone: LucasDrone, state: SimState) -> None:
    """Bait drones activate one-by-one at staggered ticks."""
    ds = state.algorithm_state.get(drone.id, {})
    if state.tick < ds.get("start_tick", 0):
        return
    _move_drone_direction(drone, state)


def _algo_reload_trap(drone: LucasDrone, state: SimState) -> None:
    """Bait active ticks 1-25; receivers active ticks 26-60."""
    ds = state.algorithm_state.get(drone.id, {})
    if not (ds.get("active_from", 1) <= state.tick <= ds.get("active_to", 60)):
        return
    _move_drone_direction(drone, state)


def _algo_random_walk(drone: LucasDrone, state: SimState) -> None:
    """Jitter heading by ±25° each tick then move normally."""
    drone.angle += random.uniform(-math.radians(25), math.radians(25))
    _move_drone_direction(drone, state)


def _algo_sector_claim(drone: LucasDrone, state: SimState) -> None:
    """Navigate to an assigned map sector and sweep it in horizontal rows."""
    remaining = MAX_FLIGHT - drone.miles_flown
    if remaining <= 0:
        return
    speed = BAIT_DRONE_SPEED if drone.drone_type == "bait" else DRONE_SPEED
    step = min(speed, remaining)

    ds = state.algorithm_state.get(drone.id)
    if not ds:
        _move_drone_direction(drone, state)
        return

    x_min, x_max = ds["x_min"], ds["x_max"]
    y_min, y_max = ds["y_min"], ds["y_max"]

    # Navigate to sector centre if outside sector
    if not (x_min <= drone.x <= x_max and y_min <= drone.y <= y_max):
        cx, cy = (x_min + x_max) / 2, (y_min + y_max) / 2
        dx, dy = cx - drone.x, cy - drone.y
        d = math.sqrt(dx * dx + dy * dy)
        if d > 1e-6:
            ratio = min(step, d) / d
            drone.x = max(0.0, min(float(GRID_SIZE - 1), drone.x + dx * ratio))
            drone.y = max(0.0, min(float(GRID_SIZE - 1), drone.y + dy * ratio))
        drone.miles_flown += step
        state.visited_coords.add((round(drone.x), round(drone.y)))
        return

    # Horizontal sweep within sector
    sweep_y = ds.get("sweep_y", (y_min + y_max) / 2)
    dir_ = ds.get("dir", 1)
    dy = sweep_y - drone.y

    if abs(dy) > step:
        drone.y = max(y_min, min(y_max, drone.y + math.copysign(step, dy)))
    else:
        drone.y = max(y_min, min(y_max, sweep_y))
        new_x = drone.x + dir_ * step
        if new_x >= x_max:
            new_x = x_max
            ds["dir"] = -1
            ds["sweep_y"] = min(sweep_y + 8.0, y_max)
        elif new_x <= x_min:
            new_x = x_min
            ds["dir"] = 1
            ds["sweep_y"] = min(sweep_y + 8.0, y_max)
        drone.x = max(x_min, min(x_max, new_x))

    drone.miles_flown += step
    state.visited_coords.add((round(drone.x), round(drone.y)))


def _algo_triangulation(drone: LucasDrone, state: SimState) -> None:
    """Spread drones across revealed radars by index for angular coverage."""
    alive_radar_ids = {r.id for r in state.radars if not r.destroyed}
    candidates = [
        (rx, ry)
        for rid, (rx, ry) in state.revealed_radar_positions.items()
        if rid in alive_radar_ids
    ]
    if not candidates:
        _move_drone_direction(drone, state)
        return
    try:
        idx = int(drone.id.rsplit("_", 1)[-1]) - 1
    except (ValueError, IndexError):
        idx = 0
    tx, ty = candidates[idx % len(candidates)]
    _move_drone_to_point(drone, tx, ty, state)


def _algo_hotspot_reinforce(drone: LucasDrone, state: SimState) -> None:
    """All drones rush to the closest revealed alive radar."""
    alive_radar_ids = {r.id for r in state.radars if not r.destroyed}
    candidates = [
        (rx, ry)
        for rid, (rx, ry) in state.revealed_radar_positions.items()
        if rid in alive_radar_ids
    ]
    if not candidates:
        _move_drone_direction(drone, state)
        return
    tx, ty = min(candidates, key=lambda p: _dist(drone.x, drone.y, p[0], p[1]))
    _move_drone_to_point(drone, tx, ty, state)


def _algo_scout_fix_finish(drone: LucasDrone, state: SimState) -> None:
    """Bait fans out normally; receivers hold until at least one radar is confirmed."""
    if drone.drone_type == "bait":
        _move_drone_direction(drone, state)
        return
    alive_radar_ids = {r.id for r in state.radars if not r.destroyed}
    candidates = [
        (rx, ry)
        for rid, (rx, ry) in state.revealed_radar_positions.items()
        if rid in alive_radar_ids
    ]
    if not candidates:
        return  # Receivers hold position until a radar is confirmed
    tx, ty = min(candidates, key=lambda p: _dist(drone.x, drone.y, p[0], p[1]))
    _move_drone_to_point(drone, tx, ty, state)


def _move_drone_by_algorithm(drone: LucasDrone, state: SimState) -> None:
    """Dispatch movement to the active algorithm handler."""
    algo = state.algorithm

    if algo == "meta_selector":
        # Phase transition: switch to hotspot reinforce when first radar is revealed
        if state.algorithm_state.get("__meta_phase") == "grid_sweep" and state.revealed_radar_positions:
            state.algorithm_state["__meta_phase"] = "hotspot"
        if state.algorithm_state.get("__meta_phase") == "grid_sweep":
            _algo_grid_sweep(drone, state)
        else:
            _algo_hotspot_reinforce(drone, state)
        return

    _FN = {
        "grid_sweep":        _algo_grid_sweep,
        "spiral_outward":    _algo_spiral_outward,
        "saturation_fan":    _move_drone_direction,
        "bait_ladder":       _algo_bait_ladder,
        "reload_trap":       _algo_reload_trap,
        "multi_azimuth":     _move_drone_direction,
        "random_walk":       _algo_random_walk,
        "sector_claim":      _algo_sector_claim,
        "triangulation":     _algo_triangulation,
        "hotspot_reinforce": _algo_hotspot_reinforce,
        "scout_fix_finish":  _algo_scout_fix_finish,
    }
    _FN.get(algo, _move_drone_direction)(drone, state)


# ---------------------------------------------------------------------------
# Core simulation tick
# ---------------------------------------------------------------------------

def advance_tick(state: SimState) -> list[dict]:
    """
    Advance the simulation by exactly one minute.

    Tick order:
      1. Move all alive LUCAS drones (per-type rules override the algorithm):
           - Bait drones:   follow the active algorithm.
           - Strike drones: home in on the nearest revealed alive radar;
                            fall back to current heading if none is known yet.
           - Camera drones: scan for the nearest target within camera range and
                            fly toward it; fall back to current heading if none.
      2. Radar sight-range check → ping only when drones are in range.
         Reveals radar position and enables strike-drone lock-on.
      3. SAM launcher independent engagement: each launcher fires at the nearest
         drone within its own range (independent of radar detection).
      4. Contact destructions:
           - Drone reaches radar      → radar destroyed, drone dies
           - Drone reaches launcher   → launcher destroyed, drone dies
           - Drone reaches gas target → gas destroyed, drone survives
      5. Check completion (tick ≥ 60)
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
    # Camera drones: rescan for nearest target within detection range each tick.
    for drone in alive_drones:
        if drone.drone_type == "camera" and drone.camera_on:
            # Skip scan while still in launch-delay window.
            if state.tick < state.algorithm_state.get(drone.id, {}).get("start_tick", 0):
                continue
            nearest: Optional[tuple[float, float]] = None
            nearest_d = float("inf")
            for tgt in (*alive_radars, *alive_launchers, *alive_gas):
                d = _dist(drone.x, drone.y, tgt.x, tgt.y)
                if d <= CAMERA_DRONE_RANGE and d < nearest_d:
                    nearest_d = d
                    nearest = (tgt.x, tgt.y)
            drone.target_x = nearest[0] if nearest else None
            drone.target_y = nearest[1] if nearest else None

    for drone in alive_drones:
        # Respect per-drone launch delay (bait vanguard algorithms).
        if state.tick < state.algorithm_state.get(drone.id, {}).get("start_tick", 0):
            continue

        if drone.drone_type == "bait":
            _move_drone_by_algorithm(drone, state)
        elif drone.drone_type == "radar_receiver":
            # Strike drone: home in on the nearest revealed alive radar.
            # Falls back to the overall algorithm when no radar is known or all known
            # radars have been destroyed — unless a new ping reveals another target,
            # which repopulates candidates and re-engages the intercept next tick.
            alive_radar_ids = {r.id for r in state.radars if not r.destroyed}
            candidates = [
                (rx, ry)
                for rid, (rx, ry) in state.revealed_radar_positions.items()
                if rid in alive_radar_ids
            ]
            if candidates:
                stx, sty = min(candidates, key=lambda p: _dist(drone.x, drone.y, p[0], p[1]))
                _move_drone_to_point(drone, stx, sty, state)
            else:
                _move_drone_by_algorithm(drone, state)
        else:  # camera
            # Camera drone: fly toward nearest in-range target.
            # Falls back to the overall algorithm when nothing is in sensor range —
            # unless a new target enters range next tick, which re-engages pursuit.
            if drone.target_x is not None:
                _move_drone_to_point(drone, drone.target_x, drone.target_y, state)  # type: ignore[arg-type]
            else:
                _move_drone_by_algorithm(drone, state)

    # --- 2. Radar pings ---
    # A radar only pings (and reveals itself) when at least one drone is within range.
    alive_drones_now = [d for d in state.lucas_drones if d.alive]

    for radar in alive_radars:
        if not _radar_is_on(radar, state.tick):
            continue

        drones_in_sight = [
            d for d in alive_drones_now
            if _dist(radar.x, radar.y, d.x, d.y) <= state.radar_sight
        ]
        if not drones_in_sight:
            continue

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

    # --- 3. SAM launcher independent engagement ---
    # Each launcher autonomously fires at the nearest drone within its own range.
    for launcher in alive_launchers:
        if launcher.missiles_remaining <= 0:
            continue
        in_range = [
            d for d in alive_drones_now
            if _dist(launcher.x, launcher.y, d.x, d.y) <= state.missile_fire_range
        ]
        if not in_range:
            continue
        target_drone = min(in_range, key=lambda d: _dist(launcher.x, launcher.y, d.x, d.y))
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

    # --- 4. Contact destructions ---
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

        # Launcher contact: only bait drones destroy launchers (strike drones ignore them)
        for launcher in alive_launchers:
            if drone.drone_type == "radar_receiver":
                continue
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

        # Gas target: drone destroys target and dies
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
                drone.alive = False
                break

    # --- 5. Completion check ---
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
        v: dict = {
            "id": d.id,
            "type": d.drone_type,
            "x": round(d.x, 2),
            "y": round(d.y, 2),
            "alive": d.alive,
            "miles_flown": round(d.miles_flown, 2),
        }
        if d.drone_type == "camera":
            v["camera_on"] = d.camera_on
        return v

    return {
        "tick": state.tick,
        "score": state.score,
        "complete": state.complete,
        "algorithm": state.algorithm,
        "defense_algorithm": state.defense_algorithm,
        "radar_sight": state.radar_sight,
        "missile_fire_range": state.missile_fire_range,
        "camera_drone_range": CAMERA_DRONE_RANGE,
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
