"""Create the requested DRL vs baseline comparison summary.

This module keeps a compact programmatic entry point while aligning with the
final expert comparison structure used by validate_proposal_metrics.py.
"""
from __future__ import annotations

import json
from pathlib import Path
import pandas as pd

from analysis.validate_proposal_metrics import (
    build_strategy_tables,
    build_scalability_rows,
    build_scalability_summary,
    build_pairwise_comparison,
    label_strategy,
)


def compare(drl_csv: str | Path, baseline_csv: str | Path, events_csv: str | Path, out_json: str | Path) -> dict:
    events = pd.read_csv(events_csv)
    drl = pd.read_csv(drl_csv)
    baseline = pd.read_csv(baseline_csv)

    _, strategy_rows = build_strategy_tables(events, drl, baseline)
    strategy_decisions = {"DRL": drl}
    if "baseline_policy" in baseline.columns:
        for policy, group in baseline.groupby("baseline_policy"):
            strategy_decisions[label_strategy(policy)] = group.copy()
    else:
        strategy_decisions["rule_based_static"] = baseline.copy()

    scalability_rows = build_scalability_rows(events, strategy_decisions)
    scalability_summary = build_scalability_summary(scalability_rows)
    for row in strategy_rows:
        row["scalability_index"] = scalability_summary[row["strategy"]]["scalability_index"]

    report = {
        "strategies": strategy_rows,
        "pairwise_drl_vs_baselines": build_pairwise_comparison(strategy_rows, scalability_summary),
    }
    out = Path(out_json)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    result = compare(
        root / "results/offloading_decisions.csv",
        root / "results/baseline_decisions.csv",
        root / "results/events.csv",
        root / "dashboard_exports/comparison.json",
    )
    print(json.dumps(result, indent=2))
