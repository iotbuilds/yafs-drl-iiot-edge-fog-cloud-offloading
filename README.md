# YAFS DRL IIoT Edge-Fog-Cloud Offloading

A multi-objective, energy- and latency-aware DRL framework for dynamic task offloading in IIoT using YAFS, Edge AI, Fog, and Cloud integration.

## Repository Structure

- `yafs-drl/` - YAFS simulation, DRL offloading policy, cloud transmission policy, API exporter, and validation scripts.
- `system-dashboard/` - React/Vite dashboard that reads live YAFS API data and visualizes node status, offloading decisions, plant view, analytics, reports, and cloud transmission records.

## Confirmed Cloud Transmission Policy

- Critical: transmit/update to cloud every 1 minute.
- Warning: transmit/update to cloud every 3 minutes.
- Normal: aggregate at the edge and send one normal summary per node per 5-minute window.
- Normal raw readings are not all sent to cloud.
- Repeated warning remains a flag under `warning`, not a fourth status level.

## Run The YAFS Simulation

```bash
cd yafs-drl
python3 -m pip install -r requirements.txt
python3 main.py
python3 analysis/validate_requirements.py
python3 scripts/prepare_cloud_exports.py
```

## Run The YAFS API

```bash
cd yafs-drl
YAFS_API_PORT=8002 ./run_api.sh
```

## Run The Dashboard

```bash
cd system-dashboard
npm install
npm run dev -- --host 127.0.0.1 --port 5178
```

Open:

```text
http://127.0.0.1:5178/
```

The dashboard proxy defaults to the YAFS API at `http://localhost:8002`.
