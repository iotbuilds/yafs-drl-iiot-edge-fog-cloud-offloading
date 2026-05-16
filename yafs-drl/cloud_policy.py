"""Cloud/API/dashboard policy for the single centralized cloud node.

Rules from confirmed requirements:
- Critical: event-triggered, immediate, target <= 10 seconds
- Warning: event-triggered, prompt, target <= 30 seconds
- Normal: periodic monitoring summary every 2 minutes
"""
from __future__ import annotations
from collections import Counter, defaultdict
from statistics import mean
from typing import List, Optional

class CloudPolicy:
    def __init__(self, normal_window_size: int = 250, warning_window_size: int = 100):
        self.normal_buffer: List[dict] = []
        self.warning_buffer: List[dict] = []
        self.critical_alerts: List[dict] = []
        self.timeline: List[dict] = []
        self.status_trace: List[dict] = []
        self.normal_window_size = normal_window_size
        self.warning_window_size = warning_window_size

    def handle(self, event: dict, decision: dict) -> Optional[dict]:
        severity = event["severity"]
        record = self._merge_event_decision(event, decision)
        if severity == "normal":
            self.normal_buffer.append(record)
            self._append_trace(event, decision, cloud_record_type="buffered_for_2min_summary", sent_to_cloud=False)
            return None
        if severity == "warning":
            self.warning_buffer.append(record)
            summary = self._summary("warning_summary", self.warning_buffer[-self.warning_window_size:], event, decision)
            self._append_trace(event, decision, cloud_record_type="warning_summary", sent_to_cloud=True)
            return summary
        if severity == "critical":
            alert = {"type": "critical_alert", **record, **self._delivery_fields(event, decision)}
            alert = self._with_monitoring_transfer(alert, "critical_alert")
            self.critical_alerts.append(alert)
            self._append_trace(event, decision, cloud_record_type="critical_alert", sent_to_cloud=True)
            return alert
        self._append_trace(event, decision, cloud_record_type="unknown", sent_to_cloud=False)
        return None

    def periodic_normal_summary(self, timestamp: float) -> Optional[dict]:
        window = self.normal_buffer[-self.normal_window_size:]
        if not window:
            return None
        counts_by_sensor = Counter(r["dominant_sensor_type"] for r in window)
        layers = Counter(r["selected_layer"] for r in window)
        paths = Counter(r["offloading_scenario"] for r in window)
        avg_by_sensor = defaultdict(list)
        for r in window:
            avg_by_sensor[r["dominant_sensor_type"]].append(float(r["reading_value"]))
        summary = {
            "type": "normal_summary",
            "severity": "normal",
            "timestamp": timestamp,
            "periodic_window": "2_minutes",
            "count": len(window),
            "sensor_counts": dict(counts_by_sensor),
            "avg_reading_by_sensor": {k: round(mean(v), 4) for k, v in avg_by_sensor.items()},
            "offloading_ratio": dict(layers),
            "path_distribution": dict(paths),
            "avg_latency": round(mean(float(r.get("estimated_delay", 0)) for r in window), 4),
            "avg_energy_cost": round(mean(float(r.get("factor_energy_cost", 0)) for r in window), 6),
            **self._aggregate_algorithm_outputs(window),
            "raw_normal_policy": "periodic_summary_not_all_raw_data",
        }
        summary = self._with_monitoring_transfer(summary, "normal_summary")
        self.timeline.append(summary)
        return summary

    def periodic_summary(self, timestamp: float) -> dict:
        recent = self.normal_buffer[-250:] + self.warning_buffer[-250:] + self.critical_alerts[-50:]
        if not recent:
            return {"type": "periodic_summary", "timestamp": timestamp, "counts": {}}
        counts = Counter(r["severity"] for r in recent)
        layers = Counter(r["selected_layer"] for r in recent)
        paths = Counter(r["offloading_scenario"] for r in recent)
        summary = {
            "type": "periodic_summary",
            "timestamp": timestamp,
            "counts": dict(counts),
            "offloading_ratio": dict(layers),
            "path_distribution": dict(paths),
            "avg_latency": round(mean(float(r.get("estimated_delay", 0)) for r in recent), 4),
            "avg_energy_cost": round(mean(float(r.get("factor_energy_cost", 0)) for r in recent), 6),
            "abnormal_count": counts.get("warning", 0) + counts.get("critical", 0),
            **self._aggregate_algorithm_outputs(recent),
        }
        summary = self._with_monitoring_transfer(summary, "periodic_summary")
        self.timeline.append(summary)
        return summary

    def _merge_event_decision(self, event: dict, decision: dict) -> dict:
        return {**event, **decision}

    def _delivery_fields(self, event: dict, decision: dict) -> dict:
        triggered_at = float(event.get("timestamp", 0))
        delivery_delay = float(decision.get("estimated_delay", 0))
        sent_at = triggered_at + delivery_delay
        deadline = float(event.get("deadline", 0))
        return {
            "condition_triggered_at": triggered_at,
            "cloud_sent_at": round(sent_at, 4),
            "cloud_delivery_delay": round(delivery_delay, 4),
            "deadline": deadline,
            "deadline_met": bool(delivery_delay <= deadline),
        }

    def _summary(self, kind: str, records: List[dict], event: dict, decision: dict) -> dict:
        counts = Counter(r["severity"] for r in records)
        layers = Counter(r["selected_layer"] for r in records)
        paths = Counter(r["offloading_scenario"] for r in records)
        summary = {
            "type": kind,
            "severity": event["severity"],
            "count": len(records),
            "counts": dict(counts),
            "offloading_ratio": dict(layers),
            "path_distribution": dict(paths),
            "latest": records[-1] if records else None,
            **self._aggregate_algorithm_outputs(records),
            **self._cloud_analytics_fields(event, decision, records),
            "task_size_kb": event.get("task_size_kb"),
            **self._payload_figure_fields(event),
            "decision_metadata_kb": decision.get("decision_metadata_kb"),
            "factor_compute_demand_ratio": decision.get("factor_compute_demand_ratio"),
            **self._delivery_fields(event, decision),
        }
        return self._with_monitoring_transfer(summary, kind)

    def _with_monitoring_transfer(self, record: dict, kind: str) -> dict:
        monitoring_export_kb = self._monitoring_export_size(record, kind)
        base_transfer_kb = float(record.get("task_size_kb", 0)) + float(record.get("decision_metadata_kb", 0))
        record["monitoring_export_kb"] = monitoring_export_kb
        record["total_transfer_kb"] = round(base_transfer_kb + monitoring_export_kb, 3)
        return record

    def _monitoring_export_size(self, record: dict, kind: str) -> float:
        if kind == "critical_alert":
            return 12.0
        if kind == "warning_summary":
            return round(8.0 + float(record.get("count", 1)) * 0.05, 3)
        if kind == "normal_summary":
            return round(6.0 + float(record.get("count", 1)) * 0.02, 3)
        if kind == "periodic_summary":
            return 5.0
        return 4.0

    def _payload_figure_fields(self, event: dict) -> dict:
        component_keys = [
            "payload_event_metadata_kb",
            "payload_sensor_sample_window_kb",
            "payload_waveform_fault_window_kb",
            "payload_diagnostic_logs_kb",
            "payload_machine_context_kb",
            "payload_calculated_features_kb",
            "payload_device_security_metadata_kb",
        ]
        components = {key: event.get(key, 0) for key in component_keys}
        return {
            **components,
            "payload_components_kb": components,
            "payload_abnormal_sensor_count": event.get("payload_abnormal_sensor_count"),
            "payload_dominant_sensor_multiplier": event.get("payload_dominant_sensor_multiplier"),
            "event_payload_kb": event.get("event_payload_kb"),
            "protocol_security_overhead_kb": event.get("protocol_security_overhead_kb"),
            "task_cpu_cycles": event.get("task_cpu_cycles"),
            **self._algorithm_output_fields(event),
            **self._compute_stage_fields(event),
        }

    def _algorithm_output_fields(self, event: dict) -> dict:
        keys = [
            "validation_passed",
            "validation_score",
            "validation_missing_fields",
            "validation_invalid_readings",
            "feature_avg_reading",
            "feature_min_reading",
            "feature_max_reading",
            "feature_reading_range",
            "feature_avg_deviation",
            "feature_max_deviation",
            "feature_dominant_deviation",
            "feature_max_deviation_sensor",
            "feature_abnormal_count",
            "feature_warning_count",
            "feature_critical_count",
            "feature_severity_score",
            "feature_extraction_algorithm",
            "history_anomaly_score",
            "history_anomaly_level",
            "history_active_patterns",
            "history_algorithm",
            "correlation_thermal_mechanical",
            "correlation_electrical_mechanical",
            "correlation_process_flow_pressure",
            "correlation_acoustic_mechanical",
            "correlation_active_patterns",
            "correlation_score",
            "correlation_risk_level",
        ]
        return {key: event.get(key) for key in keys}

    def _aggregate_algorithm_outputs(self, records: List[dict]) -> dict:
        if not records:
            return {
                "aggregation_window_count": 0,
                "aggregation_avg_severity_score": 0,
                "aggregation_avg_history_anomaly_score": 0,
                "aggregation_avg_abnormal_sensors": 0,
                "aggregation_risk_distribution": {},
                "aggregation_top_history_patterns": {},
            }
        risk_counts = Counter(r.get("history_anomaly_level", r.get("correlation_risk_level", "unknown")) for r in records)
        pattern_counts = Counter()
        for record in records:
            for pattern in str(record.get("history_active_patterns", record.get("correlation_active_patterns", "none"))).split(","):
                if pattern and pattern != "none":
                    pattern_counts[pattern] += 1
        return {
            "aggregation_window_count": len(records),
            "aggregation_avg_severity_score": round(mean(float(r.get("feature_severity_score", 0)) for r in records), 4),
            "aggregation_avg_history_anomaly_score": round(mean(float(r.get("history_anomaly_score", r.get("correlation_score", 0))) for r in records), 4),
            "aggregation_avg_correlation_score": round(mean(float(r.get("history_anomaly_score", r.get("correlation_score", 0))) for r in records), 4),
            "aggregation_avg_abnormal_sensors": round(mean(float(r.get("feature_abnormal_count", 0)) for r in records), 4),
            "aggregation_risk_distribution": dict(risk_counts),
            "aggregation_top_history_patterns": dict(pattern_counts.most_common(5)),
            "aggregation_top_correlated_patterns": dict(pattern_counts.most_common(5)),
        }

    def _cloud_analytics_fields(self, event: dict, decision: dict, records: List[dict]) -> dict:
        severity_weight = {"normal": 0.15, "warning": 0.55, "critical": 0.90}.get(event.get("severity"), 0.0)
        deadline_penalty = 0.0 if decision.get("deadline_met") else 0.20
        history_anomaly = float(event.get("history_anomaly_score", event.get("correlation_score", 0)))
        feature_score = float(event.get("feature_severity_score", 0))
        cloud_risk_score = min(1.0, severity_weight * 0.40 + history_anomaly * 0.25 + feature_score * 0.25 + deadline_penalty)
        return {
            "cloud_risk_score": round(cloud_risk_score, 4),
            "cloud_risk_level": self._risk_level(cloud_risk_score),
            "cloud_escalation_recommended": cloud_risk_score >= 0.70 or event.get("severity") == "critical",
            "cloud_analytics_algorithm": "severity_feature_history_anomaly_deadline_risk_score",
        }

    def _risk_level(self, score: float) -> str:
        if score >= 0.70:
            return "high"
        if score >= 0.35:
            return "medium"
        return "low"

    def _compute_stage_fields(self, event: dict) -> dict:
        stage_keys = [
            "intake_validation_cycles",
            "threshold_classification_cycles",
            "feature_extraction_cycles",
            "history_analysis_cycles",
            "aggregation_cycles",
            "cloud_analytics_cycles",
            "decision_packaging_cycles",
        ]
        stages = {key: event.get(key, 0) for key in stage_keys}
        return {
            **stages,
            "compute_stages_cycles": stages,
            "compute_model": event.get("compute_model"),
        }

    def _append_trace(self, event: dict, decision: dict, cloud_record_type: str, sent_to_cloud: bool) -> None:
        monitoring_export_kb = self._monitoring_export_size({"count": 1}, cloud_record_type) if sent_to_cloud else 0.0
        self.status_trace.append({
            "event_id": event.get("event_id"),
            "node_id": event.get("node_id"),
            "dominant_sensor_type": event.get("dominant_sensor_type"),
            "severity": event.get("severity"),
            "event_level_3l": event.get("event_level_3l"),
            "transfer_rule": event.get("transfer_rule"),
            "selected_layer": decision.get("selected_layer"),
            "offloading_scenario": decision.get("offloading_scenario"),
            "decision_reason": decision.get("decision_reason"),
            "cloud_record_type": cloud_record_type,
            "sent_to_cloud": sent_to_cloud,
            "event_payload_kb": event.get("event_payload_kb"),
            "protocol_security_overhead_kb": event.get("protocol_security_overhead_kb"),
            "task_size_kb": event.get("task_size_kb"),
            "task_cpu_cycles": event.get("task_cpu_cycles"),
            **self._payload_figure_fields(event),
            **self._cloud_analytics_fields(event, decision, [event]),
            "decision_metadata_kb": decision.get("decision_metadata_kb"),
            "factor_compute_demand_ratio": decision.get("factor_compute_demand_ratio"),
            "monitoring_export_kb": monitoring_export_kb,
            "total_transfer_kb": round(float(event.get("task_size_kb", 0)) + float(decision.get("decision_metadata_kb", 0)) + monitoring_export_kb, 3),
            **self._delivery_fields(event, decision),
        })
