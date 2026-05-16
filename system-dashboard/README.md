# System Dashboard

ASP.NET Core and Angular dashboard for the YAFS IIoT DQN edge-fog-cloud offloading simulation.

The dashboard visualizes the exported simulation data from `../yafs-drl`, including KPIs, topology, offloading decisions, cloud records, status traces, path distribution, baseline comparison, and validation reports.

## Structure

```text
system-dashboard/
  backend/    ASP.NET Core Web API
  frontend/   Angular + Tailwind CSS + daisyUI dashboard
```

## Data Source

The backend expects the DRL data folder to contain:

```text
yafs-drl/
  dashboard_exports/
  topology/
  local_cloud_storage/
```

Use this environment variable so the API reads from the GitHub folder layout:

```bash
export YAFS_DATA_ROOT=../../yafs-drl
```

## Run Backend API

```bash
cd system-dashboard/backend
export YAFS_DATA_ROOT=../../yafs-drl
dotnet restore
dotnet run
```

Default API URL:

```text
http://127.0.0.1:8002
```

Useful endpoints:

```text
GET /api/health
GET /api/kpis
GET /api/events
GET /api/decisions
GET /api/nodes
GET /api/topology
GET /api/status-metrics
GET /api/comparison
GET /api/paths
GET /api/cloud-records
GET /api/status-trace
GET /api/report
```

Swagger/OpenAPI:

```text
http://127.0.0.1:8002/swagger
http://127.0.0.1:8002/openapi/v1.json
```

## Run Frontend Dashboard

Open a second terminal while the API is running:

```bash
cd system-dashboard/frontend
npm install
npm start
```

Default dashboard URL:

```text
http://127.0.0.1:4200
```

The Angular API base URL is configured in:

```text
frontend/src/environments/environment.ts
```

## Dashboard Notes

- Uses DQN wording throughout.
- Shows the confirmed 1000-node model: 700 sensors, 220 edge nodes, 79 fog nodes, and 1 cloud node.
- Uses a simplified 2D/stacked network view to avoid clutter from all 1000 nodes.
- Uses grouped link/route visualization so the view stays readable.
- Charts are generated from API data and simulation timestamps.
- If the API is stopped, the dashboard status indicator changes to inactive.
