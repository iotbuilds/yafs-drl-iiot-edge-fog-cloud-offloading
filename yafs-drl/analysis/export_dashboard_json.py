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
    }
    (out / "shift_report.json").write_text(json.dumps(shift, indent=2))

if __name__ == "__main__":
    export_all()
    print("Exported dashboard JSON files.")
