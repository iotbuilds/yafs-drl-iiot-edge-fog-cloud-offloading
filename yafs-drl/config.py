"""Central confirmed configuration for the IIoT DRL/YAFS simulation.

This file follows DRL_IIoT_Confirmed_Requirements.docx:
- 1000 nodes = 700 sensors, 220 edge, 79 fog, 1 cloud
- 7S sensor readings only on sensor/event-generating nodes
- 3L event levels only: normal, warning, critical
- 7F DRL decision factors
- 10,000 final events by default
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path

SEED = 42
TOTAL_NODES = 1000
NODE_SPLIT = {
    "sensor": 700,
    "edge": 220,
    "fog": 79,
    "cloud": 1,
    "dashboard": 0,
}

SENSOR_TYPES = [
    "vibration", "temperature", "pressure", "current", "acoustic", "flow_rate", "humidity"
]

# Dominant 7S category distribution across 700 sensor nodes.
SENSOR_DISTRIBUTION = {
    "vibration": 120,
    "temperature": 120,
    "pressure": 100,
    "current": 100,
    "acoustic": 100,
    "flow_rate": 80,
    "humidity": 80,
}

EVENT_LEVELS = ["normal", "warning", "critical"]

# Confirmed 3L timing rules. Critical/Warning are event-triggered; Normal is periodic.
DEADLINES = {
    "critical": 10.0,
    "warning": 30.0,
    "normal": 120.0,  # 2 minutes for periodic monitoring/dashboard/cloud analytics summaries.
}
TRANSFER_RULES = {
    "critical": "event_triggered_immediate_priority_fastest_path_deadline_10s",
    "warning": "event_triggered_prompt_balanced_edge_fog_deadline_30s",
    "normal": "periodic_monitoring_summary_every_2_minutes",
}
EVENT_INTERVAL = 120.0
DEFAULT_STEPS = 100
EVENTS_PER_STEP = 100
FINAL_EVENT_COUNT = DEFAULT_STEPS * EVENTS_PER_STEP

ROOT = Path(__file__).resolve().parent
TOPOLOGY_DIR = ROOT / "topology"
RESULTS_DIR = ROOT / "results"
DASHBOARD_DIR = ROOT / "dashboard_exports"
GRAPHS_DIR = ROOT / "graphs"

@dataclass(frozen=True)
class FactorWeights:
    delay: float
    hops: float
    congestion: float
    energy: float
    task_size: float
    bandwidth: float
    compute: float

# Severity is not a 7F factor; it changes urgency/deadline/reward weighting.
SEVERITY_WEIGHTS = {
    "normal": FactorWeights(delay=0.14, hops=0.10, congestion=0.16, energy=0.25, task_size=0.10, bandwidth=0.14, compute=0.11),
    "warning": FactorWeights(delay=0.23, hops=0.12, congestion=0.20, energy=0.13, task_size=0.10, bandwidth=0.13, compute=0.14),
    "critical": FactorWeights(delay=0.34, hops=0.12, congestion=0.19, energy=0.05, task_size=0.08, bandwidth=0.15, compute=0.17),
}

DRL_ACTIONS = ["local_edge", "edge_to_edge", "edge_to_fog", "fog_to_fog", "cloud_escalation"]
BASELINE_POLICIES = ["local_only", "edge_only", "cloud_only", "random", "rule_based_static_cloud_fog"]

KPI_10P = [
    "latency", "energy_consumption", "deadline_success_rate", "throughput",
    "network_overhead_bytes", "offloading_ratio_path_distribution",
    "congestion_score", "drl_model_efficiency", "scalability_performance",
    "fairness_load_balancing",
]
