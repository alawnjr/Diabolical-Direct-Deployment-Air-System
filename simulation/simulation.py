from dataclasses import dataclass, field
from typing import Any


@dataclass
class SimulationConfig:
    # TODO: replace with real parameters
    steps: int = 100
    params: dict[str, Any] = field(default_factory=dict)


def run_simulation(config: dict[str, Any]) -> dict[str, Any]:
    cfg = SimulationConfig(**{k: v for k, v in config.items() if k in SimulationConfig.__dataclass_fields__})

    # TODO: implement simulation logic
    results = []
    state: dict[str, Any] = {}

    for step in range(cfg.steps):
        state = _step(state, step, cfg)
        results.append({"step": step, "state": state})

    return {"steps": cfg.steps, "results": results}


def _step(state: dict[str, Any], step: int, cfg: SimulationConfig) -> dict[str, Any]:
    # TODO: implement per-step logic
    return {**state, "t": step}
