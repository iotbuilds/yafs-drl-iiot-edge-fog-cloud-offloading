# Confirmed IIoT DRL/YAFS Project

This version is patched to follow `DRL_IIoT_Confirmed_Requirements.docx`.

## Confirmed configuration

- **1000 topology nodes**: 700 sensors, 220 edge nodes, 79 fog nodes, 1 cloud node
- **7S sensor readings**: vibration, temperature, pressure, current, acoustic, flow rate, humidity
- **3L event levels only**: normal, warning, critical
- **3L timing**: critical ≤ 10 s, warning ≤ 30 s, normal periodic every 2 minutes
- **7F DRL factors**: delay, hop count, network condition/congestion, energy consumption, task size, bandwidth, node computing capacity
- **DQN model**: PyTorch neural Q-network with epsilon-greedy exploration, reward learning, replay memory, target-network Bellman updates, Adam optimization, and learned action values.
- **Actions/paths**: local_edge, edge_to_edge, edge_to_fog, fog_to_fog, cloud_escalation
- **Final event count**: 10,000 events
- **Baselines**: local_only, edge_only, cloud_only, random, rule_based_static_cloud_fog

## Run

```bash
conda create -n yafs7f python=3.11 -y
conda activate yafs7f
pip install -r requirements.txt
bash run_demo_validation.sh
```

## Check outputs

```bash
python -m json.tool topology/topology_summary.json
python -m json.tool dashboard_exports/requirements_validation.json
python -m json.tool dashboard_exports/kpis.json
python -m json.tool dashboard_exports/comparison.json
open graphs
python -m json.tool dashboard_exports/scalability_validation.json
```

## Run API

```bash
bash run_api.sh
```

Open:

```text
http://localhost:8000/docs
```

Required API endpoints are available:

- `/api/kpis`
- `/api/events`
- `/api/nodes`
- `/api/topology`
- `/api/status-metrics`
- `/api/comparison`
- `/api/paths`
- `/api/graphs`
