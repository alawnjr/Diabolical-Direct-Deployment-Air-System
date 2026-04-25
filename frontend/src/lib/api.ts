import type { GameState } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function startSim(numBait = 10, numReceiver = 10): Promise<GameState> {
  const res = await fetch(`${API_BASE}/api/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_bait: numBait, num_receiver: numReceiver }),
  });
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
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
