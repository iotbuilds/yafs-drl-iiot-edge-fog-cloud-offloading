# YAFS IIoT DQN Dashboard

Frontend dashboard for the YAFS IIoT DQN offloading simulation. The dashboard connects to the cloud API and displays live API-derived KPIs, simulation-time trends, offloading paths, sensor status distribution, topology views, analytics, and reports.

## Highlights

- API-connected cards and charts for simulation outputs.
- Simulation-time replay for latency, energy, congestion, and computational load.
- Dynamic active/inactive status based on API availability.
- Dark and light mode chart tooltips.
- Pages for overview, topology, 7S sensors, 7F factors, offloading logs, analytics, tables, and report export.

## Run

```bash
npm install
VITE_YAFS_API_PROXY_TARGET=http://127.0.0.1:8002 npm run dev -- --host 127.0.0.1 --port 5174
```
