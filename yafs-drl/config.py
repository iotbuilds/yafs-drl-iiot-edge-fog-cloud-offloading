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

# DRL task deadlines are simulation processing targets.
DEADLINES = {
    "critical": 10.0,
    "warning": 30.0,
    "normal": 300.0,
}

# Confirmed 3L cloud transmission/update policy.
CLOUD_TRANSMISSION_INTERVALS = {
    "critical": 60.0,
    "warning": 180.0,
    "normal": 300.0,
}

TRANSFER_RULES = {
    "critical": "cloud_update_every_1_minute",
    "warning": "cloud_update_every_3_minutes",
    "normal": "edge_aggregated_normal_summary_every_5_minutes",
}
EVENT_INTERVAL = 60.0
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
    reliability: float = 0.05

# Severity is not a 7F factor; it changes urgency/deadline/reward weighting.
SEVERITY_WEIGHTS = {
    "normal": FactorWeights(delay=0.14, hops=0.10, congestion=0.16, energy=0.25, task_size=0.10, bandwidth=0.14, compute=0.08, reliability=0.03),
    "warning": FactorWeights(delay=0.23, hops=0.12, congestion=0.20, energy=0.13, task_size=0.10, bandwidth=0.13, compute=0.09, reliability=0.05),
    "critical": FactorWeights(delay=0.34, hops=0.12, congestion=0.19, energy=0.05, task_size=0.08, bandwidth=0.15, compute=0.08, reliability=0.09),
}

DRL_ACTIONS = ["local_edge", "edge_to_edge", "edge_to_fog", "fog_to_fog", "cloud_escalation"]
BASELINE_POLICIES = ["local_only", "edge_only", "cloud_only", "random", "rule_based_static_cloud_fog"]

KPI_10P = [
    "latency", "energy_consumption", "deadline_success_rate", "throughput",
    "network_overhead_bytes", "offloading_ratio_path_distribution",
    "congestion_score", "drl_model_efficiency", "scalability_performance",
    "fairness_load_balancing",
]
