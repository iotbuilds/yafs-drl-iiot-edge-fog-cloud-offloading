"""Compute the confirmed 10P KPI set from events and DRL decisions."""
from __future__ import annotations
import json
from pathlib import Path
import pandas as pd

def _route_len(value) -> int:
    if isinstance(value, list):
        return len(value)
    try:
        import ast
        return len(ast.literal_eval(value))
    except Exception:
        return 1

def _jains_fairness(counts: pd.Series) -> float:
    if counts.empty:
        return 0.0
    vals = counts.astype(float)
    return float((vals.sum() ** 2) / (len(vals) * (vals ** 2).sum())) if (vals ** 2).sum() else 0.0

def compute_kpis(events_csv: str | Path, decisions_csv: str | Path, out_json: str | Path) -> dict:
    events = pd.read_csv(events_csv)
    decisions = pd.read_csv(decisions_csv)
    df = events.merge(decisions, on="event_id", suffixes=("", "_decision"))
    hops = decisions.get("route_path", pd.Series(["[]"] * len(decisions))).apply(_route_len)
    network_bytes = int((df["task_size_kb"] * 1024 * hops.values).sum())
    status_metrics = {}
    for status, group in df.groupby("severity"):
        status_metrics[status] = {
            "events": int(len(group)),
            "avg_latency": round(float(group["estimated_delay"].mean()), 6),
            "deadline_success_rate": round(float(group["deadline_met"].mean()), 6),
            "avg_energy_cost": round(float(group.get("factor_energy_cost", pd.Series([0])).mean()), 6),
            "path_distribution": group["offloading_scenario"].value_counts().to_dict(),
        }
    fairness = _jains_fairness(decisions["destination"].value_counts()) if "destination" in decisions else 0.0
    kpis = {
        "total_events": int(len(df)),
        "confirmed_10p": {
            "latency": round(float(df["estimated_delay"].mean()), 6),
            "energy_consumption": round(float(df.get("factor_energy_cost", pd.Series([0])).mean()), 6),
            "deadline_success_rate": round(float(df["deadline_met"].mean()), 6),
            "throughput": int(df["deadline_met"].sum()),
            "network_overhead_bytes": network_bytes,
            "offloading_ratio_path_distribution": df["offloading_scenario"].value_counts(normalize=True).round(4).to_dict(),
            "congestion_score": round(float(df.get("factor_network_condition", pd.Series([0])).mean()), 6),
            "drl_model_efficiency": {
                "avg_reward": round(float(df.get("reward", pd.Series([0])).mean()), 6),
                "avg_score": round(float(df.get("score", pd.Series([0])).mean()), 6),
                "policy_modes": df.get("policy_mode", pd.Series(dtype=str)).value_counts().to_dict(),
                "model_types": df.get("model_type", pd.Series(dtype=str)).value_counts().to_dict(),
                "avg_dqn_q_value": round(float(df.get("dqn_q_value", pd.Series([0])).mean()), 6),
                "avg_dqn_loss": round(float(df.get("dqn_loss", pd.Series([0])).mean()), 6),
                "avg_reliability_risk_support": round(float(df.get("factor_reliability_risk", pd.Series([0])).mean()), 6),
            },
            "scalability_performance": "see dashboard_exports/scalability_validation.json",
            "fairness_load_balancing": round(fairness, 6),
        },
        "severity_counts_3l": df["severity"].value_counts().to_dict(),
        "offloading_ratios": df["selected_layer"].value_counts(normalize=True).round(4).to_dict(),
        "path_distribution": df["offloading_scenario"].value_counts().to_dict(),
        "avg_latency_by_status": df.groupby("severity")["estimated_delay"].mean().round(4).to_dict(),
        "deadline_success_by_status": df.groupby("severity")["deadline_met"].mean().round(4).to_dict(),
        "network_bytes_transmitted_est": network_bytes,
        "avg_congestion_score": round(float(df.get("factor_network_condition", pd.Series([0])).mean()), 6),
        "avg_energy_cost": round(float(df.get("factor_energy_cost", pd.Series([0])).mean()), 6),
        "failure_reasons": df.get("failure_congestion_reason", pd.Series(dtype=str)).value_counts().to_dict(),
        "top_risky_nodes": df[df["severity"].isin(["warning", "critical"])] ["node_id"].value_counts().head(10).to_dict(),
    }
    out_path = Path(out_json)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(kpis, indent=2))
    (out_path.parent / "status_metrics.json").write_text(json.dumps(status_metrics, indent=2))
    return kpis

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    print(json.dumps(compute_kpis(root / "results/events.csv", root / "results/offloading_decisions.csv", root / "dashboard_exports/kpis.json"), indent=2))
