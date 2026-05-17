"""Create dashboard/API JSON files required by the confirmed requirements."""
from __future__ import annotations
import json
from pathlib import Path
import pandas as pd
import networkx as nx

ROOT = Path(__file__).resolve().parents[1]

def export_all(root: Path = ROOT) -> None:
    out = root / "dashboard_exports"
    out.mkdir(exist_ok=True)
    events = pd.read_csv(root / "results/events.csv")
    decisions = pd.read_csv(root / "results/offloading_decisions.csv")
    baseline = pd.read_csv(root / "results/baseline_decisions.csv")
    graph = nx.read_graphml(root / "topology/iiot_topology_1000.graphml")
    merged = events.merge(decisions, on="event_id", suffixes=("", "_decision"))

    (out / "events.json").write_text(merged.to_json(orient="records", indent=2))
    (out / "offloading_decisions.json").write_text(decisions.to_json(orient="records", indent=2))
    (out / "baseline_decisions.json").write_text(baseline.to_json(orient="records", indent=2))

    nodes = [{"node_id": n, **d} for n, d in graph.nodes(data=True)]
    links = [{"source": a, "target": b, **d} for a, b, d in graph.edges(data=True)]
    (out / "nodes.json").write_text(json.dumps(nodes, indent=2))
    (out / "node_status.json").write_text(json.dumps(nodes, indent=2))
    (out / "topology.json").write_text(json.dumps({"nodes": nodes, "links": links}, indent=2))

    path_rows = []
    for path, group in merged.groupby("offloading_scenario"):
        path_rows.append({
            "path": path,
            "count": int(len(group)),
            "ratio": round(float(len(group) / max(len(merged), 1)), 4),
            "avg_latency": round(float(group["estimated_delay"].mean()), 6),
            "deadline_success_rate": round(float(group["deadline_met"].mean()), 6),
        })
    (out / "paths.json").write_text(json.dumps(path_rows, indent=2))

    shift = {
        "total_events": int(len(merged)),
        "normal_count": int((merged["severity"] == "normal").sum()),
        "warning_count": int((merged["severity"] == "warning").sum()),
        "critical_count": int((merged["severity"] == "critical").sum()),
        "deadline_compliance": round(float(merged["deadline_met"].mean()), 6),
        "offloading_performance": merged["offloading_scenario"].value_counts().to_dict(),
        "cloud_role": "one centralized cloud node for analytics/API/dashboard/storage/reporting/escalation",
        "payload_model_report": _payload_model_report(merged),
    }
    (out / "shift_report.json").write_text(json.dumps(shift, indent=2))

def _payload_model_report(merged: pd.DataFrame) -> dict:
    components = [
        ("payload_event_metadata_kb", "Event metadata", "sensor ID, edge gateway, timestamp, severity, priority, deadline, and event reason"),
        ("payload_sensor_sample_window_kb", "Sensor history window", "recent readings from the same sensor used to detect spikes, trends, and volatility"),
        ("payload_waveform_fault_window_kb", "Fault/spike window", "extra same-sensor values around an abnormal spike or fault window"),
        ("payload_diagnostic_logs_kb", "Diagnostic logs", "diagnostic context attached when the event needs explanation"),
        ("payload_machine_context_kb", "Machine context", "equipment, zone, edge gateway, operating/source context currently modeled from topology metadata"),
        ("payload_calculated_features_kb", "Calculated features", "derived values such as peaks, averages, RMS, threshold deviations, and trend features"),
        ("payload_device_security_metadata_kb", "Device/security metadata", "device identity and security/authentication metadata estimate"),
    ]
    formulas = {
        "event_payload_kb": "sum of all payload component fields",
        "protocol_security_overhead_kb": "base protocol/security overhead + 4% of event_payload_kb",
        "task_size_kb": "event_payload_kb + protocol_security_overhead_kb",
        "task_cpu_cycles": "task_size_kb * severity CPU cycles per KB",
        "compute_demand_ratio": "task_cpu_cycles / target node compute capacity",
        "decision_metadata_kb": "4.0 KB + 0.35 KB per route hop",
        "monitoring_export_kb": "cloud/API record overhead by record type",
        "total_transfer_kb": "task_size_kb + decision_metadata_kb + monitoring_export_kb",
    }
    return {
        "purpose": "Expose how the simulation models realistic IIoT event size, protocol/security overhead, compute demand, DRL decision metadata, and cloud/API monitoring export size.",
        "formulas": formulas,
        "payload_components": [
            {
                "field": field,
                "label": label,
                "counts": counts,
                "average_kb": round(float(merged.get(field, pd.Series([0])).mean()), 3),
                "total_bytes": int((merged.get(field, pd.Series([0] * len(merged))) * 1024).sum()),
                "counted_into": "event_payload_kb",
            }
            for field, label, counts in components
        ],
        "compute_stages": _compute_stage_report(merged),
        "real_algorithm_outputs": _real_algorithm_report(merged),
        "literature_alignment": _literature_alignment_report(),
        "literature_reference_examples": _literature_reference_examples(),
        "dynamic_resource_allocation": {
            "purpose": "Show that resource state is updated after each offloading decision, so later DRL decisions see changed node load and link traffic.",
            "avg_node_load_before": round(float(merged.get("dynamic_node_load_before", pd.Series([0])).mean()), 6),
            "avg_node_load_after": round(float(merged.get("dynamic_node_load_after", pd.Series([0])).mean()), 6),
            "avg_link_load_before": round(float(merged.get("dynamic_link_load_before", pd.Series([0])).mean()), 6),
            "avg_link_load_after": round(float(merged.get("dynamic_link_load_after", pd.Series([0])).mean()), 6),
            "avg_processing_time": round(float(merged.get("dynamic_processing_time", pd.Series([0])).mean()), 6),
        },
        "averages": {
            "event_payload_kb": round(float(merged.get("event_payload_kb", pd.Series([0])).mean()), 3),
            "protocol_security_overhead_kb": round(float(merged.get("protocol_security_overhead_kb", pd.Series([0])).mean()), 3),
            "task_size_kb": round(float(merged.get("task_size_kb", pd.Series([0])).mean()), 3),
            "task_cpu_cycles": round(float(merged.get("task_cpu_cycles", pd.Series([0])).mean()), 3),
            "compute_demand_ratio": round(float(merged.get("factor_compute_demand_ratio", pd.Series([0])).mean()), 6),
            "decision_metadata_kb": round(float(merged.get("decision_metadata_kb", pd.Series([0])).mean()), 3),
            "total_transfer_kb": round(float(merged.get("total_transfer_kb", pd.Series([0])).mean()), 3),
        },
        "severity_examples": {
            severity: {
                "events": int(len(group)),
                "avg_event_payload_kb": round(float(group.get("event_payload_kb", pd.Series([0])).mean()), 3),
                "avg_task_size_kb": round(float(group.get("task_size_kb", pd.Series([0])).mean()), 3),
                "avg_task_cpu_cycles": round(float(group.get("task_cpu_cycles", pd.Series([0])).mean()), 3),
            }
            for severity, group in merged.groupby("severity")
        },
    }

def _compute_stage_report(merged: pd.DataFrame) -> list[dict]:
    stages = [
        ("intake_validation_cycles", "Intake validation", "message parsing, timestamp/device check, missing-value and range validation"),
        ("threshold_classification_cycles", "Threshold classification", "compare the current sensor reading against normal/warning/critical thresholds"),
        ("feature_extraction_cycles", "Feature extraction", "derive values such as peaks, averages, RMS, deviation, and trend features"),
        ("history_analysis_cycles", "History analysis", "same-sensor spike, trend, and volatility checks using recent readings"),
        ("aggregation_cycles", "Aggregation", "combine events, edge summaries, or regional context"),
        ("cloud_analytics_cycles", "Cloud analytics", "deeper escalation analytics, storage/reporting preparation"),
        ("decision_packaging_cycles", "Decision packaging", "attach DRL route, factors, deadline result, and monitoring metadata"),
    ]
    return [
        {
            "field": field,
            "label": label,
            "counts": counts,
            "average_cycles": round(float(merged.get(field, pd.Series([0])).mean()), 3),
            "total_cycles": int(merged.get(field, pd.Series([0] * len(merged))).sum()),
            "counted_into": "task_cpu_cycles",
        }
        for field, label, counts in stages
    ]

def _real_algorithm_report(merged: pd.DataFrame) -> dict:
    return {
        "implemented_algorithms": [
            {
                "stage": "Intake validation",
                "output_fields": ["validation_passed", "validation_score", "validation_missing_fields", "validation_invalid_readings"],
                "description": "Checks event identity, timestamp, missing readings, and configured reading ranges.",
            },
            {
                "stage": "Threshold classification",
                "output_fields": ["current_status", "severity"],
                "description": "Classifies the current reading from the event sensor type against normal/warning/critical thresholds and derives event severity.",
            },
            {
                "stage": "Feature extraction",
                "output_fields": ["feature_historical_avg", "feature_previous_value_delta", "feature_spike_score", "feature_trend_score", "feature_volatility_score", "feature_severity_score"],
                "description": "Calculates same-sensor historical baseline, delta, spike, trend, volatility, and severity-confidence features.",
            },
            {
                "stage": "History analysis",
                "output_fields": ["history_anomaly_score", "history_anomaly_level", "history_active_patterns"],
                "description": "Detects same-sensor spike, rising/falling trend, and volatility patterns from recent readings.",
            },
            {
                "stage": "Aggregation",
                "output_fields": ["aggregation_avg_severity_score", "aggregation_avg_history_anomaly_score", "aggregation_risk_distribution", "aggregation_top_history_patterns"],
                "description": "Summarizes recent event windows for cloud warning/normal/periodic reports.",
            },
            {
                "stage": "Cloud analytics",
                "output_fields": ["cloud_risk_score", "cloud_risk_level", "cloud_escalation_recommended"],
                "description": "Combines severity, feature score, history anomaly, and deadline result into a cloud risk score.",
            },
        ],
        "summary_metrics": {
            "validation_pass_rate": round(float(merged.get("validation_passed", pd.Series([False] * len(merged))).mean()), 6),
            "avg_feature_severity_score": round(float(merged.get("feature_severity_score", pd.Series([0])).mean()), 6),
            "avg_history_anomaly_score": round(float(merged.get("history_anomaly_score", pd.Series([0])).mean()), 6),
            "avg_correlation_score": round(float(merged.get("history_anomaly_score", merged.get("correlation_score", pd.Series([0]))).mean()), 6),
            "avg_abnormal_sensor_count": round(float(merged.get("feature_abnormal_count", pd.Series([0])).mean()), 6),
            "history_anomaly_distribution": merged.get("history_anomaly_level", pd.Series(dtype=str)).value_counts().to_dict(),
            "correlation_risk_distribution": merged.get("history_anomaly_level", merged.get("correlation_risk_level", pd.Series(dtype=str))).value_counts().to_dict(),
            "max_deviation_sensor_distribution": merged.get("feature_max_deviation_sensor", pd.Series(dtype=str)).value_counts().to_dict(),
        },
    }

def _literature_alignment_report() -> list[dict]:
    return [
        {
            "concept": "Task/data size",
            "implemented_as": "task_size_kb",
            "mapping": "Modeled input data transferred by the IIoT task: event payload plus protocol/security overhead.",
        },
        {
            "concept": "CPU cycles / computation demand",
            "implemented_as": "task_cpu_cycles and compute stage cycles",
            "mapping": "Processing burden derived from task size and severity, then split into validation, classification, feature extraction, history analysis, aggregation, cloud analytics, and decision packaging.",
        },
        {
            "concept": "Deadline / latency-sensitive offloading",
            "implemented_as": "deadline and deadline_met",
            "mapping": "Severity defines the timing requirement; DRL rewards successful decisions that satisfy the deadline.",
        },
        {
            "concept": "Computation offloading action",
            "implemented_as": "selected_layer, destination, route_path, offloading_scenario",
            "mapping": "DRL chooses where the task should be processed using local edge, edge-to-edge, edge-to-fog, fog-to-fog, or cloud escalation actions.",
        },
        {
            "concept": "Dynamic resource allocation",
            "implemented_as": "dynamic_node_load_* and dynamic_link_load_*",
            "mapping": "Assigned tasks reserve destination compute capacity and route link traffic for a simulated duration, influencing later decisions.",
        },
        {
            "concept": "Network condition / congestion / bandwidth cost",
            "implemented_as": "factor_network_condition, factor_bandwidth_cost, dynamic_link_load_*",
            "mapping": "Routing evaluates static link properties together with active simulated traffic to estimate network pressure.",
        },
    ]

def _literature_reference_examples() -> list[dict]:
    return [
        {
            "paper": "Distributed task offloading in edge computing: A multi-objective adaptive deep reinforcement learning algorithm",
            "source_file": "PAPERS L10/1-s2.0-S0952197625026843-main.pdf",
            "supports": "Multi-objective DRL task offloading with adaptive decisions.",
            "implemented_mapping": "DQN route selection using latency, congestion, energy, task size, bandwidth, node computing capacity, and deadline.",
        },
        {
            "paper": "Energy-efficient task offloading in the Industrial Internet of Things: A Lyapunov-guided multi-agent deep reinforcement learning approach",
            "source_file": "PAPERS L10/1-s2.0-S2452414X25002602-main.pdf",
            "supports": "IIoT task offloading, energy-aware decisions, and resource-aware DRL framing.",
            "implemented_mapping": "Energy cost remains a DRL factor, while dynamic node/link load models changing resource state.",
        },
        {
            "paper": "An advanced deep reinforcement learning algorithm for three-layer D2D-edge-cloud computing architecture for efficient task offloading in the Internet of Things",
            "source_file": "PAPERS L10/1-s2.0-S2210537924000374-main.pdf",
            "supports": "Three-layer device/edge/cloud offloading and DQN-style task routing.",
            "implemented_mapping": "Sensor/edge/fog/cloud topology with local edge, edge-to-edge, edge-to-fog, fog-to-fog, and cloud escalation actions.",
        },
        {
            "paper": "Multi-objective task offloading optimization using deep reinforcement learning with resource distribution clustering",
            "source_file": "PAPERS F10/1-s2.0-S2405959525000682-main.pdf",
            "supports": "Multi-objective DRL offloading with resource distribution awareness.",
            "implemented_mapping": "Candidate routing considers nearby resources and now reacts to dynamic compute/link usage.",
        },
        {
            "paper": "Deep reinforcement learning for optimizing computation latency in wireless-powered Multi-Access Edge Computing systems: A partial offloading approach",
            "source_file": "PAPERS L10/1-s2.0-S1570870525002197-main.pdf",
            "supports": "Computation latency minimization, offloading decisions, and resource management.",
            "implemented_mapping": "Task CPU cycles and compute demand ratio are modeled separately from task/network size.",
        },
        {
            "paper": "Reliable and efficient computation offloading for dependency-aware tasks in IIoT using evolutionary multi-objective optimization",
            "source_file": "PAPERS L10/1-s2.0-S0167739X25002183-main.pdf",
            "supports": "IIoT computation offloading with multi-objective optimization over delay, network, energy, task, bandwidth, and compute capacity factors.",
            "implemented_mapping": "Deadline success and compute-capacity-aware offloading are reported through the true 7F decision model.",
        },
        {
            "paper": "Dynamic offloading strategy for computational energy efficiency of wireless power transfer based MEC networks in industry 5.0",
            "source_file": "PAPERS F10/1-s2.0-S1319157823003956-main.pdf",
            "supports": "Dynamic offloading, task computational model, local/edge computational model, and resource allocation.",
            "implemented_mapping": "Dynamic node load and task_cpu_cycles represent changing compute demand without forcing fixed layer-specific algorithm roles.",
        },
    ]

if __name__ == "__main__":
    export_all()
    print("Exported dashboard JSON files.")
