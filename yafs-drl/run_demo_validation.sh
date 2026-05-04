#!/usr/bin/env bash
set -euo pipefail
# Set RUN_CORE=0 to skip simulation and regenerate validation only from existing results.
if [[ "${RUN_CORE:-1}" == "1" ]]; then
  python main.py
fi
python -m analysis.validate_requirements
python -m analysis.validate_proposal_metrics
python topology/visualize_topology.py
printf '\n[OK] Confirmed requirements validation completed.\n'
printf 'Open API with: bash run_api.sh then http://localhost:8000/docs\n'

# Auto-classify graphs into evaluation folders
python - <<'PY'
from pathlib import Path
import shutil

GRAPHS = Path("graphs")
OUT = GRAPHS / "classified_by_evaluation_category"

categories = {
    "A_Experiment_Profile": [
        "01_experiment_node_distribution.png",
        "02_experiment_event_severity_distribution.png",
        "03_experiment_sensor_type_distribution.png",
        "04_experiment_deadline_thresholds.png",
    ],
    "B_Main_DRL_vs_Baseline_Comparison": [
        "05_comparison_latency.png",
        "06_comparison_energy.png",
        "07_comparison_deadline_success.png",
        "08_comparison_throughput.png",
        "09_comparison_network_overhead.png",
        "10_comparison_path_distribution.png",
        "11a_comparison_congestion.png",
        "11b_comparison_decision_efficiency.png",
        "11_comparison_scalability_index.png",
        "12_comparison_fairness.png",
        "12a_comparison_cloud_escalation_ratio.png",
        "13_scalability_latency_comparison.png",
        "14_scalability_deadline_success_comparison.png",
    ],
    "C_Priority_Aware_Analysis": [
        "15_priority_latency_by_status.png",
        "16_priority_deadline_success_by_status.png",
        "17_priority_missed_deadlines_by_status.png",
        "18_priority_path_distribution_by_status.png",
        "19_priority_cloud_escalation_ratio.png",
    ],
    "D_DRL_Only_Learning_Evidence": [
        "20_drl_reward_convergence.png",
        "21_drl_exploration_vs_exploitation.png",
        "22_drl_training_stability.png",
    ],
}

OUT.mkdir(parents=True, exist_ok=True)

for folder, files in categories.items():
    folder_path = OUT / folder
    folder_path.mkdir(parents=True, exist_ok=True)

    for file_name in files:
        src = GRAPHS / file_name
        dst = folder_path / file_name
        if src.exists():
            shutil.copy2(src, dst)

print("[OK] Graphs automatically classified into folders.")
PY

# Auto-copy topology/network view into classified graph folders
python - <<'PY'
from pathlib import Path
import shutil

OUT = Path("graphs/classified_by_evaluation_category/E_Topology_and_Network_View")
OUT.mkdir(parents=True, exist_ok=True)

topology_files = [
    Path("dashboard_exports/topology_1000_nodes.png"),
    Path("dashboard_exports/topology.json"),
    Path("topology/topology_summary.json"),
]

for src in topology_files:
    if src.exists():
        shutil.copy2(src, OUT / src.name)
        print(f"[OK] Copied {src} -> {OUT}")
    else:
        print(f"[MISSING] {src}")

print("[OK] Topology/network view copied into classified folders.")
PY

# Auto-copy topology/network view into classified graph folders
python - <<'PY'
from pathlib import Path
import shutil

OUT = Path("graphs/classified_by_evaluation_category/E_Topology_and_Network_View")
OUT.mkdir(parents=True, exist_ok=True)

topology_files = [
    Path("dashboard_exports/topology_1000_nodes.png"),
    Path("dashboard_exports/topology.json"),
    Path("topology/topology_summary.json"),
]

for src in topology_files:
    if src.exists():
        shutil.copy2(src, OUT / src.name)
        print(f"[OK] Copied {src} -> {OUT}")
    else:
        print(f"[MISSING] {src}")

print("[OK] Topology/network view copied into classified folders.")
PY
