# Final Demo Validation Coverage

This package keeps the integrated YAFS/DRL implementation as the core and adds demo-ready validation outputs, local-cloud export, API endpoints, and graphs.

## Required proposal items included

| Proposal item | Evidence file / endpoint |
|---|---|
| 1000-node topology | `topology/iiot_topology_1000.graphml`, `topology/topology_summary.json` |
| Baseline validation | `results/latest_baseline_validation_summary.csv`, `/api/summary` |
| Task execution latency | `avg_latency`, `graphs/01_latency_baseline.png` |
| Energy consumption | `avg_energy_cost`, `graphs/02_energy_baseline.png` |
| Throughput | `throughput`, `throughput_rate`, `graphs/04_throughput_baseline.png` |
| Network overhead | `network_overhead_bytes`, `graphs/03_network_overhead_baseline.png` |
| DRL model efficiency | `dashboard_exports/drl_efficiency.json`, `/api/drl-efficiency` |
| Scalability performance | `results/latest_scalability_validation.csv`, graphs 06-08, `/api/scalability` |
| Edge-to-edge | `results/latest_scenario_validation.csv`, `/api/scenarios` |
| Edge-to-fog | `results/latest_scenario_validation.csv`, `/api/scenarios` |
| Fog-to-fog | `results/latest_scenario_validation.csv`, `/api/scenarios` |
| Cloud escalation | `results/latest_scenario_validation.csv`, `/api/scenarios` |
| 12h/24h deadline behavior | `dashboard_exports/requirements_validation.json`, `/api/requirements-validation` |
| Dashboard outputs | `dashboard_exports/*.json` |
| Graph outputs | `graphs/*.png` |

## Run order for demo

```bash
cd YAFS_DRL_7F_Final_Demo_Validated
conda activate yafs7f
pip install -r requirements.txt
bash run_demo_validation.sh
bash run_local_cloud_exporter.sh
# in a new terminal
bash run_api.sh
```

Open:

```text
http://localhost:8000/docs
```

## Full rerun of the YAFS core

```bash
RUN_CORE=1 bash run_demo_validation.sh
```

This reruns `main.py` first, then regenerates the validation tables/graphs.
