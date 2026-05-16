"""Compare DRL against the confirmed 10B baseline policies."""
from __future__ import annotations
import json
from pathlib import Path
import pandas as pd

def _metrics(df: pd.DataFrame) -> dict:
    return {
        "baseline_latency": round(float(df["estimated_delay"].mean()), 6),
        "baseline_energy_consumption": round(float(df.get("factor_energy_cost", pd.Series([0])).mean()), 6),
        "baseline_deadline_success_rate": round(float(df["deadline_met"].mean()), 6),
        "baseline_throughput": int(df["deadline_met"].sum()),
        "baseline_network_overhead_bytes": int((df.get("factor_task_size", pd.Series([0])) * 512 * 1024).sum()),
        "baseline_offloading_ratio_path_distribution": df["offloading_scenario"].value_counts(normalize=True).round(4).to_dict(),
        "baseline_congestion_score": round(float(df.get("factor_network_condition", pd.Series([0])).mean()), 6),
        "baseline_decision_efficiency": round(float(df.get("score", pd.Series([0])).mean()), 6),
        "baseline_scalability_performance": "see scalability_validation.json",
        "baseline_fairness_load_balancing": round(float(df["destination"].value_counts(normalize=True).pow(2).sum()), 6),
    }

def compare(drl_csv: str | Path, baseline_csv: str | Path, out_json: str | Path) -> dict:
    drl = pd.read_csv(drl_csv)
    base = pd.read_csv(baseline_csv)
    baselines = {}
    if "baseline_policy" in base:
        for policy, group in base.groupby("baseline_policy"):
            baselines[policy] = _metrics(group)
    else:
        baselines["rule_based_static_cloud_fog"] = _metrics(base)
    drl_metrics = {
        "latency": round(float(drl["estimated_delay"].mean()), 6),
        "energy_consumption": round(float(drl.get("factor_energy_cost", pd.Series([0])).mean()), 6),
        "deadline_success_rate": round(float(drl["deadline_met"].mean()), 6),
        "throughput": int(drl["deadline_met"].sum()),
        "offloading_ratio_path_distribution": drl["offloading_scenario"].value_counts(normalize=True).round(4).to_dict(),
        "congestion_score": round(float(drl.get("factor_network_condition", pd.Series([0])).mean()), 6),
        "decision_efficiency_score": round(float(drl.get("score", pd.Series([0])).mean()), 6),
    }
    report = {"drl_10p": drl_metrics, "baseline_10b": baselines}
    if "rule_based_static_cloud_fog" in baselines:
        b = baselines["rule_based_static_cloud_fog"]
        report["latency_improvement_percent_vs_rule_based"] = round((b["baseline_latency"] - drl_metrics["latency"]) / max(b["baseline_latency"], 1e-9) * 100, 3)
    Path(out_json).parent.mkdir(parents=True, exist_ok=True)
    Path(out_json).write_text(json.dumps(report, indent=2))
    return report

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    print(json.dumps(compare(root / "results/offloading_decisions.csv", root / "results/baseline_decisions.csv", root / "dashboard_exports/comparison.json"), indent=2))
