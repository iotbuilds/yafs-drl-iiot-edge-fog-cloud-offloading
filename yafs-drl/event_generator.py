"""Generate 7S industrial readings and classify each event into confirmed 3L levels."""
from __future__ import annotations
from collections import defaultdict, deque
import random
from typing import Dict, List
import networkx as nx

from config import SENSOR_TYPES, DEADLINES, EVENT_INTERVAL, SEED, TRANSFER_RULES
from sensor_thresholds import THRESHOLDS, classify, unit

_VALUE_RANGES = {
    "vibration": (0.0, 10.5),
    "temperature": (25.0, 105.0),
    "pressure": (1.0, 12.0),
    "current": (2.0, 25.0),
    "acoustic": (35.0, 95.0),
    "flow_rate": (10.0, 135.0),
    "humidity": (10.0, 92.0),
}

_SEVERITY_PAYLOAD_PROFILE_KB = {
    "normal": {
        "event_metadata": 0.8,
        "sensor_sample_window": 6.0,
        "waveform_fault_window": 0.0,
        "diagnostic_logs": 1.5,
        "machine_context": 2.0,
        "calculated_features": 2.0,
        "device_security_metadata": 1.2,
    },
    "warning": {
        "event_metadata": 1.2,
        "sensor_sample_window": 18.0,
        "waveform_fault_window": 8.0,
        "diagnostic_logs": 4.0,
        "machine_context": 3.0,
        "calculated_features": 3.5,
        "device_security_metadata": 1.8,
    },
    "critical": {
        "event_metadata": 1.6,
        "sensor_sample_window": 42.0,
        "waveform_fault_window": 24.0,
        "diagnostic_logs": 8.0,
        "machine_context": 4.5,
        "calculated_features": 5.0,
        "device_security_metadata": 2.5,
    },
}

_PROTOCOL_OVERHEAD_BASE_KB = {
    "normal": 3.0,
    "warning": 5.0,
    "critical": 8.0,
}

_SENSOR_PAYLOAD_MULTIPLIER = {
    "vibration": 1.18,
    "current": 1.14,
    "acoustic": 1.10,
    "pressure": 1.04,
    "flow_rate": 1.02,
    "temperature": 0.94,
    "humidity": 0.90,
}

_CPU_CYCLES_PER_KB = {
    "normal": 900_000,
    "warning": 1_300_000,
    "critical": 1_800_000,
}

_COMPUTE_STAGE_WEIGHTS = {
    "normal": {
        "intake_validation": 0.10,
        "threshold_classification": 0.24,
        "feature_extraction": 0.26,
        "history_analysis": 0.08,
        "aggregation": 0.05,
        "cloud_analytics": 0.02,
        "decision_packaging": 0.25,
    },
    "warning": {
        "intake_validation": 0.07,
        "threshold_classification": 0.18,
        "feature_extraction": 0.30,
        "history_analysis": 0.16,
        "aggregation": 0.08,
        "cloud_analytics": 0.04,
        "decision_packaging": 0.17,
    },
    "critical": {
        "intake_validation": 0.05,
        "threshold_classification": 0.12,
        "feature_extraction": 0.30,
        "history_analysis": 0.20,
        "aggregation": 0.09,
        "cloud_analytics": 0.12,
        "decision_packaging": 0.12,
    },
}

class EventGenerator:
    def __init__(self, graph: nx.Graph, seed: int = SEED):
        self.graph = graph
        self.rng = random.Random(seed)
        self.event_counter = 0
        self.history = defaultdict(lambda: deque(maxlen=12))
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
        history = list(self.history[node_id])
        reading = self._generate_sensor_value(dominant, history)
        status = classify(dominant, reading)
        validation = self._validate_event(node_id, timestamp, dominant, reading)
        features = self._extract_features(reading, history, dominant)
        anomaly = self._analyze_history(status, features)
        severity = self._event_severity(status, anomaly)
        statuses = {dominant: severity}
        payload_profile = self._payload_profile(severity, statuses, dominant)
        event = {
            "event_id": f"evt_{self.event_counter:08d}",
            "node_id": node_id,
            "edge_gateway": self._nearest_edge(node_id),
            "dominant_sensor_type": dominant,
            "sensor_type": dominant,
            "reading_value": reading,
            "unit": unit(dominant),
            "current_status": status,
            "history_window_size": len(history),
            "history_values": [round(value, 3) for value in history[-12:]],
            "timestamp": timestamp,
            "severity": severity,
            "event_level_3l": severity,
            "deadline": DEADLINES[severity],
            "transfer_rule": TRANSFER_RULES[severity],
            **validation,
            **features,
            **anomaly,
            **payload_profile,
            "priority": {"normal": "low", "warning": "medium", "critical": "high"}[severity],
            "condition_triggered_at": timestamp,
            "status_rule": self._status_rule(severity),
            "stress_scenario": self._stress_scenario(severity),
            "event_reason": self._event_reason(statuses, dominant),
            **{f"reading_{k}": (reading if k == dominant else None) for k in SENSOR_TYPES},
            **{f"status_{k}": (severity if k == dominant else "not_measured") for k in SENSOR_TYPES},
        }
        self.history[node_id].append(reading)
        self.event_counter += 1
        return event

    def _generate_sensor_value(self, sensor_type: str, history: List[float]) -> float:
        lo, hi = _VALUE_RANGES[sensor_type]
        mode = (lo + hi) / 2
        if not history:
            return round(self.rng.triangular(lo, hi, mode), 3)
        previous = history[-1]
        drift = (hi - lo) * self.rng.uniform(-0.08, 0.08)
        if self.rng.random() < 0.12:
            drift += (hi - lo) * self.rng.choice([-1, 1]) * self.rng.uniform(0.12, 0.28)
        value = max(lo, min(hi, previous + drift))
        return round(value, 3)

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

    def _validate_event(self, node_id: str, timestamp: float, sensor_type: str, value: float) -> dict:
        missing = [] if value is not None and sensor_type else ["reading_value"]
        invalid = []
        lo, hi = _VALUE_RANGES[sensor_type]
        if value is None or not lo <= value <= hi:
            invalid.append(sensor_type)
        is_valid = not missing and not invalid and bool(node_id) and timestamp >= 0
        return {
            "validation_passed": is_valid,
            "validation_missing_fields": ",".join(missing) if missing else "none",
            "validation_invalid_readings": ",".join(invalid) if invalid else "none",
            "validation_score": round(1.0 - (len(missing) + len(invalid)) / 3.0, 4),
        }

    def _extract_features(self, value: float, history: List[float], sensor_type: str) -> dict:
        window = history[-11:] + [value]
        historical = history[-12:]
        baseline = sum(historical) / len(historical) if historical else value
        previous = historical[-1] if historical else value
        delta = value - previous
        historical_min = min(historical) if historical else value
        historical_max = max(historical) if historical else value
        avg = sum(window) / len(window)
        variance = sum((item - avg) ** 2 for item in window) / len(window) if window else 0.0
        std = variance ** 0.5
        deviation = self._normalized_deviation(sensor_type, value)
        spike_score = self._spike_score(sensor_type, value, baseline, previous, std)
        trend_score, trend_direction = self._trend(window)
        volatility_score = self._volatility_score(sensor_type, std)
        severity_score = min(1.0, deviation * 0.45 + spike_score * 0.25 + trend_score * 0.18 + volatility_score * 0.12)
        return {
            "feature_avg_reading": round(avg, 4),
            "feature_min_reading": round(min(window), 4),
            "feature_max_reading": round(max(window), 4),
            "feature_reading_range": round(max(window) - min(window), 4),
            "feature_historical_avg": round(baseline, 4),
            "feature_historical_min": round(historical_min, 4),
            "feature_historical_max": round(historical_max, 4),
            "feature_historical_std": round(std, 4),
            "feature_previous_value_delta": round(delta, 4),
            "feature_avg_deviation": round(deviation, 4),
            "feature_max_deviation": round(deviation, 4),
            "feature_dominant_deviation": round(deviation, 4),
            "feature_max_deviation_sensor": sensor_type,
            "feature_abnormal_count": 1 if deviation > 0 else 0,
            "feature_critical_count": 0,
            "feature_warning_count": 0,
            "feature_spike_score": round(spike_score, 4),
            "feature_trend_score": round(trend_score, 4),
            "feature_trend_direction": trend_direction,
            "feature_volatility_score": round(volatility_score, 4),
            "feature_severity_score": round(severity_score, 4),
            "feature_extraction_algorithm": "single_sensor_history_threshold_spike_trend_statistics",
        }

    def _spike_score(self, sensor_type: str, value: float, baseline: float, previous: float, std: float) -> float:
        lo, hi = _VALUE_RANGES[sensor_type]
        span = max(hi - lo, 1.0)
        baseline_jump = abs(value - baseline) / span
        previous_jump = abs(value - previous) / span
        std_jump = abs(value - baseline) / max(std * 3.0, span * 0.05)
        return min(1.0, baseline_jump * 1.8 + previous_jump * 1.2 + std_jump * 0.35)

    def _trend(self, window: List[float]) -> tuple[float, str]:
        if len(window) < 4:
            return 0.0, "insufficient_history"
        half = len(window) // 2
        early = sum(window[:half]) / max(half, 1)
        late = sum(window[half:]) / max(len(window) - half, 1)
        span = max(max(window) - min(window), 1.0)
        score = min(1.0, abs(late - early) / span)
        if score < 0.08:
            return score, "stable"
        return score, "rising" if late > early else "falling"

    def _volatility_score(self, sensor_type: str, std: float) -> float:
        lo, hi = _VALUE_RANGES[sensor_type]
        return min(1.0, std / max((hi - lo) * 0.18, 1.0))

    def _normalized_deviation(self, sensor_type: str, value: float) -> float:
        threshold = THRESHOLDS[sensor_type]
        lo, hi = threshold.normal
        if lo <= value <= hi:
            return 0.0
        if value < lo:
            span = max(lo - _VALUE_RANGES[sensor_type][0], 1.0)
            return min(1.0, (lo - value) / span)
        span = max(_VALUE_RANGES[sensor_type][1] - hi, 1.0)
        return min(1.0, (value - hi) / span)

    def _analyze_history(self, status: str, features: dict) -> dict:
        threshold_weight = {"normal": 0.0, "warning": 0.45, "critical": 0.85}[status]
        anomaly_score = min(
            1.0,
            threshold_weight * 0.38 +
            features["feature_spike_score"] * 0.24 +
            features["feature_trend_score"] * 0.18 +
            features["feature_volatility_score"] * 0.10 +
            features["feature_dominant_deviation"] * 0.10,
        )
        patterns = []
        if features["feature_spike_score"] >= 0.45:
            patterns.append("spike")
        if features["feature_trend_direction"] in {"rising", "falling"} and features["feature_trend_score"] >= 0.20:
            patterns.append(f"{features['feature_trend_direction']}_trend")
        if features["feature_volatility_score"] >= 0.50:
            patterns.append("volatile")
        return {
            "history_anomaly_score": round(anomaly_score, 4),
            "history_anomaly_level": self._risk_level(anomaly_score),
            "history_active_patterns": ",".join(patterns) if patterns else "none",
            "history_algorithm": "same_sensor_spike_trend_volatility_analysis",
            "correlation_thermal_mechanical": False,
            "correlation_electrical_mechanical": False,
            "correlation_process_flow_pressure": False,
            "correlation_acoustic_mechanical": False,
            "correlation_active_patterns": ",".join(patterns) if patterns else "none",
            "correlation_score": round(anomaly_score, 4),
            "correlation_risk_level": self._risk_level(anomaly_score),
        }

    def _event_severity(self, threshold_status: str, anomaly: dict) -> str:
        if threshold_status == "critical" or anomaly["history_anomaly_score"] >= 0.78:
            return "critical"
        if threshold_status == "warning" or anomaly["history_anomaly_score"] >= 0.42:
            return "warning"
        return "normal"

    def _risk_level(self, score: float) -> str:
        if score >= 0.70:
            return "high"
        if score >= 0.35:
            return "medium"
        return "low"

    def _payload_profile(self, severity: str, statuses: Dict[str, str], dominant: str) -> dict:
        abnormal_count = sum(1 for status in statuses.values() if status in {"warning", "critical"})
        multiplier = _SENSOR_PAYLOAD_MULTIPLIER.get(dominant, 1.0)
        if abnormal_count > 1:
            multiplier += min(0.18, (abnormal_count - 1) * 0.03)
        components = {
            name: round(value * multiplier * self.rng.uniform(0.94, 1.08), 3)
            for name, value in _SEVERITY_PAYLOAD_PROFILE_KB[severity].items()
        }
        event_payload_kb = round(sum(components.values()), 3)
        protocol_security_overhead_kb = round(_PROTOCOL_OVERHEAD_BASE_KB[severity] + event_payload_kb * 0.04, 3)
        task_size_kb = round(event_payload_kb + protocol_security_overhead_kb, 3)
        task_cpu_cycles = int(task_size_kb * _CPU_CYCLES_PER_KB[severity])
        compute_stages = self._compute_stage_profile(severity, task_cpu_cycles)
        return {
            **{f"payload_{name}_kb": size for name, size in components.items()},
            "payload_abnormal_sensor_count": abnormal_count,
            "payload_dominant_sensor_multiplier": round(multiplier, 3),
            "event_payload_kb": event_payload_kb,
            "protocol_security_overhead_kb": protocol_security_overhead_kb,
            "task_size_kb": task_size_kb,
            "task_cpu_cycles": task_cpu_cycles,
            **compute_stages,
            "payload_model": "component_based_event_payload_plus_protocol_security_overhead",
            "compute_model": "stage_based_industrial_event_processing_cycles",
        }

    def _compute_stage_profile(self, severity: str, task_cpu_cycles: int) -> dict:
        weights = _COMPUTE_STAGE_WEIGHTS[severity]
        stage_cycles = {f"{name}_cycles": int(task_cpu_cycles * weight) for name, weight in weights.items()}
        assigned = sum(stage_cycles.values())
        stage_cycles["decision_packaging_cycles"] += task_cpu_cycles - assigned
        return stage_cycles

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
            return f"{dominant} reading within normal range"
        return f"{','.join(abnormal)} abnormal; dominant={dominant}"
