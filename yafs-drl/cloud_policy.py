"""Cloud/API/dashboard policy for the single centralized cloud node.

Rules from confirmed requirements:
- Critical: transmit/update to cloud every 1 minute.
- Warning: transmit/update to cloud every 3 minutes.
- Normal: aggregate at edge and transmit one normal summary per node per 5-minute window.
"""
from __future__ import annotations
from collections import Counter, defaultdict
from statistics import mean
from typing import List, Optional

from config import CLOUD_TRANSMISSION_INTERVALS

class CloudPolicy:
    STATUS_LEVELS = {"normal", "warning", "critical"}

    def __init__(self):
        self.normal_windows = defaultdict(list)
        self.abnormal_normal_windows = set()
        self.update_windows = defaultdict(list)
        self.update_records = {}
        self.timeline: List[dict] = []
        self.status_trace: List[dict] = []

    def handle(self, event: dict, decision: dict) -> Optional[dict]:
        severity = event["severity"]
        record = self._merge_event_decision(event, decision)
        if severity not in self.STATUS_LEVELS:
            self._append_trace(event, decision, cloud_record_type="unknown", sent_to_cloud=False)
            return None

        if severity == "normal":
            window = self._window_key(event, "normal")
            self.normal_windows[window].append(record)
            self._append_trace(
                event,
                decision,
                cloud_record_type="normal_5min_edge_aggregate_pending",
                sent_to_cloud=False,
                represented_in_cloud=True,
            )
            return None

        normal_window = self._window_key(event, "normal")
        self.abnormal_normal_windows.add(normal_window)
        update = self._record_status_update(event, decision, record, severity)
        self._append_trace(
            event,
            decision,
            cloud_record_type=update["type"],
            sent_to_cloud=update["count"] == 1,
            represented_in_cloud=True,
        )
        return update if update["count"] == 1 else None

    def flush_normal_summaries(self, timestamp: float | None = None, *, final: bool = False) -> List[dict]:
        summaries = []
        for window, records in list(self.normal_windows.items()):
            node_id, window_start = window
            interval = CLOUD_TRANSMISSION_INTERVALS["normal"]
            if not final and timestamp is not None and window_start + interval > timestamp:
                continue
            if window in self.abnormal_normal_windows:
                del self.normal_windows[window]
                continue
            summary = self._normal_summary(node_id, window_start, records)
            self.timeline.append(summary)
            summaries.append(summary)
            del self.normal_windows[window]
        return summaries

    def periodic_normal_summary(self, timestamp: float) -> Optional[dict]:
        summaries = self.flush_normal_summaries(timestamp)
        return summaries[0] if summaries else None

    def periodic_normal_summaries(self, timestamp: float) -> List[dict]:
        return self.flush_normal_summaries(timestamp)

    def finalize(self) -> List[dict]:
        return self.flush_normal_summaries(final=True)

    def _record_status_update(self, event: dict, decision: dict, record: dict, severity: str) -> dict:
        key = self._window_key(event, severity)
        self.update_windows[key].append(record)
        records = self.update_windows[key]
        update = self.update_records.get(key)
        if update is None:
            update = {
                "type": f"{severity}_update",
                "severity": severity,
                "node_id": event.get("node_id"),
                "sensor_type": event.get("dominant_sensor_type") or event.get("sensor_type"),
                "window_start": key[1],
                "window_end": key[1] + CLOUD_TRANSMISSION_INTERVALS[severity],
                "cloud_update_interval_seconds": CLOUD_TRANSMISSION_INTERVALS[severity],
                "cloud_policy": self._policy_name(severity),
                "normal_raw_records_sent": False,
            }
            self.update_records[key] = update
            self.timeline.append(update)
        update.update(self._summary_fields(records, event, decision))
        if severity == "warning":
            update["repeated_warning"] = len(records) > 1
        return update

    def _normal_summary(self, node_id: str, window_start: float, records: List[dict]) -> dict:
        latest = records[-1]
        sensor_type = latest.get("dominant_sensor_type") or latest.get("sensor_type")
        return {
            "type": "normal_summary",
            "severity": "normal",
            "node_id": node_id,
            "sensor_type": sensor_type,
            "window_start": window_start,
            "window_end": window_start + CLOUD_TRANSMISSION_INTERVALS["normal"],
            "cloud_update_interval_seconds": CLOUD_TRANSMISSION_INTERVALS["normal"],
            "cloud_policy": self._policy_name("normal"),
            "count": len(records),
            "first_event_id": records[0].get("event_id"),
            "latest_event_id": latest.get("event_id"),
            "avg_reading": round(mean(float(r.get("reading_value", 0)) for r in records), 4),
            "selected_layer_counts": dict(Counter(r["selected_layer"] for r in records)),
            "path_distribution": dict(Counter(r["offloading_scenario"] for r in records)),
            "avg_latency": round(mean(float(r.get("estimated_delay", 0)) for r in records), 4),
            "avg_energy_cost": round(mean(float(r.get("factor_energy_cost", 0)) for r in records), 6),
            "normal_raw_records_sent": False,
            "raw_normal_policy": "edge_aggregated_one_summary_per_node_per_5min_window",
            "latest": latest,
        }

    def periodic_summary(self, timestamp: float) -> dict:
        recent = self.timeline[-500:]
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

    def _summary_fields(self, records: List[dict], event: dict, decision: dict) -> dict:
        counts = Counter(r["severity"] for r in records)
        layers = Counter(r["selected_layer"] for r in records)
        paths = Counter(r["offloading_scenario"] for r in records)
        return {
            "count": len(records),
            "counts": dict(counts),
            "offloading_ratio": dict(layers),
            "path_distribution": dict(paths),
            "latest": records[-1] if records else None,
            **self._delivery_fields(event, decision),
        }

    def _window_key(self, event: dict, severity: str) -> tuple[str, float]:
        interval = CLOUD_TRANSMISSION_INTERVALS[severity]
        timestamp = float(event.get("timestamp", 0))
        return event.get("node_id"), timestamp - (timestamp % interval)

    def _policy_name(self, severity: str) -> str:
        if severity == "critical":
            return "critical_update_every_1_minute"
        if severity == "warning":
            return "warning_update_every_3_minutes_repeated_warning_flag_only"
        return "normal_edge_aggregate_summary_every_5_minutes"

    def _append_trace(
        self,
        event: dict,
        decision: dict,
        cloud_record_type: str,
        sent_to_cloud: bool,
        represented_in_cloud: bool = False,
    ) -> None:
        severity = event.get("severity")
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
            "represented_in_cloud": represented_in_cloud,
            "cloud_update_interval_seconds": CLOUD_TRANSMISSION_INTERVALS.get(severity),
            "normal_raw_records_sent": False,
            **self._delivery_fields(event, decision),
        })
