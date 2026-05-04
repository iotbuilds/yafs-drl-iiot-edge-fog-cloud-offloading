"""Generate 7S industrial readings and classify each event into confirmed 3L levels."""
from __future__ import annotations
import random
from typing import Dict, List
import networkx as nx

from config import SENSOR_TYPES, DEADLINES, EVENT_INTERVAL, SEED, TRANSFER_RULES
from sensor_thresholds import classify, unit

_VALUE_RANGES = {
    "vibration": (0.0, 10.5),
    "temperature": (25.0, 105.0),
    "pressure": (1.0, 12.0),
    "current": (2.0, 25.0),
    "acoustic": (35.0, 95.0),
    "flow_rate": (10.0, 135.0),
    "humidity": (10.0, 92.0),
}

class EventGenerator:
    def __init__(self, graph: nx.Graph, seed: int = SEED):
        self.graph = graph
        self.rng = random.Random(seed)
        self.event_counter = 0
        self.sensor_nodes = [n for n, d in graph.nodes(data=True) if d.get("layer") == "sensor"]
        if len(self.sensor_nodes) != 700:
            raise ValueError(f"Confirmed requirements require 700 sensor nodes; found {len(self.sensor_nodes)}")

    def generate_step(self, step: int, events_per_step: int) -> List[dict]:
        now = step * EVENT_INTERVAL
        selected = self.rng.sample(self.sensor_nodes, k=min(events_per_step, len(self.sensor_nodes)))
        return [self._make_event(node_id=n, timestamp=now) for n in selected]

    def _make_event(self, node_id: str, timestamp: float) -> dict:
        nd = self.graph.nodes[node_id]
        dominant = nd.get("sensor_type") or self.rng.choice(SENSOR_TYPES)
        readings = self._generate_7s_values(dominant)
        statuses = {name: classify(name, value) for name, value in readings.items()}
        severity = self._overall_severity(statuses)
        task_size = self._task_size(severity)
        event = {
            "event_id": f"evt_{self.event_counter:08d}",
            "node_id": node_id,
            "edge_gateway": self._nearest_edge(node_id),
            "dominant_sensor_type": dominant,
            "sensor_type": dominant,
            "reading_value": readings[dominant],
            "unit": unit(dominant),
            "timestamp": timestamp,
            "severity": severity,
            "event_level_3l": severity,
            "deadline": DEADLINES[severity],
            "transfer_rule": TRANSFER_RULES[severity],
            "task_size_kb": task_size,
            "priority": {"normal": "low", "warning": "medium", "critical": "high"}[severity],
            "condition_triggered_at": timestamp,
            "status_rule": self._status_rule(severity),
            "stress_scenario": self._stress_scenario(severity),
            "event_reason": self._event_reason(statuses, dominant),
            **{f"reading_{k}": v for k, v in readings.items()},
            **{f"status_{k}": v for k, v in statuses.items()},
        }
        self.event_counter += 1
        return event

    def _generate_7s_values(self, dominant: str) -> Dict[str, float]:
        values: Dict[str, float] = {}
        for sensor_type in SENSOR_TYPES:
            lo, hi = _VALUE_RANGES[sensor_type]
            mode = (lo + hi) / 2
            # Dominant sensor has wider variability; other readings still exist as context.
            if sensor_type == dominant:
                value = self.rng.triangular(lo, hi, mode)
            else:
                value = self.rng.triangular(lo, hi, lo + (hi - lo) * 0.38)
            values[sensor_type] = round(value, 3)
        return values

    def _overall_severity(self, statuses: Dict[str, str]) -> str:
        if "critical" in statuses.values():
            return "critical"
        if "warning" in statuses.values():
            return "warning"
        return "normal"

    def _nearest_edge(self, sensor_node: str) -> str:
        neighbors = list(self.graph.neighbors(sensor_node))
        edges = [n for n in neighbors if self.graph.nodes[n].get("layer") == "edge"]
        return edges[0] if edges else neighbors[0]

    def _task_size(self, severity: str) -> int:
        base = {"normal": 64, "warning": 128, "critical": 256}[severity]
        return int(base * self.rng.uniform(0.8, 1.4))

    def _status_rule(self, severity: str) -> str:
        return TRANSFER_RULES[severity]

    def _stress_scenario(self, severity: str) -> str:
        # Force limited fog-to-fog validation cases without creating a fourth event level.
        if self.event_counter > 0 and self.event_counter % 75 == 0 and severity in {"warning", "critical"}:
            return "force_fog_to_fog"
        return "none"

    def _event_reason(self, statuses: Dict[str, str], dominant: str) -> str:
        abnormal = [k for k, v in statuses.items() if v in {"warning", "critical"}]
        if not abnormal:
            return "all_7s_readings_within_normal_range"
        return f"{','.join(abnormal)} abnormal; dominant={dominant}"
