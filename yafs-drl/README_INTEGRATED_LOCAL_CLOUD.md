# YAFS DRL 7F Integrated Local Cloud Final

This folder combines the validated YAFS-style/compatible DRL simulation outputs with a dashboard-ready local cloud/API layer.

## Main rule

The simulation source of truth is the validated YAFS package outputs:

- `dashboard_exports/`
- `results/`
- `topology/`

The older LocalCloud simulation assumptions are not used.

## Start API

```bash
bash run_integrated_api.sh
```

API docs:

```text
http://localhost:8000/docs
```

## Create latest cloud snapshot only

```bash
bash run_cloud_export_once.sh
```

This writes:

- `local_cloud_storage/latest/latest.json`
- copies of dashboard-ready JSON files
- timestamped archive in `local_cloud_storage/exports/`

## Key endpoints

- `/api/latest`
- `/api/topology`
- `/api/events`
- `/api/decisions`
- `/api/kpis`
- `/api/baselines`
- `/api/path-distribution`
- `/api/severity`
- `/api/cloud-records`
- `/api/report`

## Confirmed requirements reflected

- 1000 nodes
- 700 sensors / 220 edge / 79 fog / 1 cloud
- 7S confirmed sensor distribution
- 3L only: normal, warning, critical
- 10,000 events
- Q-learning/DRL-style decision outputs
- baseline comparison
- 10P KPI schema
- local cloud/API emulation
