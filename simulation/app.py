from flask import Flask, jsonify, request
from flask_cors import CORS

from simulation import run_simulation

app = Flask(__name__)
CORS(app)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/simulate", methods=["POST"])
def simulate():
    body = request.get_json(force=True)

    # TODO: validate / parse body fields into SimulationConfig
    config = body

    result = run_simulation(config)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
