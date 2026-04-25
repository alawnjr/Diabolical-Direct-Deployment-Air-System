"""
D3AS — Diabolical Direct Deployment Air System
Flask REST API backend

All simulation state lives in the module-level `_sim` variable.
One simulation at a time; POST /api/start replaces any existing run.

Common response shape (SimStateResponse):
  {
    "tick":         int,   // current tick 0–60
    "score":        int,   // cumulative score
    "complete":     bool,  // true once tick 60 is reached
    "drones_alive": int,
    "drones_total": int,
    "entities": {
      "radars": [
        { "id": str, "revealed": bool, "destroyed": bool, "value": 4,
          "x"?: float, "y"?: float }        // x/y only present when revealed
      ],
      "missile_launchers": [
        { "id": str, "revealed": bool, "fired": bool, "value": 3,
          "x"?: float, "y"?: float }
      ],
      "gas_targets": [
        { "id": str, "revealed": bool, "destroyed": bool, "value": 1,
          "x"?: float, "y"?: float }
      ],
      "lucas_drones": [
        { "id": str, "type": "bait"|"radar_receiver",
          "x": float, "y": float, "alive": bool, "miles_flown": float }
      ]
    },
    "events": [                             // last 100 events, oldest-first
      { "tick": int, "type": "radar_ping",
        "radar_id": str, "x": float, "y": float },
      { "tick": int, "type": "missile_fired",
        "launcher_id": str, "target_drone_id": str,
        "launcher_x": float, "launcher_y": float },
      { "tick": int, "type": "radar_destroyed",
        "radar_id": str, "drone_id": str, "score_gained": int,
        "x": float, "y": float },
      { "tick": int, "type": "gas_target_destroyed",
        "target_id": str, "drone_id": str, "score_gained": int,
        "x": float, "y": float }
    ]
  }
"""

from __future__ import annotations

from typing import Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

from simulation import (
    SimState,
    advance_tick,
    get_public_state,
    initialize_sim,
    run_simulation,
    run_to_completion,
)

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
# In-memory simulation state (one active sim at a time)
# ---------------------------------------------------------------------------
_sim: Optional[SimState] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _no_sim_error():
    return jsonify({"error": "No simulation running. POST /api/start first."}), 400


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    """Liveness probe. Always returns 200."""
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# GET /api/state
#
# Returns the current simulation state.
# Adversary coordinates are omitted unless revealed=True.
#
# Response: SimStateResponse
# Error 400: { "error": str }  — no sim has been started
# ---------------------------------------------------------------------------
@app.route("/api/state", methods=["GET"])
def get_state():
    if _sim is None:
        return _no_sim_error()
    return jsonify(get_public_state(_sim))


# ---------------------------------------------------------------------------
# POST /api/start
#
# Initialise a fresh simulation (discards any current run).
#
# Request body (all fields optional, JSON):
#   {
#     "num_bait":     int   // bait-drone count      (default 10)
#     "num_receiver": int   // receiver-drone count  (default 10)
#   }
#
# Response: SimStateResponse at tick 0
# ---------------------------------------------------------------------------
@app.route("/api/start", methods=["POST"])
def start_sim():
    global _sim
    body        = request.get_json(silent=True) or {}
    num_bait    = int(body.get("num_bait",    10))
    num_receiver= int(body.get("num_receiver",10))
    _sim        = initialize_sim(num_bait, num_receiver)
    return jsonify(get_public_state(_sim))


# ---------------------------------------------------------------------------
# POST /api/tick
#
# Advance the running simulation by N ticks (default 1).
#
# Request body (all fields optional, JSON):
#   { "ticks": int }   // number of ticks to advance (default 1, min 1)
#
# Response:
#   {
#     "ticked": int,          // ticks actually advanced (may be < requested if sim ended)
#     "state": SimStateResponse
#   }
#
# Error 400: { "error": str }  — no sim running, or sim already complete
# ---------------------------------------------------------------------------
@app.route("/api/tick", methods=["POST"])
def tick_sim():
    global _sim
    if _sim is None:
        return _no_sim_error()
    if _sim.complete:
        return jsonify({"error": "Simulation already complete.", "state": get_public_state(_sim)}), 400

    body     = request.get_json(silent=True) or {}
    ticks    = max(1, int(body.get("ticks", 1)))
    advanced = 0

    for _ in range(ticks):
        if _sim.complete:
            break
        advance_tick(_sim)
        advanced += 1

    return jsonify({"ticked": advanced, "state": get_public_state(_sim)})


# ---------------------------------------------------------------------------
# POST /api/run
#
# Run the simulation from its current tick all the way to completion (tick 60).
# Safe to call on an already-complete sim — returns current state immediately.
#
# Request body: none
#
# Response: SimStateResponse (final state)
#
# Error 400: { "error": str }  — no sim running
# ---------------------------------------------------------------------------
@app.route("/api/run", methods=["POST"])
def run_sim():
    global _sim
    if _sim is None:
        return _no_sim_error()
    run_to_completion(_sim)
    return jsonify(get_public_state(_sim))


# ---------------------------------------------------------------------------
# POST /api/simulate
#
# One-shot convenience endpoint used by the existing frontend.
# Starts a fresh simulation internally and runs it for `steps` ticks (≤ 60),
# returning the full per-tick history.  Does NOT affect the global _sim used
# by /api/start, /api/tick, and /api/run.
#
# Request body (JSON):
#   {
#     "steps":        int   // ticks to run          (default 10, max 60)
#     "num_bait":     int   // bait-drone count      (default 10)
#     "num_receiver": int   // receiver-drone count  (default 10)
#   }
#
# Response:
#   {
#     "steps":   int,      // number of ticks actually run
#     "results": [
#       {
#         "step":  int,          // tick number (1-based)
#         "state": SimStateResponse
#       },
#       ...
#     ]
#   }
# ---------------------------------------------------------------------------
@app.route("/api/simulate", methods=["POST"])
def simulate():
    body   = request.get_json(force=True, silent=True) or {}
    result = run_simulation(body)
    return jsonify(result)


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)
