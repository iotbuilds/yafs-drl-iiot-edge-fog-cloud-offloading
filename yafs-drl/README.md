# YAFS IIoT DQN Offloading System

Integrated 1000-node IIoT dynamic task offloading package mapped to the project requirements. The current system uses a DQN-based offloading selector for multi-objective edge-fog-cloud decisions.

- **7S sensor readings:** vibration, temperature, pressure, current, acoustic, flow rate, humidity.
- **7F DQN decision factors:** delay, hop count, congestion/network condition, energy, task size, bandwidth, compute capacity.
- **DQN policy:** deep Q-value approximation with epsilon-greedy exploration, reward feedback, replay memory, Bellman targets, and learned action values.
- **Reliability support metric:** link reliability is kept as an additional topology-aware qualitative feature (`factor_reliability_risk`), not counted as one of the core 7F factors.
- **Topology:** 869 sensor/machine nodes, 100 edge gateways, 30 fog nodes, 1 cloud node. Dashboard/alert/storage/analytics are cloud services, not separate topology endpoints.
- **Scenarios:** normal, warning, critical, repeated warning, edge-to-edge, edge-to-fog, fog-to-fog, cloud escalation, congestion, node overload/failure, 24h shift report.
- **Cloud/dashboard exports:** events, node status, offloading decisions, KPIs, baseline comparison, shift report, cloud records, topology image.

## Run

```bash
cd yafs-drl
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
python topology/visualize_topology.py
```

## Outputs

```text
results/events.csv
results/offloading_decisions.csv
results/baseline_decisions.csv
topology/iiot_topology_1000.graphml
topology/topology_summary.json
dashboard_exports/events.json
dashboard_exports/offloading_decisions.json
dashboard_exports/node_status.json
dashboard_exports/kpis.json
dashboard_exports/baseline_comparison.json
dashboard_exports/shift_report.json
dashboard_exports/cloud_records.json
dashboard_exports/topology_1000_nodes.png
```

## Notes

This package is YAFS-ready and can also run standalone to validate the 7F/7S logic before binding it to a specific YAFS version. Use `yafs_adapter_notes.py` for how to plug the selector/population into your existing YAFS folder.


## Updated validation additions

This version adds the missing requirement checks:

1. **Normal cloud summaries**
   - Normal raw readings are buffered at edge/cloud policy.
   - Aggregated `normal_summary` records are sent every demo interval.
   - This avoids sending all normal raw data to cloud while still supporting dashboard trends.

2. **Status-condition trace**
   - `results/status_condition_trace.csv`
   - `dashboard_exports/status_condition_trace.json`
   - These files show:
     - when the condition was triggered
     - whether it was sent to cloud
     - record type sent to cloud
     - selected layer
     - estimated delivery delay
     - deadline
     - deadline_met

3. **12h / 24h validation**
   - Critical events use compressed 12h deadline = 120 simulation seconds.
   - Warning events use compressed 24h deadline = 240 simulation seconds.
   - Run:
     ```bash
     python analysis/validate_requirements.py
     ```

4. **Fog-to-fog validation**
   - A small reproducible stress scenario is included to force fog-to-fog rerouting when a selected fog path is congested/overloaded.
   - The result appears as `offloading_scenario = fog-to-fog`.

## Recommended run

```bash
python main.py
python analysis/compute_kpis.py
python analysis/compare_baseline.py
python analysis/validate_requirements.py
```

Useful quick checks:

```bash
grep -c "normal_summary" dashboard_exports/cloud_records.json
grep -c "warning_summary" dashboard_exports/cloud_records.json
grep -c "critical_alert" dashboard_exports/cloud_records.json
grep -c "fog-to-fog" results/offloading_decisions.csv
python -m json.tool dashboard_exports/requirements_validation.json
```
