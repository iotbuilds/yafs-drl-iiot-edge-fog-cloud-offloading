"""Validate the confirmed requirements after a run."""
from __future__ import annotations
import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path) if path.exists() else pd.DataFrame()

def _read_json(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default

def validate(root: Path = ROOT) -> dict:
    results = root / "results"
    dashboard = root / "dashboard_exports"
    topology = _read_json(root / "topology/topology_summary.json", {})
    events = _read_csv(results / "events.csv")
    decisions = _read_csv(results / "offloading_decisions.csv")
    trace = _read_csv(results / "status_condition_trace.csv")
    cloud_records = _read_json(dashboard / "cloud_records.json", [])
    scenario_counts = decisions.get("offloading_scenario", pd.Series(dtype=str)).value_counts().to_dict()

    levels = set(events.get("severity", pd.Series(dtype=str)).dropna().unique())
    cloud_levels = {r.get("severity") for r in cloud_records if r.get("severity")}
    cloud_type_counts = {}
    for r in cloud_records:
        cloud_type_counts[r.get("type", "unknown")] = cloud_type_counts.get(r.get("type", "unknown"), 0) + 1
    normal_summaries = [r for r in cloud_records if r.get("type") == "normal_summary"]
    normal_summary_keys = {(r.get("node_id"), r.get("window_start")) for r in normal_summaries}

    def rate(status: str):
        g = trace[trace["severity"] == status] if not trace.empty else pd.DataFrame()
        if g.empty or "deadline_met" not in g:
            return None
        return round(float(g["deadline_met"].mean()), 6)

    report = {
        "confirmed_topology_distribution": {
            "expected": {"sensor": 700, "edge": 220, "fog": 79, "cloud": 1},
            "actual": topology.get("layers", {}),
            "passed": topology.get("layers", {}) == {"edge": 220, "fog": 79, "cloud": 1, "sensor": 700} or topology.get("layers", {}) == {"sensor": 700, "edge": 220, "fog": 79, "cloud": 1},
        },
        "confirmed_7s_distribution": {
            "actual": topology.get("sensor_distribution_7s", {}),
            "passed": sum(topology.get("sensor_distribution_7s", {}).values()) == 700,
        },
        "confirmed_3l_only": {
            "levels_found": sorted(levels),
            "passed": levels.issubset({"normal", "warning", "critical"}) and len(levels) == 3,
        },
        "event_count": {"actual": int(len(events)), "target": 10000, "passed": int(len(events)) == 10000},
        "timing_rules": {
            "cloud_transmission_policy": {
                "critical_update_seconds": 60,
                "warning_update_seconds": 180,
                "normal_summary_seconds": 300,
                "normal_policy": "one edge-aggregated normal summary per node per 5-minute window; raw normal readings are not sent to cloud",
            },
            "critical_deadline_success_rate": rate("critical"),
            "warning_deadline_success_rate": rate("warning"),
            "normal_deadline_success_rate": rate("normal"),
        },
        "cloud_record_counts": cloud_type_counts,
        "normal_periodic_cloud_summary_present": cloud_type_counts.get("normal_summary", 0) > 0,
        "normal_raw_readings_not_sent_to_cloud": {
            "passed": all(not r.get("normal_raw_records_sent", False) for r in cloud_records),
            "normal_summary_count": cloud_type_counts.get("normal_summary", 0),
            "unique_node_windows": len(normal_summary_keys),
            "one_summary_per_node_per_5min_window": len(normal_summaries) == len(normal_summary_keys),
        },
        "confirmed_cloud_status_levels_only": {
            "levels_found": sorted(cloud_levels),
            "passed": cloud_levels.issubset({"normal", "warning", "critical"}),
        },
        "repeated_warning_is_flag_not_status": {
            "passed": "repeated_warning" not in levels,
            "warning_updates_with_repeated_flag": sum(1 for r in cloud_records if r.get("severity") == "warning" and r.get("repeated_warning")),
        },
        "offloading_paths_present": {
            "local_edge": scenario_counts.get("local_edge", 0) > 0,
            "edge_to_edge": scenario_counts.get("edge_to_edge", 0) > 0,
            "edge_to_fog": scenario_counts.get("edge_to_fog", 0) > 0,
            "fog_to_fog": scenario_counts.get("fog_to_fog", 0) > 0,
            "cloud_escalation": scenario_counts.get("cloud_escalation", 0) > 0,
        },
        "exports_present": {name: (dashboard / name).exists() for name in ["kpis.json", "events.json", "nodes.json", "topology.json", "status_metrics.json", "comparison.json", "paths.json"]},
    }
    report["overall_passed"] = (
        report["confirmed_topology_distribution"]["passed"]
        and report["confirmed_7s_distribution"]["passed"]
        and report["confirmed_3l_only"]["passed"]
        and report["event_count"]["passed"]
        and report["normal_periodic_cloud_summary_present"]
        and report["normal_raw_readings_not_sent_to_cloud"]["passed"]
        and report["normal_raw_readings_not_sent_to_cloud"]["one_summary_per_node_per_5min_window"]
        and report["confirmed_cloud_status_levels_only"]["passed"]
        and report["repeated_warning_is_flag_not_status"]["passed"]
        and all(report["offloading_paths_present"].values())
        and all(report["exports_present"].values())
    )
    (dashboard / "requirements_validation.json").write_text(json.dumps(report, indent=2))
    return report

if __name__ == "__main__":
    print(json.dumps(validate(ROOT), indent=2))
