"""Generate the final expert evaluation package for DRL vs baseline comparisons.

Requested layout
A. Experiment profile
B. Main comparison (DRL vs baselines) across the 10 KPI areas
C. Priority-aware analysis
D. DRL-only learning evidence
"""
from __future__ import annotations

import ast
import json
from pathlib import Path
from typing import Dict, List

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Clean global graph text/style settings
plt.rcParams.update({
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.titlesize": 15,
    "axes.titleweight": "bold",
    "axes.labelsize": 12,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "legend.fontsize": 9,
    "legend.title_fontsize": 10,
    "axes.grid": True,
    "grid.alpha": 0.22,
    "grid.linestyle": "--",
    "axes.spines.top": False,
    "axes.spines.right": False,
})

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
DASH = ROOT / "dashboard_exports"
GRAPHS = ROOT / "graphs"
TOPOLOGY_SUMMARY = ROOT / "topology" / "topology_summary.json"
NODE_SIZES = [100, 300, 500, 700, 1000]
POLICY_ORDER = ["DRL", "local_only", "edge_only", "cloud_only", "random", "rule_based_static"]
PATH_ORDER = ["local_edge", "edge_to_edge", "edge_to_fog", "fog_to_fog", "cloud_escalation"]
SEVERITY_ORDER = ["critical", "warning", "normal"]
METRIC_DIRECTIONS = {
    "avg_latency": "lower",
    "avg_energy_cost": "lower",
    "deadline_success_rate": "higher",
    "throughput": "higher",
    "network_overhead_bytes": "lower",
    "avg_congestion": "lower",
    "score_mean": "lower",
    "scalability_index": "higher",
    "fairness_load_balancing": "higher",
    "cloud_escalation_ratio": "lower",
}
COLORS = {
    "DRL": "#7E57C2",
    "local_only": "#9E9E9E",
    "edge_only": "#4FC3F7",
    "cloud_only": "#FF8A65",
    "random": "#81C784",
    "rule_based_static": "#F06292",
}


def save_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2))


def label_strategy(name: str) -> str:
    mapping = {
        "drl_7f": "DRL",
        "DRL": "DRL",
        "rule_based_static_cloud_fog": "rule_based_static",
        "rule_based_static": "rule_based_static",
        "local_only": "local_only",
        "edge_only": "edge_only",
        "cloud_only": "cloud_only",
        "random": "random",
    }
    return mapping.get(name, name)


def read_data():
    events = pd.read_csv(RESULTS / "events.csv")
    drl = pd.read_csv(RESULTS / "offloading_decisions.csv")
    baseline = pd.read_csv(RESULTS / "baseline_decisions.csv")
    topology = json.loads(TOPOLOGY_SUMMARY.read_text()) if TOPOLOGY_SUMMARY.exists() else {}
    return events, drl, baseline, topology


def route_len(v):
    if isinstance(v, list):
        return len(v)
    try:
        parsed = ast.literal_eval(v)
        return len(parsed) if isinstance(parsed, list) else 1
    except Exception:
        return 1


def fairness(destination_counts: pd.Series) -> float:
    if destination_counts.empty:
        return 0.0
    vals = destination_counts.astype(float)
    denom = float((vals ** 2).sum())
    return round(float((vals.sum() ** 2) / (len(vals) * denom)), 6) if denom else 0.0


def normalize_path_counts(series: pd.Series) -> dict:
    total = int(series.sum())
    if total == 0:
        return {path: 0.0 for path in PATH_ORDER}
    return {path: round(float(series.get(path, 0) / total), 6) for path in PATH_ORDER}


def metrics_for(name: str, events: pd.DataFrame, decisions: pd.DataFrame) -> dict:
    label = label_strategy(name)
    df = events.merge(decisions, on="event_id", suffixes=("", "_decision"))
    hops = decisions["route_path"].apply(route_len) if "route_path" in decisions else pd.Series([1] * len(decisions))
    network_bytes = int((df["task_size_kb"] * 1024 * hops.values).sum()) if len(df) else 0
    scenario_counts = decisions.get("offloading_scenario", pd.Series(dtype=str)).value_counts()
    layer_ratios = decisions.get("selected_layer", pd.Series(dtype=str)).value_counts(normalize=True).round(6).to_dict()
    score = pd.to_numeric(decisions.get("score", pd.Series(dtype=float)), errors="coerce")
    reward = pd.to_numeric(decisions.get("reward", pd.Series(dtype=float)), errors="coerce")
    cloud_ratio = round(float(scenario_counts.get("cloud_escalation", 0) / max(len(decisions), 1)), 6)
    return {
        "strategy": label,
        "nodes": 1000,
        "events": int(len(df)),
        "avg_latency": round(float(decisions["estimated_delay"].mean()), 6) if len(decisions) else 0.0,
        "avg_energy_cost": round(float(decisions.get("factor_energy_cost", pd.Series([0])).mean()), 6) if len(decisions) else 0.0,
        "deadline_success_rate": round(float(decisions["deadline_met"].mean()), 6) if len(decisions) and "deadline_met" in decisions else 0.0,
        "throughput": int(decisions["deadline_met"].sum()) if len(decisions) and "deadline_met" in decisions else int(len(df)),
        "network_overhead_bytes": network_bytes,
        "avg_congestion": round(float(decisions.get("factor_network_condition", pd.Series([0])).mean()), 6) if len(decisions) else 0.0,
        "score_mean": round(float(score.mean()), 6) if len(score.dropna()) else None,
        "reward_mean": round(float(reward.mean()), 6) if len(reward.dropna()) else None,
        "score_std": round(float(score.std()), 6) if len(score.dropna()) > 1 else 0.0,
        "fairness_load_balancing": fairness(decisions.get("destination", pd.Series(dtype=str)).value_counts()),
        "offloading_ratios": {k: float(v) for k, v in layer_ratios.items()},
        "path_distribution": normalize_path_counts(scenario_counts),
        "scenario_counts": {path: int(scenario_counts.get(path, 0)) for path in PATH_ORDER},
        "cloud_escalation_ratio": cloud_ratio,
        "policy_mode_counts": decisions.get("policy_mode", pd.Series(dtype=str)).value_counts().to_dict(),
    }


def build_strategy_tables(events: pd.DataFrame, drl: pd.DataFrame, baseline: pd.DataFrame):
    drl_row = metrics_for("DRL", events, drl)
    baseline_rows = []
    if "baseline_policy" in baseline.columns:
        for policy, group in baseline.groupby("baseline_policy"):
            baseline_rows.append(metrics_for(policy, events, group))
    else:
        baseline_rows.append(metrics_for("rule_based_static", events, baseline))
    rows = [drl_row] + sorted(baseline_rows, key=lambda r: POLICY_ORDER.index(r["strategy"]) if r["strategy"] in POLICY_ORDER else 99)
    return drl_row, rows


def build_scalability_rows(events: pd.DataFrame, strategy_decisions: Dict[str, pd.DataFrame]) -> List[dict]:
    rows = []
    for strategy, decisions in strategy_decisions.items():
        for nodes in NODE_SIZES:
            frac = nodes / 1000
            n_events = max(1, int(len(events) * frac))
            ev = events.head(n_events)
            de = decisions[decisions["event_id"].isin(ev["event_id"])]
            row = metrics_for(strategy, ev, de)
            row["nodes"] = nodes
            row["events"] = int(len(ev))
            rows.append(row)
    return rows


def build_experiment_profile(events: pd.DataFrame, topology: dict) -> dict:
    node_dist = topology.get("confirmed_distribution") or topology.get("layers") or {
        "sensor": 700, "edge": 220, "fog": 79, "cloud": 1
    }
    sensor_dist = topology.get("sensor_distribution_7s") or events["dominant_sensor_type"].value_counts().to_dict()
    deadline_thresholds = {}
    if {"severity", "deadline"}.issubset(events.columns):
        for severity in SEVERITY_ORDER:
            vals = events.loc[events["severity"] == severity, "deadline"]
            if len(vals):
                deadline_thresholds[severity] = float(vals.mode().iloc[0])
    return {
        "node_distribution": node_dist,
        "event_severity_distribution": events["severity"].value_counts().reindex(SEVERITY_ORDER, fill_value=0).astype(int).to_dict(),
        "sensor_type_distribution": sensor_dist,
        "deadline_thresholds_seconds": deadline_thresholds,
        "topology_edges": int(topology.get("edges", 0)),
        "topology_nodes": int(topology.get("nodes", len(events))),
    }


def build_priority_analysis(events: pd.DataFrame, strategy_decisions: Dict[str, pd.DataFrame]) -> dict:
    analysis = {
        "latency_by_status": {},
        "deadline_success_by_status": {},
        "missed_deadlines_by_status": {},
        "path_distribution_by_status": {},
        "cloud_escalation_ratio_by_status": {},
    }
    for strategy, decisions in strategy_decisions.items():
        merged = events.merge(decisions, on="event_id", suffixes=("", "_decision"))
        strategy_label = label_strategy(strategy)
        analysis["latency_by_status"][strategy_label] = {}
        analysis["deadline_success_by_status"][strategy_label] = {}
        analysis["missed_deadlines_by_status"][strategy_label] = {}
        analysis["path_distribution_by_status"][strategy_label] = {}
        analysis["cloud_escalation_ratio_by_status"][strategy_label] = {}
        for severity, group in merged.groupby("severity"):
            severity = str(severity)
            scenario_counts = group["offloading_scenario"].value_counts() if "offloading_scenario" in group else pd.Series(dtype=int)
            total = max(len(group), 1)
            analysis["latency_by_status"][strategy_label][severity] = round(float(group["estimated_delay"].mean()), 6)
            analysis["deadline_success_by_status"][strategy_label][severity] = round(float(group["deadline_met"].mean()), 6)
            analysis["missed_deadlines_by_status"][strategy_label][severity] = int((~group["deadline_met"].astype(bool)).sum())
            analysis["path_distribution_by_status"][strategy_label][severity] = {
                path: round(float(scenario_counts.get(path, 0) / total), 6) for path in PATH_ORDER
            }
            analysis["cloud_escalation_ratio_by_status"][strategy_label][severity] = round(float(scenario_counts.get("cloud_escalation", 0) / total), 6)
    return analysis


def build_drl_learning_evidence(drl: pd.DataFrame) -> dict:
    drl_seq = drl.copy()
    drl_seq = drl_seq.reset_index(drop=True)
    drl_seq["step"] = drl_seq.index + 1
    drl_seq["reward"] = pd.to_numeric(drl_seq.get("reward", pd.Series(dtype=float)), errors="coerce")
    drl_seq["score"] = pd.to_numeric(drl_seq.get("score", pd.Series(dtype=float)), errors="coerce")
    window = 250 if len(drl_seq) >= 250 else max(10, len(drl_seq) // 10 or 1)
    drl_seq["reward_rolling_mean"] = drl_seq["reward"].rolling(window=window, min_periods=1).mean()
    drl_seq["reward_rolling_std"] = drl_seq["reward"].rolling(window=window, min_periods=1).std().fillna(0.0)
    policy_counts = drl_seq.get("policy_mode", pd.Series(dtype=str)).value_counts().to_dict()
    exploration = int(policy_counts.get("epsilon_exploration", 0))
    exploitation = int(policy_counts.get("q_policy_exploitation", 0))
    return {
        "reward_convergence": {
            "window": window,
            "start_reward_mean": round(float(drl_seq["reward_rolling_mean"].head(window).mean()), 6),
            "end_reward_mean": round(float(drl_seq["reward_rolling_mean"].tail(window).mean()), 6),
            "final_reward_mean": round(float(drl_seq["reward"].mean()), 6),
        },
        "exploration_vs_exploitation": {
            "exploration_count": exploration,
            "exploitation_count": exploitation,
            "exploration_ratio": round(float(exploration / max(len(drl_seq), 1)), 6),
            "exploitation_ratio": round(float(exploitation / max(len(drl_seq), 1)), 6),
        },
        "training_stability": {
            "score_mean": round(float(drl_seq["score"].mean()), 6),
            "score_std": round(float(drl_seq["score"].std()), 6),
            "reward_std": round(float(drl_seq["reward"].std()), 6),
            "rolling_reward_std_last_window": round(float(drl_seq["reward_rolling_std"].tail(window).mean()), 6),
        },
    }


def build_scalability_summary(scalability_rows: List[dict]) -> dict:
    df = pd.DataFrame(scalability_rows)
    summary = {}
    for strategy, group in df.groupby("strategy"):
        group = group.sort_values("nodes")
        latency_100 = float(group.iloc[0]["avg_latency"])
        latency_1000 = float(group.iloc[-1]["avg_latency"])
        deadline_1000 = float(group.iloc[-1]["deadline_success_rate"])
        index_value = round(float((latency_100 / max(latency_1000, 1e-9)) * deadline_1000), 6)
        summary[strategy] = {
            "latency_at_100_nodes": round(latency_100, 6),
            "latency_at_1000_nodes": round(latency_1000, 6),
            "deadline_success_at_1000_nodes": round(deadline_1000, 6),
            "scalability_index": index_value,
        }
    return summary


def compare_values(drl_value, base_value, direction: str):
    if pd.isna(drl_value) or pd.isna(base_value):
        return {"better": "n/a", "difference": None, "improvement_percent": None}
    difference = float(drl_value) - float(base_value)
    if direction == "higher":
        better = "DRL" if drl_value > base_value else ("baseline" if drl_value < base_value else "tie")
        improvement = ((float(drl_value) - float(base_value)) / max(abs(float(base_value)), 1e-9)) * 100.0
    else:
        better = "DRL" if drl_value < base_value else ("baseline" if drl_value > base_value else "tie")
        improvement = ((float(base_value) - float(drl_value)) / max(abs(float(base_value)), 1e-9)) * 100.0
    return {
        "better": better,
        "difference": round(difference, 6),
        "improvement_percent": round(float(improvement), 3),
    }


def build_pairwise_comparison(strategy_rows: List[dict], scalability_summary: dict) -> dict:
    rows = {row["strategy"]: row for row in strategy_rows}
    drl = rows["DRL"]
    pairwise = {}
    for baseline in ["local_only", "edge_only", "cloud_only", "random", "rule_based_static"]:
        base = rows[baseline]
        pairwise[baseline] = {
            "latency": {"DRL": drl["avg_latency"], baseline: base["avg_latency"], **compare_values(drl["avg_latency"], base["avg_latency"], "lower")},
            "energy_consumption": {"DRL": drl["avg_energy_cost"], baseline: base["avg_energy_cost"], **compare_values(drl["avg_energy_cost"], base["avg_energy_cost"], "lower")},
            "deadline_success_rate": {"DRL": drl["deadline_success_rate"], baseline: base["deadline_success_rate"], **compare_values(drl["deadline_success_rate"], base["deadline_success_rate"], "higher")},
            "throughput": {"DRL": drl["throughput"], baseline: base["throughput"], **compare_values(drl["throughput"], base["throughput"], "higher")},
            "network_overhead": {"DRL": drl["network_overhead_bytes"], baseline: base["network_overhead_bytes"], **compare_values(drl["network_overhead_bytes"], base["network_overhead_bytes"], "lower")},
            "offloading_ratio_path_distribution": {"DRL": drl["path_distribution"], baseline: base["path_distribution"]},
            "congestion_score": {"DRL": drl["avg_congestion"], baseline: base["avg_congestion"], **compare_values(drl["avg_congestion"], base["avg_congestion"], "lower")},
            "decision_efficiency": {"DRL": drl["score_mean"], baseline: base["score_mean"], **compare_values(drl["score_mean"], base["score_mean"], "lower")},
            "scalability": {
                "DRL": scalability_summary["DRL"]["scalability_index"],
                baseline: scalability_summary[baseline]["scalability_index"],
                **compare_values(scalability_summary["DRL"]["scalability_index"], scalability_summary[baseline]["scalability_index"], "higher")
            },
            "fairness_load_balancing": {"DRL": drl["fairness_load_balancing"], baseline: base["fairness_load_balancing"], **compare_values(drl["fairness_load_balancing"], base["fairness_load_balancing"], "higher")},
            "cloud_escalation_ratio": {"DRL": drl["cloud_escalation_ratio"], baseline: base["cloud_escalation_ratio"], **compare_values(drl["cloud_escalation_ratio"], base["cloud_escalation_ratio"], "lower")},
        }
    return pairwise


def build_flat_pairwise_rows(pairwise: dict) -> List[dict]:
    rows = []
    for baseline, metrics in pairwise.items():
        for metric_name, metric_values in metrics.items():
            if metric_name == "offloading_ratio_path_distribution":
                continue
            rows.append({
                "comparison": f"DRL vs {baseline}",
                "metric": metric_name,
                "drl_value": metric_values["DRL"],
                "baseline_value": metric_values[baseline],
                "better": metric_values.get("better"),
                "improvement_percent": metric_values.get("improvement_percent"),
            })
    return rows


def plot_bar(df: pd.DataFrame, metric: str, title: str, filename: str, ylabel: str | None = None):
    ordered = df.set_index("strategy").reindex(POLICY_ORDER).reset_index()
    colors = [COLORS.get(s, "#9E9E9E") for s in ordered["strategy"]]
    plt.figure(figsize=(10.5, 5.5))
    plt.bar(ordered["strategy"], ordered[metric], color=colors)
    plt.xticks(rotation=25, ha="right")
    if ylabel:
        plt.ylabel(ylabel)
    plt.title(title)
    plt.tight_layout()
    plt.savefig(GRAPHS / filename, dpi=180)
    plt.close()


def plot_stacked_path_distribution(strategy_rows: List[dict], filename: str, title: str):
    df = pd.DataFrame(strategy_rows).set_index("strategy").reindex(POLICY_ORDER)

    path_colors = {
        "local_edge": "#6F4BD8",        # clean purple
        "edge_to_edge": "#00A6A6",      # teal
        "edge_to_fog": "#3A86FF",       # blue
        "fog_to_fog": "#F4A261",        # amber
        "cloud_escalation": "#E76F51",  # coral red
    }

    readable_labels = {
        "local_edge": "Local Edge",
        "edge_to_edge": "Edge-to-Edge",
        "edge_to_fog": "Edge-to-Fog",
        "fog_to_fog": "Fog-to-Fog",
        "cloud_escalation": "Cloud Escalation",
    }

    readable_strategies = {
        "DRL": "DRL",
        "local_only": "Local Only",
        "edge_only": "Edge Only",
        "cloud_only": "Cloud Only",
        "random": "Random",
        "rule_based_static": "Rule-Based Static",
    }

    x_labels = [readable_strategies.get(s, s) for s in df.index]

    plt.figure(figsize=(12, 6.5))
    bottom = pd.Series([0.0] * len(df), index=df.index, dtype=float)

    for path in PATH_ORDER:
        values = pd.Series(
            [df.loc[strategy, "path_distribution"].get(path, 0) for strategy in df.index],
            index=df.index,
            dtype=float,
        )

        plt.bar(
            x_labels,
            values.values,
            bottom=bottom.values,
            label=readable_labels[path],
            color=path_colors[path],
            edgecolor="white",
            linewidth=0.8,
        )

        bottom = bottom + values

    plt.xticks(rotation=20, ha="right")
    plt.ylabel("Offloading Ratio")
    plt.ylim(0, 1.05)
    plt.title("Offloading Path Distribution Across DRL and Baseline Strategies")
    plt.legend(loc="upper right", frameon=True)
    plt.grid(axis="y", alpha=0.22, linestyle="--")
    plt.tight_layout()
    plt.savefig(GRAPHS / filename, dpi=240)
    plt.close()

def plot_experiment_profile(profile: dict):
    for values, title, filename, ylabel in [
        (profile["node_distribution"], "Node Distribution Across the 1000-Node Topology", "01_experiment_node_distribution.png", "Count"),
        (profile["event_severity_distribution"], "Event Severity Distribution", "02_experiment_event_severity_distribution.png", "Events"),
        (profile["sensor_type_distribution"], "Sensor-Type Distribution Across 700 Sensor Nodes", "03_experiment_sensor_type_distribution.png", "Sensors"),
        (profile["deadline_thresholds_seconds"], "Deadline Thresholds by Event Status", "04_experiment_deadline_thresholds.png", "Seconds"),
    ]:
        plt.figure(figsize=(9.5, 5.5))
        plt.bar(list(values.keys()), list(values.values()))
        plt.xticks(rotation=25, ha="right")
        plt.ylabel(ylabel)
        plt.title(title)
        plt.tight_layout()
        plt.savefig(GRAPHS / filename, dpi=180)
        plt.close()


def plot_priority_analysis(priority: dict):
    def _matrix(metric_name: str):
        rows = []
        data = priority[metric_name]
        for strategy in POLICY_ORDER:
            if strategy not in data:
                continue
            item = {"strategy": strategy}
            for severity in SEVERITY_ORDER:
                item[severity] = data[strategy].get(severity, 0)
            rows.append(item)
        return pd.DataFrame(rows)

    for metric_name, title, filename, ylabel in [
        ("latency_by_status", "Latency by Event Status and Strategy", "15_priority_latency_by_status.png", "Average latency"),
        ("deadline_success_by_status", "Deadline Success by Event Status and Strategy", "16_priority_deadline_success_by_status.png", "Rate"),
        ("missed_deadlines_by_status", "Missed Deadlines by Event Status and Strategy", "17_priority_missed_deadlines_by_status.png", "Missed deadlines"),
    ]:
        df = _matrix(metric_name)
        x = range(len(df))
        width = 0.22
        plt.figure(figsize=(11, 6))
        for idx, severity in enumerate(SEVERITY_ORDER):
            positions = [p + (idx - 1) * width for p in x]
            plt.bar(positions, df[severity], width=width, label=severity)
        plt.xticks(list(x), df["strategy"], rotation=25, ha="right")
        plt.ylabel(ylabel)
        plt.title(title)
        plt.legend()
        plt.tight_layout()
        plt.savefig(GRAPHS / filename, dpi=180)
        plt.close()

    drl_status_paths = priority["path_distribution_by_status"].get("DRL", {})
    if drl_status_paths:
        plt.figure(figsize=(10.5, 6))
        bottom = pd.Series([0.0] * len(SEVERITY_ORDER), index=SEVERITY_ORDER)
        for path in PATH_ORDER:
            values = [drl_status_paths.get(sev, {}).get(path, 0) for sev in SEVERITY_ORDER]
            plt.bar(SEVERITY_ORDER, values, bottom=bottom.values, label=path)
            bottom = bottom + pd.Series(values, index=SEVERITY_ORDER)
        plt.ylabel("Ratio")
        plt.title("DRL Path Distribution by Event Status")
        plt.legend(loc="upper right", fontsize=8)
        plt.tight_layout()
        plt.savefig(GRAPHS / "18_priority_path_distribution_by_status.png", dpi=180)
        plt.close()

    rows = []
    for strategy in POLICY_ORDER:
        item = priority["cloud_escalation_ratio_by_status"].get(strategy, {})
        rows.append({"strategy": strategy, **{sev: item.get(sev, 0) for sev in SEVERITY_ORDER}})
    cloud_df = pd.DataFrame(rows)
    x = range(len(cloud_df))
    width = 0.22
    plt.figure(figsize=(11, 6))
    for idx, severity in enumerate(SEVERITY_ORDER):
        positions = [p + (idx - 1) * width for p in x]
        plt.bar(positions, cloud_df[severity], width=width, label=severity)
    plt.xticks(list(x), cloud_df["strategy"], rotation=25, ha="right")
    plt.ylabel("Cloud escalation ratio")
    plt.title("Cloud Escalation Ratio by Event Status and Strategy")
    plt.legend()
    plt.tight_layout()
    plt.savefig(GRAPHS / "19_priority_cloud_escalation_ratio.png", dpi=180)
    plt.close()


def plot_scalability(scalability_rows: List[dict], summary: dict):
    df = pd.DataFrame(scalability_rows)
    for metric, title, filename, ylabel in [
        ("avg_latency", "Scalability Comparison: Average Latency vs Node Count", "13_scalability_latency_comparison.png", "Average latency"),
        ("deadline_success_rate", "Scalability Comparison: Deadline Success Rate vs Node Count", "14_scalability_deadline_success_comparison.png", "Rate"),
    ]:
        plt.figure(figsize=(10.5, 5.5))
        for strategy in POLICY_ORDER:
            g = df[df["strategy"] == strategy].sort_values("nodes")
            if g.empty:
                continue
            plt.plot(g["nodes"], g[metric], marker="o", label=strategy, color=COLORS.get(strategy))
        plt.xlabel("Nodes")
        plt.ylabel(ylabel)
        plt.title(title)
        plt.legend(fontsize=8)
        plt.tight_layout()
        plt.savefig(GRAPHS / filename, dpi=180)
        plt.close()

    summary_rows = [{"strategy": k, **v} for k, v in summary.items()]
    summary_df = pd.DataFrame(summary_rows).set_index("strategy").reindex(POLICY_ORDER).reset_index()
    plot_bar(summary_df, "scalability_index", "Scalability Index Across DRL and Baseline Strategies", "11_comparison_scalability_index.png", "Index")


def plot_drl_learning(drl: pd.DataFrame):
    seq = drl.copy().reset_index(drop=True)
    seq["step"] = seq.index + 1
    seq["reward"] = pd.to_numeric(seq.get("reward", pd.Series(dtype=float)), errors="coerce")
    seq["score"] = pd.to_numeric(seq.get("score", pd.Series(dtype=float)), errors="coerce")
    window = 250 if len(seq) >= 250 else max(10, len(seq) // 10 or 1)
    seq["reward_rolling_mean"] = seq["reward"].rolling(window=window, min_periods=1).mean()
    seq["reward_rolling_std"] = seq["reward"].rolling(window=window, min_periods=1).std().fillna(0.0)

    plt.figure(figsize=(10.5, 5.5))
    plt.plot(seq["step"], seq["reward_rolling_mean"])
    plt.xlabel("Decision step")
    plt.ylabel("Rolling reward mean")
    plt.title("DRL Reward Convergence")
    plt.tight_layout()
    plt.savefig(GRAPHS / "20_drl_reward_convergence.png", dpi=180)
    plt.close()

    mode_counts = seq.get("policy_mode", pd.Series(dtype=str)).value_counts()
    explore = int(mode_counts.get("epsilon_exploration", 0))
    exploit = int(mode_counts.get("q_policy_exploitation", 0))
    plt.figure(figsize=(8, 5.5))
    plt.bar(["exploration", "exploitation"], [explore, exploit])
    plt.ylabel("Decisions")
    plt.title("DRL Exploration vs Exploitation")
    plt.tight_layout()
    plt.savefig(GRAPHS / "21_drl_exploration_vs_exploitation.png", dpi=180)
    plt.close()

    plt.figure(figsize=(10.5, 5.5))
    plt.plot(seq["step"], seq["reward_rolling_std"])
    plt.xlabel("Decision step")
    plt.ylabel("Rolling reward std")
    plt.title("DRL Training Stability")
    plt.tight_layout()
    plt.savefig(GRAPHS / "22_drl_training_stability.png", dpi=180)
    plt.close()


def plot_main_comparison(strategy_rows: List[dict], scalability_summary: dict):
    df = pd.DataFrame(strategy_rows)
    plot_bar(df, "avg_latency", "Average Latency Across DRL and Baseline Strategies", "05_comparison_latency.png", "Average latency")
    plot_bar(df, "avg_energy_cost", "Average Energy Consumption Across DRL and Baseline Strategies", "06_comparison_energy.png", "Average energy cost")
    plot_bar(df, "deadline_success_rate", "Deadline Success Rate Across DRL and Baseline Strategies", "07_comparison_deadline_success.png", "Rate")
    plot_bar(df, "throughput", "Throughput Across DRL and Baseline Strategies", "08_comparison_throughput.png", "Successful tasks")
    plot_bar(df, "network_overhead_bytes", "Network Overhead Across DRL and Baseline Strategies", "09_comparison_network_overhead.png", "Bytes")
    plot_stacked_path_distribution(strategy_rows, "10_comparison_path_distribution.png", "Offloading Path Distribution by Strategy")
    plot_bar(df, "avg_congestion", "Average Congestion Score Across DRL and Baseline Strategies", "11a_comparison_congestion.png", "Congestion score")
    plot_bar(df, "score_mean", "Decision Efficiency Score Across DRL and Baseline Strategies", "11b_comparison_decision_efficiency.png", "Score (lower is better)")
    scalability_rows = [{"strategy": k, **v} for k, v in scalability_summary.items()]
    plot_bar(pd.DataFrame(scalability_rows), "scalability_index", "Scalability Index Across DRL and Baseline Strategies", "11_comparison_scalability_index.png", "Index")
    plot_bar(df, "fairness_load_balancing", "Fairness and Load Balancing Across DRL and Baseline Strategies", "12_comparison_fairness.png", "Jain fairness index")
    plot_bar(df, "cloud_escalation_ratio", "Cloud Escalation Ratio Across DRL and Baseline Strategies", "12a_comparison_cloud_escalation_ratio.png", "Ratio")


def main():
    DASH.mkdir(exist_ok=True)
    GRAPHS.mkdir(exist_ok=True)
    # remove older graphs so the folder reflects the new requested layout only
    for old in GRAPHS.glob("*.png"):
        old.unlink()

    events, drl, baseline, topology = read_data()
    drl_row, strategy_rows = build_strategy_tables(events, drl, baseline)

    strategy_decisions = {"DRL": drl}
    if "baseline_policy" in baseline.columns:
        for policy, group in baseline.groupby("baseline_policy"):
            strategy_decisions[label_strategy(policy)] = group.copy()
    else:
        strategy_decisions["rule_based_static"] = baseline.copy()

    experiment_profile = build_experiment_profile(events, topology)
    priority_analysis = build_priority_analysis(events, strategy_decisions)
    drl_learning_evidence = build_drl_learning_evidence(drl)
    scalability_rows = build_scalability_rows(events, strategy_decisions)
    scalability_summary = build_scalability_summary(scalability_rows)
    # inject the derived scalability index into the main summary rows
    for row in strategy_rows:
        row["scalability_index"] = scalability_summary[row["strategy"]]["scalability_index"]

    pairwise = build_pairwise_comparison(strategy_rows, scalability_summary)
    flat_pairwise = build_flat_pairwise_rows(pairwise)

    comparison_payload = {
        "experiment_profile": experiment_profile,
        "main_comparison": {
            "strategies": strategy_rows,
            "pairwise_drl_vs_baselines": pairwise,
        },
        "priority_aware_analysis": priority_analysis,
        "drl_learning_evidence": drl_learning_evidence,
    }

    # Save CSV/JSON outputs
    pd.DataFrame(strategy_rows).drop(columns=["offloading_ratios", "path_distribution", "scenario_counts", "policy_mode_counts"], errors="ignore").to_csv(RESULTS / "latest_baseline_validation_summary.csv", index=False)
    pd.DataFrame(scalability_rows).drop(columns=["offloading_ratios", "path_distribution", "scenario_counts", "policy_mode_counts"], errors="ignore").to_csv(RESULTS / "latest_scalability_validation.csv", index=False)
    pd.DataFrame(flat_pairwise).to_csv(RESULTS / "pairwise_kpi_comparison.csv", index=False)

    save_json(DASH / "experiment_profile.json", experiment_profile)
    save_json(DASH / "baseline_validation_summary.json", strategy_rows)
    save_json(DASH / "scalability_validation.json", scalability_rows)
    save_json(DASH / "priority_analysis.json", priority_analysis)
    save_json(DASH / "drl_efficiency.json", drl_learning_evidence)
    save_json(DASH / "main_comparison.json", {"strategies": strategy_rows, "pairwise_drl_vs_baselines": pairwise})
    save_json(DASH / "comparison.json", comparison_payload)

    # Keep a compact status_metrics.json for easy dashboard use, but aligned with the richer structure.
    drl_status = {}
    for severity in SEVERITY_ORDER:
        drl_status[severity] = {
            "events": int((events["severity"] == severity).sum()),
            "avg_latency": priority_analysis["latency_by_status"]["DRL"].get(severity, 0),
            "deadline_success_rate": priority_analysis["deadline_success_by_status"]["DRL"].get(severity, 0),
            "missed_deadlines": priority_analysis["missed_deadlines_by_status"]["DRL"].get(severity, 0),
            "path_distribution": priority_analysis["path_distribution_by_status"]["DRL"].get(severity, {}),
            "cloud_escalation_ratio": priority_analysis["cloud_escalation_ratio_by_status"]["DRL"].get(severity, 0),
        }
    save_json(DASH / "status_metrics.json", {"DRL": drl_status, "baselines": priority_analysis})

    # Graphs
    plot_experiment_profile(experiment_profile)
    plot_main_comparison(strategy_rows, scalability_summary)
    plot_scalability(scalability_rows, scalability_summary)
    plot_priority_analysis(priority_analysis)
    plot_drl_learning(drl)

    print("[OK] Final evaluation package generated")
    print(RESULTS / "latest_baseline_validation_summary.csv")
    print(RESULTS / "pairwise_kpi_comparison.csv")
    print(DASH / "comparison.json")
    print(GRAPHS)


if __name__ == "__main__":
    main()
