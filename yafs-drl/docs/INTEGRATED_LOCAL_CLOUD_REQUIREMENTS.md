# Integrated YAFS + Local Cloud Requirements

## Source of truth

Use this package as the integrated final base. The simulation source is the validated YAFS-style/compatible DRL package, not the older LocalCloud simulation logic.

Confirmed simulation requirements:

- 1000 nodes total
- 700 sensor nodes
- 220 edge nodes
- 79 fog nodes
- 1 cloud node
- 7S sensor distribution:
  - Vibration: 120
  - Temperature: 120
  - Pressure: 100
  - Current: 100
  - Acoustic: 100
  - Flow Rate: 80
  - Humidity: 80
- 3L event levels only:
  - normal
  - warning
  - critical
- 3L cloud transmission policy:
  - Critical: transmit/update to cloud every 1 minute
  - Warning: transmit/update to cloud every 3 minutes
  - Normal: aggregate at edge and send one normal summary per sensor/node per 5-minute window
- 10,000 events
- 7F decision factors:
  - delay
  - hop count
  - network condition / congestion
  - energy consumption
  - task size
  - bandwidth
  - node computing capacity
- Offloading paths:
  - local_edge
  - edge_to_edge
  - edge_to_fog
  - fog_to_fog
  - cloud_escalation

## What was integrated

The package keeps the validated YAFS outputs and updates the local cloud/API layer to serve those outputs directly.

The API now exposes:

- `/health`
- `/api/latest`
- `/api/confirmed-requirements`
- `/api/topology`
- `/api/nodes`
- `/api/events`
- `/api/decisions`
- `/api/kpis`
- `/api/baselines`
- `/api/baseline-comparison`
- `/api/path-distribution`
- `/api/severity`
- `/api/cloud-records`
- `/api/scalability`
- `/api/drl-efficiency`
- `/api/requirements-validation`
- `/api/report`
- `/api/shift-report`
- `/api/graphs`

## What was not used from the older LocalCloud ZIP

The older LocalCloud simulation assumptions should not be used:

- 850 sensors
- 100 edge nodes
- 30 fog nodes
- 10 cloud nodes
- 10 endpoints
- 2000 tasks
- any fourth event level for repeated warnings; repeated warnings remain a flag under `warning`
- weighted heuristic decision logic as the final DRL logic

Only the useful cloud/API concepts were kept:

- latest snapshot
- local cloud storage structure
- periodic exporter behavior
- FastAPI dashboard endpoints
- shift/report endpoint idea

## How the dashboard should reflect YAFS data

The dashboard should consume the API outputs from `dashboard_exports` and `local_cloud_storage/latest`.

It should show:

- topology: 700 sensors, 220 edge, 79 fog, 1 cloud
- 7S event streams
- 3L severity counts
- DRL offloading decisions
- decision reasons and 7F factors
- 10P KPIs
- DRL vs baseline comparison
- cloud escalation records
- cloud transmission records using the confirmed 1/3/5-minute 3L policy
- shift/report summaries

## Run commands

Prepare one latest cloud snapshot:

```bash
bash run_cloud_export_once.sh
```

Run the API:

```bash
bash run_integrated_api.sh
```

Then open:

```text
http://localhost:8000/docs
```
