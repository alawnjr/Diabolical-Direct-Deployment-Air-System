import type {
  GameState,
  SimEvent,
  RadarPingEvent,
  MissileFiredEvent,
  RadarDestroyedEvent,
  GasTargetDestroyedEvent,
} from './types';

const GRID_SIZE = 200;
const MAX_TICKS = 60;
const DRONE_SPEED = 5.0;
const MAX_FLIGHT = 300.0;
const RADAR_SIGHT = 100.0;
const RADAR_PING_INTERVAL = 30;
const MISSILE_FIRE_RANGE = 25.0;
const DESTROY_THRESHOLD = 3.0;
const RADAR_VALUE = 4;
const MISSILE_VALUE = 3;
const GAS_VALUE = 1;

interface IRadar {
  id: string; x: number; y: number; revealed: boolean; destroyed: boolean;
}
interface ILauncher {
  id: string; x: number; y: number; revealed: boolean; fired: boolean;
}
interface IGasTarget {
  id: string; x: number; y: number; revealed: boolean; destroyed: boolean;
}
interface IDrone {
  id: string; type: 'bait' | 'radar_receiver';
  x: number; y: number; alive: boolean; miles_flown: number;
}

export interface ISimState {
  tick: number;
  score: number;
  complete: boolean;
  radars: IRadar[];
  missile_launchers: ILauncher[];
  gas_targets: IGasTarget[];
  lucas_drones: IDrone[];
  events: SimEvent[];
  revealed_radar_positions: Record<string, [number, number]>;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function randomPositions(n: number, margin = 10, minSep = 20): [number, number][] {
  const pos: [number, number][] = [];
  let tries = 0;
  while (pos.length < n && tries < 100_000) {
    tries++;
    const x = margin + Math.random() * (GRID_SIZE - 2 * margin);
    const y = margin + Math.random() * (GRID_SIZE - 2 * margin);
    if (pos.every(([px, py]) => dist(x, y, px, py) >= minSep)) {
      pos.push([x, y]);
    }
  }
  return pos;
}

export function initClientSim(numBait = 10, numReceiver = 10): ISimState {
  const allPos = randomPositions(6 + 6 + 4);
  const radars: IRadar[] = allPos.slice(0, 6).map(([x, y], i) => ({
    id: `r${i + 1}`, x, y, revealed: false, destroyed: false,
  }));
  const missile_launchers: ILauncher[] = allPos.slice(6, 12).map(([x, y], i) => ({
    id: `ml${i + 1}`, x, y, revealed: false, fired: false,
  }));
  const gas_targets: IGasTarget[] = allPos.slice(12).map(([x, y], i) => ({
    id: `gt${i + 1}`, x, y, revealed: false, destroyed: false,
  }));

  const lucas_drones: IDrone[] = [
    ...Array.from({ length: numBait }, (_, i) => ({
      id: `bait_${i + 1}`, type: 'bait' as const, x: 0, y: 0, alive: true, miles_flown: 0,
    })),
    ...Array.from({ length: numReceiver }, (_, i) => ({
      id: `recv_${i + 1}`, type: 'radar_receiver' as const, x: 0, y: 0, alive: true, miles_flown: 0,
    })),
  ];

  return {
    tick: 0, score: 0, complete: false,
    radars, missile_launchers, gas_targets, lucas_drones,
    events: [], revealed_radar_positions: {},
  };
}

function droneTarget(drone: IDrone, state: ISimState): [number, number] {
  if (drone.type === 'bait') {
    const revealed = state.radars.filter(r => r.revealed && !r.destroyed);
    if (revealed.length > 0) {
      const best = revealed.reduce((a, b) =>
        dist(drone.x, drone.y, a.x, a.y) <= dist(drone.x, drone.y, b.x, b.y) ? a : b);
      return [best.x, best.y];
    }
    const aliveGas = state.gas_targets.filter(t => !t.destroyed);
    if (aliveGas.length > 0) {
      const best = aliveGas.reduce((a, b) =>
        dist(drone.x, drone.y, a.x, a.y) <= dist(drone.x, drone.y, b.x, b.y) ? a : b);
      return [best.x, best.y];
    }
    return [GRID_SIZE / 2, GRID_SIZE / 2];
  }

  const aliveRadarIds = new Set(state.radars.filter(r => !r.destroyed).map(r => r.id));
  const candidates = Object.entries(state.revealed_radar_positions)
    .filter(([id]) => aliveRadarIds.has(id))
    .map(([, pos]) => pos as [number, number]);

  if (candidates.length > 0) {
    return candidates.reduce((a, b) =>
      dist(drone.x, drone.y, a[0], a[1]) <= dist(drone.x, drone.y, b[0], b[1]) ? a : b);
  }
  return [GRID_SIZE / 2, GRID_SIZE / 2];
}

function moveDrone(drone: IDrone, tx: number, ty: number): void {
  const remaining = MAX_FLIGHT - drone.miles_flown;
  if (remaining <= 0) return;
  const dx = tx - drone.x, dy = ty - drone.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) return;
  const step = Math.min(DRONE_SPEED, d, remaining);
  const ratio = step / d;
  drone.x = Math.max(0, Math.min(GRID_SIZE - 1, drone.x + dx * ratio));
  drone.y = Math.max(0, Math.min(GRID_SIZE - 1, drone.y + dy * ratio));
  drone.miles_flown += step;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function advanceClientTick(state: ISimState): SimEvent[] {
  if (state.complete) return [];
  state.tick++;
  const tickEvents: SimEvent[] = [];

  const aliveDrones = state.lucas_drones.filter(d => d.alive);
  const aliveRadars = state.radars.filter(r => !r.destroyed);
  const unfired = state.missile_launchers.filter(ml => !ml.fired);
  const aliveGas = state.gas_targets.filter(t => !t.destroyed);

  for (const drone of aliveDrones) {
    moveDrone(drone, ...droneTarget(drone, state));
  }

  const aliveDronesNow = state.lucas_drones.filter(d => d.alive);
  const periodic = state.tick % RADAR_PING_INTERVAL === 0;
  for (const radar of aliveRadars) {
    const triggered = aliveDronesNow.some(d => dist(radar.x, radar.y, d.x, d.y) <= RADAR_SIGHT);
    if (periodic || triggered) {
      radar.revealed = true;
      state.revealed_radar_positions[radar.id] = [radar.x, radar.y];
      const ev: RadarPingEvent = {
        tick: state.tick, type: 'radar_ping',
        radar_id: radar.id, x: round2(radar.x), y: round2(radar.y),
      };
      tickEvents.push(ev);
      state.events.push(ev);
    }
  }

  let currentlyAlive = state.lucas_drones.filter(d => d.alive);
  for (const launcher of unfired) {
    const inRange = currentlyAlive.filter(d =>
      dist(launcher.x, launcher.y, d.x, d.y) <= MISSILE_FIRE_RANGE);
    if (inRange.length === 0) continue;
    const victim = inRange.reduce((a, b) =>
      dist(launcher.x, launcher.y, a.x, a.y) <= dist(launcher.x, launcher.y, b.x, b.y) ? a : b);
    victim.alive = false;
    launcher.fired = true;
    launcher.revealed = true;
    const ev: MissileFiredEvent = {
      tick: state.tick, type: 'missile_fired',
      launcher_id: launcher.id, target_drone_id: victim.id,
      launcher_x: round2(launcher.x), launcher_y: round2(launcher.y),
    };
    tickEvents.push(ev);
    state.events.push(ev);
    currentlyAlive = state.lucas_drones.filter(d => d.alive);
  }

  const surviving = state.lucas_drones.filter(d => d.alive);
  for (const drone of surviving) {
    if (drone.type === 'radar_receiver') {
      for (const radar of aliveRadars) {
        if (radar.destroyed) continue;
        if (dist(drone.x, drone.y, radar.x, radar.y) <= DESTROY_THRESHOLD) {
          radar.destroyed = true;
          radar.revealed = true;
          state.score += RADAR_VALUE;
          const ev: RadarDestroyedEvent = {
            tick: state.tick, type: 'radar_destroyed',
            radar_id: radar.id, drone_id: drone.id,
            score_gained: RADAR_VALUE, x: round2(radar.x), y: round2(radar.y),
          };
          tickEvents.push(ev);
          state.events.push(ev);
        }
      }
    }
    for (const gas of aliveGas) {
      if (gas.destroyed) continue;
      if (dist(drone.x, drone.y, gas.x, gas.y) <= DESTROY_THRESHOLD) {
        gas.destroyed = true;
        gas.revealed = true;
        state.score += GAS_VALUE;
        const ev: GasTargetDestroyedEvent = {
          tick: state.tick, type: 'gas_target_destroyed',
          target_id: gas.id, drone_id: drone.id,
          score_gained: GAS_VALUE, x: round2(gas.x), y: round2(gas.y),
        };
        tickEvents.push(ev);
        state.events.push(ev);
      }
    }
  }

  if (state.tick >= MAX_TICKS) state.complete = true;
  return tickEvents;
}

export function getPublicState(state: ISimState): GameState {
  return {
    tick: state.tick,
    score: state.score,
    complete: state.complete,
    drones_alive: state.lucas_drones.filter(d => d.alive).length,
    drones_total: state.lucas_drones.length,
    entities: {
      radars: state.radars.map(r => ({
        id: r.id, revealed: r.revealed, destroyed: r.destroyed, value: RADAR_VALUE,
        ...(r.revealed ? { x: round2(r.x), y: round2(r.y) } : {}),
      })),
      missile_launchers: state.missile_launchers.map(ml => ({
        id: ml.id, revealed: ml.revealed, fired: ml.fired, value: MISSILE_VALUE,
        ...(ml.revealed ? { x: round2(ml.x), y: round2(ml.y) } : {}),
      })),
      gas_targets: state.gas_targets.map(t => ({
        id: t.id, revealed: t.revealed, destroyed: t.destroyed, value: GAS_VALUE,
        ...(t.revealed ? { x: round2(t.x), y: round2(t.y) } : {}),
      })),
      lucas_drones: state.lucas_drones.map(d => ({
        id: d.id, type: d.type,
        x: round2(d.x), y: round2(d.y),
        alive: d.alive, miles_flown: round2(d.miles_flown),
      })),
    },
    events: state.events.slice(-100),
  };
}
