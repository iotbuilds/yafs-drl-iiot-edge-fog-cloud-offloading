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
            "raw_normal_policy": "periodic_summary_not_all_raw_data",
        }
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
        }
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
        return {
            "type": kind,
            "severity": event["severity"],
            "count": len(records),
            "counts": dict(counts),
            "offloading_ratio": dict(layers),
            "path_distribution": dict(paths),
            "latest": records[-1] if records else None,
            **self._delivery_fields(event, decision),
        }

    def _append_trace(self, event: dict, decision: dict, cloud_record_type: str, sent_to_cloud: bool) -> None:
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
            **self._delivery_fields(event, decision),
        })
