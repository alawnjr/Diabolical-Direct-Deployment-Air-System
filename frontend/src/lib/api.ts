import type { GameState } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export async function healthCheck(): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return true;
    } catch {
      // connection refused or timeout — wait before retrying
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

export async function startSim(
  numBait = 10,
  numReceiver = 10,
  radarSight = 100,
  samRange = 25,
  numRadars = 6,
  numLaunchers = 6,
  numGas = 4,
): Promise<GameState> {
  const res = await fetch(`${API_BASE}/api/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      num_bait: numBait,
      num_receiver: numReceiver,
      radar_sight: radarSight,
      missile_fire_range: samRange,
      num_radars: numRadars,
      num_launchers: numLaunchers,
      num_gas: numGas,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `start failed: ${res.status}`);
  }
  return res.json();
}

export async function tickSim(ticks = 1): Promise<{ ticked: number; state: GameState }> {
  const res = await fetch(`${API_BASE}/api/tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticks }),
  });
  if (!res.ok) throw new Error(`tick failed: ${res.status}`);
  return res.json();
}

export async function runSim(): Promise<GameState> {
  const res = await fetch(`${API_BASE}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`run failed: ${res.status}`);
  return res.json();
}

export async function getSimState(): Promise<GameState> {
  const res = await fetch(`${API_BASE}/api/state`);
  if (!res.ok) throw new Error(`state failed: ${res.status}`);
  return res.json();
}
