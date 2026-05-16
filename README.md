# YAFS DRL IIoT Edge-Fog-Cloud Offloading

This repository contains the final IIoT edge-fog-cloud offloading project:

- `yafs-drl/` contains the YAFS/DRL simulation, event generation, PyTorch DQN offloading logic, baseline comparison, KPI computation, cloud policy, validation scripts, and dashboard/API exports.
- `system-dashboard/` contains the ASP.NET Core API and Angular dashboard used to view the simulation outputs, cloud records, topology, KPI tables, path distribution, baseline comparison, and validation results.

## Final Folder Structure

```text
yafs-drl-iiot-edge-fog-cloud-offloading/
  system-dashboard/
    backend/
    frontend/
    README.md
  yafs-drl/
    analysis/
    dashboard_exports/
    docs/
    src/
    topology/
    main.py
    drl_dqn_selector.py
    event_generator.py
    cloud_policy.py
    README.md
  .gitattributes
  .gitignore
  README.md
```

## Confirmed Model

- Topology size: 1000 nodes.
- Node distribution: 700 sensors, 220 edge nodes, 79 fog nodes, and 1 cloud node.
- Sensor model: one sensor reading generates one event.
- Sensor types: vibration, temperature, pressure, current, acoustic, flow rate, humidity.
- Severity classes: normal, warning, and critical.
- DQN decision factors: delay, hop count, network condition/congestion, energy consumption, task size, bandwidth, and node computing capacity.
- DQN implementation: PyTorch neural Q-network with replay memory, Bellman targets, Adam optimization, and target-network synchronization.
- Offloading actions: local edge, edge-to-edge, edge-to-fog, fog-to-fog, and cloud escalation.
- Main quantitative performance measures: 10 measures including latency, energy, deadline success, throughput, network overhead, offloading path distribution, congestion score, decision efficiency, scalability, and fairness/load balancing.

## Cloud Transmission Policy

- Critical events are sent to cloud as alerts.
- Warning events are summarized and sent to cloud.
- Normal events are aggregated into summaries instead of sending every raw normal reading.
- Cloud records are exported for dashboard/API use.

## Run The Simulation

```bash
cd yafs-drl
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
python analysis/compute_kpis.py
python analysis/compare_baseline.py
python analysis/validate_requirements.py
python analysis/export_dashboard_json.py
```

## Run The Dashboard API

```bash
cd system-dashboard/backend
export YAFS_DATA_ROOT=../../yafs-drl
dotnet restore
dotnet run
```

API URL:

```text
http://127.0.0.1:8002
```

## Run The Dashboard

Open a second terminal:

```bash
cd system-dashboard/frontend
npm install
npm start
```

Dashboard URL:

```text
http://127.0.0.1:4200
```

## Notes

The dashboard reads real JSON exports from `yafs-drl/dashboard_exports/`. It does not hardcode KPI values. If outputs are regenerated, rerun the API and refresh the dashboard.
