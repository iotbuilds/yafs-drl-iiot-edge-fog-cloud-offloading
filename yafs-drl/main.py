"""Main runner for the confirmed IIoT DRL/YAFS 7F/7S/3L simulation."""
from __future__ import annotations
import json
import shutil
from pathlib import Path
import pandas as pd

from config import DEFAULT_STEPS, EVENTS_PER_STEP, RESULTS_DIR, DASHBOARD_DIR, TOPOLOGY_DIR, GRAPHS_DIR, SEED, EVENT_INTERVAL, BASELINE_POLICIES
from topology_generator_1000 import generate_topology, save_topology
from Evolutive_population import EvolutivePopulation
from drl_q_selector import DRLQSelector
from selection_multipleDeploys import StaticCloudFogSelector
from cloud_policy import CloudPolicy
from analysis.compute_kpis import compute_kpis
from analysis.compare_baseline import compare
from analysis.export_dashboard_json import export_all

class EdgeProcessing:
    def __init__(self, selector: DRLQSelector):
        self.selector = selector
    def process(self, event: dict) -> dict:
        return self.selector.select(event)

class FogProcessing:
    def enrich(self, event: dict, decision: dict) -> dict:
        decision["fog_processing_required"] = decision["selected_layer"] in {"fog", "cloud"}
        return decision

class CloudAnalytics:
    def __init__(self):
        self.policy = CloudPolicy()
        self.cloud_records = []
    def ingest(self, event: dict, decision: dict):
        record = self.policy.handle(event, decision)
        if record:
            self.cloud_records.append(record)
    def periodic(self, timestamp: float):
        self.cloud_records.extend(self.policy.periodic_normal_summaries(timestamp))
    def finalize(self):
        self.cloud_records.extend(self.policy.finalize())

class CloudDashboard:
    def export(self, graph, events, decisions, baseline_decisions, cloud_records, status_trace=None):
        RESULTS_DIR.mkdir(exist_ok=True)
        DASHBOARD_DIR.mkdir(exist_ok=True)
        pd.DataFrame(events).to_csv(RESULTS_DIR / "events.csv", index=False)
        pd.DataFrame(decisions).to_csv(RESULTS_DIR / "offloading_decisions.csv", index=False)
        pd.DataFrame(baseline_decisions).to_csv(RESULTS_DIR / "baseline_decisions.csv", index=False)
        (DASHBOARD_DIR / "cloud_records.json").write_text(json.dumps(cloud_records, indent=2))
        if status_trace is not None:
            pd.DataFrame(status_trace).to_csv(RESULTS_DIR / "status_condition_trace.csv", index=False)
            (DASHBOARD_DIR / "status_condition_trace.json").write_text(json.dumps(status_trace, indent=2))
        compute_kpis(RESULTS_DIR / "events.csv", RESULTS_DIR / "offloading_decisions.csv", DASHBOARD_DIR / "kpis.json")
        compare(RESULTS_DIR / "offloading_decisions.csv", RESULTS_DIR / "baseline_decisions.csv", RESULTS_DIR / "events.csv", DASHBOARD_DIR / "comparison.json")
        # Backward-compatible name.
        shutil.copyfile(DASHBOARD_DIR / "comparison.json", DASHBOARD_DIR / "baseline_comparison.json")
        export_all(Path(__file__).resolve().parent)

def clean_outputs() -> None:
    for d in [RESULTS_DIR, DASHBOARD_DIR, GRAPHS_DIR, TOPOLOGY_DIR]:
        d.mkdir(exist_ok=True)
    for pattern_dir in [RESULTS_DIR, DASHBOARD_DIR, GRAPHS_DIR]:
        for p in pattern_dir.glob("*"):
            if p.is_file():
                p.unlink()

def run(steps: int = DEFAULT_STEPS, events_per_step: int = EVENTS_PER_STEP):
    clean_outputs()
    graph = generate_topology(seed=SEED)
    save_topology(graph, TOPOLOGY_DIR)

    population = EvolutivePopulation(graph, events_per_step=events_per_step, seed=SEED)
    selector = DRLQSelector(graph, seed=SEED)
    baseline = StaticCloudFogSelector(graph, seed=SEED)
    edge = EdgeProcessing(selector)
    fog = FogProcessing()
    cloud = CloudAnalytics()
    dashboard = CloudDashboard()

    all_events = []
    all_decisions = []
    baseline_decisions = []

    for step in range(steps):
        events = population.run_step(step)
        for event in events:
            decision = edge.process(event)
            decision = fog.enrich(event, decision)
            cloud.ingest(event, decision)
            all_events.append(event)
            all_decisions.append(decision)
            for policy in BASELINE_POLICIES:
                baseline_decisions.append(baseline.select_for_policy(event, policy))
        cloud.periodic(step * EVENT_INTERVAL)

    cloud.finalize()
    dashboard.export(graph, all_events, all_decisions, baseline_decisions, cloud.cloud_records, cloud.policy.status_trace)
    print(f"Simulation complete: {len(all_events)} events, {graph.number_of_nodes()} nodes, {graph.number_of_edges()} links")
    print(f"Confirmed nodes: 700 sensors, 220 edge, 79 fog, 1 cloud")
    print(f"Results: {RESULTS_DIR}")
    print(f"Dashboard exports: {DASHBOARD_DIR}")

if __name__ == "__main__":
    run()
