# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Flask simulation engine)
```bash
cd simulation
source venv/bin/activate          # create venv first if needed: python -m venv venv && pip install -r requirements.txt
python app.py                      # starts on http://localhost:5001
```

### Frontend (Next.js)
```bash
cd frontend
npm install                        # first time only; use --cache /tmp/npm-cache if npm cache perms fail
npm run dev                        # http://localhost:3000
npm run build                      # production build + type check
npx tsc --noEmit                   # type-check only
```

There are no tests. The build (`npm run build`) runs TypeScript and is the closest equivalent.

---

## Architecture

Two independent processes must run simultaneously. The frontend polls `/api/health` on mount with 3 retries; if the backend is unreachable it enters **standalone mode** using a TypeScript port of the simulation engine in `frontend/src/lib/simulation.ts`.

### Backend (`simulation/`)

- **`app.py`** — Flask REST API, single global `_sim: SimState`. One sim at a time; `POST /api/start` replaces any existing run.
- **`simulation.py`** — all physics, 12 attack algorithms, 10 defense placement algorithms, entity dataclasses.

**Port:** `5001` (set in `app.py` `__main__`; frontend `api.ts` defaults to `localhost:5001`; override with `NEXT_PUBLIC_API_URL`).

**Key simulation mechanics:**
- Map is 200×200 miles. All drones launch from (0, 0) — SW corner.
- Radar cycle: on for 5 ticks, off for 25 ticks (staggered by `power_offset`). Radars only emit (and only trigger events) during their ON window.
- SAM launchers are **always visible** (coordinates always in API response). Each launcher is co-located near its paired radar (`radar_id` field) within 10 NM.
- Launchers fire independently of radar state — they engage any drone in `missile_fire_range` with `MISSILE_HIT_RATE = 0.90` probability, consuming one of their 2 missiles.
- Drone types: `bait` (200 mph, draws fire), `radar_receiver` (300 mph, homes on revealed radars), `camera` (toggleable active scanning, 30 NM lock-on radius, kills any target on contact).
- `BAIT_HEAD_START = 8` ticks: for 6 named algorithms, bait drones launch 8 ticks before strike/camera drones.

**Attack algorithms** (12 total, selected per `algorithm` field on `SimState`): each algorithm implements `_algo_<name>(drone, state)` and moves the drone by calling `_move_drone_to_point`. The `meta_selector` runs `grid_sweep` until a radar is detected, then switches to `hotspot_reinforce`.

**Defense algorithms** (10 total, `defense_algorithm` on `SimState`): control how radars are placed on the map via `_defense_radar_positions(algorithm, num_radars)`. Launchers are placed near their paired radar, sometimes with a directional bias (`_launcher_preferred_angle`).

**`get_public_state` response shape** (what the frontend actually receives — note the docstring at the top of `app.py` is outdated):
```
radars:           { id, revealed, destroyed, value, x?, y? }  — x/y hidden until revealed
missile_launchers:{ id, x, y, missiles_remaining, destroyed, value }  — always visible
gas_targets:      { id, revealed, destroyed, value, x?, y? }
lucas_drones:     { id, type, x, y, alive, miles_flown, camera_on? }
```
Top-level also includes: `algorithm`, `defense_algorithm`, `radar_sight`, `missile_fire_range`, `camera_drone_range`.

---

### Frontend (`frontend/src/`)

**Next.js 16 App Router.** Before modifying routing, layouts, or caching: read the relevant guide in `node_modules/next/dist/docs/` — this version has breaking changes vs. earlier Next.js.

**State lives entirely in `app/game/page.tsx`** (a `'use client'` component). No global store. Key refs:
- `intervalRef` — the 600ms execution loop's `setInterval` handle.
- `phaseRef` — mirrors `phase` state so the async tick closure always sees the current phase.
- `perRadarDetectionsRef` — tracks which drone IDs each radar has detected, used to derive `detectedDroneIds` (drones currently inside a radar's sight cone).

**Coordinate system in TacticalMap:**
- SVG viewport is 600×600 px; 1 NM = 3 px.
- `tx(nm) = nm * 3`; `ty(nm) = 600 - nm * 3` — origin is bottom-left, Y-axis inverted.
- FEBA (Forward Edge of Battle Area) is a vertical dashed line at x = 80 NM → svgX = 240 px.

**Radar ping animations** use SVG `<animate>` elements. Each ping gets a unique `key` (includes `Math.random()`) to force React to mount a fresh DOM element and restart the SVG animation from scratch. Pings are removed from state after 2200ms.

**Event deduplication:** `processNewEvents` filters `state.events` for `e.tick > lastTickRef.current`, then advances `lastTickRef`. Events accumulate in `allEvents` array for the `MissionLog` — never reset during a run.

**`lib/simulation.ts`** is a TypeScript port of `simulation.py` for standalone mode. It diverges slightly (no bait head-start, simplified radar cycling) but produces the same `GameState` shape. When the backend is available, this file is not called.

**`NEXT_PUBLIC_API_URL`** env var overrides the backend base URL (default `http://localhost:5001`). Set it in `.env.local` if running on a non-standard port.

---

## Entity Type Discrepancy to Watch

The comment block at the top of `simulation/app.py` shows an **old** response format for `missile_launchers` (with `revealed`, `fired`). The actual `get_public_state` function and `frontend/src/lib/types.ts` both use the current format (`missiles_remaining`, `destroyed`, always-present `x`/`y`). Do not trust the docstring — read the `launcher_view` function and `MissileLauncherEntity` interface instead.
