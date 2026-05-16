# Cloud

ASP.NET Core and Angular cloud dashboard implementation for the YAFS IIoT DQN offloading simulation.

## Structure

```text
Cloud/
  backend/    ASP.NET Core Web API
  frontend/   Angular + Tailwind CSS + daisyUI dashboard
```

The backend reads real simulation outputs from the YAFS data folder. It does not hardcode metrics.

## Required Data

The API expects a YAFS DQN data folder containing:

```text
dashboard_exports/
results/
topology/
local_cloud_storage/latest/
graphs/
```

If this `Cloud` folder is stored beside `DRL` inside `YAFS/examples`, the default backend setting already points to:

```text
../../DRL
```

If the evaluator uses the GitHub folder names `Cloud`, `yafs-drl`, and `system-dashboard`, run the API with:

```bash
export YAFS_DATA_ROOT=../../yafs-drl
```

## Run Backend API

```bash
cd Cloud/backend
dotnet restore
dotnet run
```

Default API URL:

```text
http://127.0.0.1:8002
```

Swagger/OpenAPI:

```text
http://127.0.0.1:8002/openapi/v1.json
```

Health check:

```text
http://127.0.0.1:8002/api/health
```

## Run Frontend Dashboard

Open a second terminal while the API is running:

```bash
cd Cloud/frontend
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

## Change Ports

Backend default port is `8002`. If it is busy, edit the last line of `backend/Program.cs` or run ASP.NET with another URL.

Frontend default port is `4200`. If it is busy, run:

```bash
npx ng serve --host 127.0.0.1 --port 4201
```

## API Endpoints

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
GET /api/summary
GET /api/scenarios
GET /api/scalability
GET /api/drl-efficiency
GET /api/final-demo-readiness
GET /api/requirements-validation
GET /api/shift-report
GET /api/report
GET /api/cloud-records
GET /api/status-trace
GET /api/graphs
GET /api/graphs/{filename}
```

## Dashboard Notes

- Uses DQN wording throughout.
- Uses Computational Load instead of CPU.
- Uses Sensor Status Distribution instead of Node Status Distribution.
- Charts are generated from API data and simulation timestamps.
- If the API is stopped, the dashboard status indicator changes to inactive.
