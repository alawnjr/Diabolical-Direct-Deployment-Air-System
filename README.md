# D³AS — Data Driven Distributed Autonomous Systems

A wargaming simulator for **Suppression / Destruction of Enemy Air Defenses (SEAD/DEAD)** using autonomous drone swarms. Built for the SCSP Hackathon 2026 · Wargaming Track.

---

## Overview

D³AS lets you configure and launch swarms of autonomous LUCAS drones against a randomised enemy Integrated Air Defense System (IADS). The backend runs a physics-accurate simulation engine; the frontend provides a real-time tactical map with live event feeds, BDA panels, and 12 selectable movement algorithms.

**Drone types**
| Type | Role |
|---|---|
| Bait LUCAS | Fast (200 mph) decoy — drains SAM magazines |
| LUCAS Strike | Radar receiver — homes on emitters and destroys them |
| Camera Drone | ISR platform — scans 30 NM, locks and strikes any target |

**Enemy systems**
| System | Behaviour |
|---|---|
| EWR Radar | 30-tick power cycle (on 5 ticks, off 25); reveals drone positions on ping |
| SAM Launcher | Radar-cued; 2 missiles, 90% hit probability, 25 NM engagement radius |
| Fuel Target | Static supply depot — bonus strike target |

---

## Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10 or later |
| Node.js | 18 or later |
| npm | 9 or later |

---

## Launch Tutorial

Both the **backend** and **frontend** must run simultaneously in separate terminals.

### 1 — Backend (Flask simulation engine)

```bash
# Navigate to the simulation directory
cd simulation

# Create and activate a virtual environment (first time only)
python -m venv venv

# Activate — Windows Command Prompt / PowerShell
venv\Scripts\activate

# Activate — macOS / Linux
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the Flask server
python app.py
```

The backend will start on **http://localhost:5000**. You should see:

```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

Leave this terminal running.

---

### 2 — Frontend (Next.js UI)

Open a **second terminal**:

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

The frontend will start on **http://localhost:3000**.

---

### 3 — Open in browser

Navigate to **http://localhost:3000**

The top-right status indicator will show **BACKEND ONLINE** (green) once the frontend successfully connects to the Flask API. If it shows **BACKEND OFFLINE**, make sure the Flask server is running and try the **↺ RETRY CONNECTION** button.

---

## Usage

1. **ASSET CONFIGURATION** (left panel) — set drone counts, radar/SAM ranges, enemy composition, and movement algorithm.
2. Click **▶ LAUNCH ALL** to initialise and immediately begin execution, or **⬡ INITIALIZE ONLY** to review the map before committing.
3. During execution, click **⚡ FULL RUN** to skip to tick 60, or let it animate tick-by-tick.
4. The **MISSION COMPLETE** overlay shows destruction rate, targets destroyed, and drones lost.
5. Click **↩ NEW SCENARIO** to reset and try a different configuration.

### Movement Algorithms

Click **? ALGORITHM TECHNIQUES** in the sidebar for a full description of all 12 algorithms. The default (**Meta Selector**) runs Grid Sweep until a radar is detected, then switches to Hotspot Reinforce.

---

## Project Structure

```
.
├── simulation/          # Python Flask backend
│   ├── app.py           # REST API (Flask)
│   ├── simulation.py    # Core simulation engine + 12 algorithms
│   └── requirements.txt
└── frontend/            # Next.js frontend
    └── src/
        ├── app/         # Next.js App Router pages
        ├── components/  # UI components (TacticalMap, AssetPalette, …)
        └── lib/         # Types, API client, constants
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness probe |
| `POST` | `/api/start` | Initialise a new simulation |
| `POST` | `/api/tick` | Advance N ticks |
| `POST` | `/api/run` | Run to completion (tick 60) |
| `GET` | `/api/state` | Current simulation state |
| `POST` | `/api/camera_toggle` | Toggle camera drone scanning |

---

*EXERCISE // UNCLASSIFIED // FOR TRAINING PURPOSES ONLY*
