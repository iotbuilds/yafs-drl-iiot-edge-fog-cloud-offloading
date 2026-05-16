# YAFS IIoT DQN Offloading System

Integrated 1000-node IIoT dynamic task offloading package for edge-fog-cloud computing. The current system uses a DQN-based offloading selector for multi-objective decisions and exports results for the dashboard/API layer.

## Confirmed Simulation Model

- Topology: 1000 total nodes.
- Node distribution: 700 sensors, 220 edge nodes, 79 fog nodes, and 1 cloud node.
- Sensor/event model: one sensor reading is one event.
- Sensor types: vibration, temperature, pressure, current, acoustic, flow rate, humidity.
- Event severity classes: normal, warning, critical.
- DQN decision factors: delay, hop count, network condition/congestion, energy consumption, task size, bandwidth, and node computing capacity.
- Reliability is kept as a support/topology-risk signal where available, but it is not counted as one of the core 7F factors.
- Offloading actions: local edge, edge-to-edge, edge-to-fog, fog-to-fog, and cloud escalation.

## Computations Included

- 1000-node topology generation.
- Sensor event generation from the seven sensor types.
- Severity classification for normal, warning, and critical events.
- Payload size, protocol/security overhead, and computation-demand estimation.
- DQN offloading decision computation.
- Dynamic node/link load updates after decisions.
- Baseline comparison against local-only, edge-only, cloud-only, random, and rule-based static cloud/fog strategies.
- KPI computation for latency, energy, deadline success, throughput, network overhead, offloading path distribution, congestion score, decision efficiency, scalability, and fairness/load balancing.
- Cloud export generation for normal summaries, warning summaries, critical alerts, and dashboard/API records.

## Run The Simulation

```bash
cd yafs-drl
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

## Run Analysis And Exports

```bash
python analysis/compute_kpis.py
python analysis/compare_baseline.py
python analysis/validate_requirements.py
python analysis/export_dashboard_json.py
```

## Run The API

The dashboard API is located in `system-dashboard/backend`. To serve this folder's exports:

```bash
cd ../system-dashboard/backend
export YAFS_DATA_ROOT=../../yafs-drl
dotnet restore
dotnet run
```

API URL:

```text
http://127.0.0.1:8002
```

## Run With The Dashboard

Keep the API terminal running, then open a second terminal:

```bash
cd system-dashboard/frontend
npm install
npm start
```

Dashboard URL:

```text
http://127.0.0.1:4200
```

## Main Outputs

```text
dashboard_exports/events.json
dashboard_exports/offloading_decisions.json
dashboard_exports/nodes.json
dashboard_exports/node_status.json
dashboard_exports/kpis.json
dashboard_exports/baseline_comparison.json
dashboard_exports/comparison.json
dashboard_exports/paths.json
dashboard_exports/cloud_records.json
dashboard_exports/status_condition_trace.json
dashboard_exports/status_metrics.json
dashboard_exports/topology.json
topology/iiot_topology_1000.graphml
topology/topology_summary.json
```

## Cloud Policy

- Normal readings are aggregated into summaries.
- Warning readings generate warning summaries.
- Critical readings generate critical cloud alerts.
- Exported cloud records are used by the dashboard and API.

## Notes

This package is YAFS-ready and can also run standalone to validate the 7S/7F logic before binding it to another YAFS environment.
