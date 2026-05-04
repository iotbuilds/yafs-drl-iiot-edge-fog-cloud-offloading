# YAFS DRL 7F Final Demo Validated Package

This package is built from the previously integrated validated YAFS implementation and adds final demo validation outputs.

## Includes

- 1000-node IIoT topology
- seven sensor types and thresholds
- 7-factor DRL/Q-learning selector
- edge-to-edge, edge-to-fog, fog-to-fog, and cloud escalation
- cloud policy for normal summaries, warning summaries, and critical alerts
- baseline validation
- scalability validation
- proposal metrics: latency, energy, throughput, network overhead, DRL efficiency, scalability
- generated graphs
- FastAPI API
- local-cloud exporter

## Fast validation

```bash
bash run_demo_validation.sh
```

## Full YAFS rerun + validation

```bash
RUN_CORE=1 bash run_demo_validation.sh
```

## API

```bash
bash run_api.sh
```

Open:

```text
http://localhost:8000/docs
```

## Important outputs

```text
results/latest_baseline_validation_summary.csv
results/latest_scenario_validation.csv
results/latest_scalability_validation.csv
dashboard_exports/final_demo_readiness.json
dashboard_exports/baseline_validation_summary.json
dashboard_exports/scenario_validation.json
dashboard_exports/scalability_validation.json
dashboard_exports/drl_efficiency.json
graphs/*.png
```
