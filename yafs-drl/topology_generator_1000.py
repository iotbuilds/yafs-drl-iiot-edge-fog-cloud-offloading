"""Generate the confirmed 1000-node IIoT topology.

Confirmed distribution:
- 700 IIoT sensor nodes
- 220 edge nodes
- 79 fog nodes
- 1 centralized cloud node
"""
from __future__ import annotations
import json
import random
from pathlib import Path
import networkx as nx

from config import NODE_SPLIT, SEED, SENSOR_DISTRIBUTION, TOPOLOGY_DIR

def _node_id(prefix: str, i: int) -> str:
    return f"{prefix}_{i:04d}"

def _sensor_category_list() -> list[str]:
    items: list[str] = []
    for sensor_type, count in SENSOR_DISTRIBUTION.items():
        items.extend([sensor_type] * count)
    if len(items) != NODE_SPLIT["sensor"]:
        raise ValueError("SENSOR_DISTRIBUTION must total 700 sensor nodes")
    return items

def generate_topology(seed: int = SEED) -> nx.Graph:
    rng = random.Random(seed)
    g = nx.Graph()
    zones = [f"zone_{i}" for i in range(1, 11)]

    for i in range(NODE_SPLIT["edge"]):
        zone = zones[i % len(zones)]
        g.add_node(_node_id("edge", i), layer="edge", node_type="edge_gateway", zone=zone,
                   IPT=rng.randint(3500, 9000), compute_capacity=round(rng.uniform(0.55, 0.98), 4),
                   energy=round(rng.uniform(0.45, 1.0), 4), status="active", failure_reason="none",
                   sensor_type="none", has_7s=False, role="edge_decision_layer")

    for i in range(NODE_SPLIT["fog"]):
        zone = zones[i % len(zones)]
        g.add_node(_node_id("fog", i), layer="fog", node_type="fog_node", zone=zone,
                   IPT=rng.randint(9000, 22000), compute_capacity=round(rng.uniform(0.68, 1.0), 4),
                   energy=round(rng.uniform(0.70, 1.0), 4), status="active", failure_reason="none",
                   sensor_type="none", has_7s=False, role="intermediate_processing_and_fog_to_fog")

    for i in range(NODE_SPLIT["cloud"]):
        g.add_node(_node_id("cloud", i), layer="cloud", node_type="centralized_cloud_node", zone="cloud",
                   IPT=rng.randint(30000, 60000), compute_capacity=1.0, energy=1.0,
                   status="active", failure_reason="none", sensor_type="none", has_7s=False,
                   role="centralized_analytics_api_dashboard_storage_reporting_escalation",
                   cloud_services="analytics,api,dashboard,storage,reporting,escalation")

    edge_nodes = [n for n, d in g.nodes(data=True) if d["layer"] == "edge"]
    fog_nodes = [n for n, d in g.nodes(data=True) if d["layer"] == "fog"]
    cloud_nodes = [n for n, d in g.nodes(data=True) if d["layer"] == "cloud"]

    sensor_types = _sensor_category_list()
    for i, sensor_type in enumerate(sensor_types):
        zone = zones[i % len(zones)]
        n = _node_id("sensor", i)
        g.add_node(n, layer="sensor", node_type="iiot_sensor_node", zone=zone,
                   sensor_type=sensor_type, dominant_7s=sensor_type, has_7s=True,
                   IPT=0, compute_capacity=0.05, energy=round(rng.uniform(0.20, 0.95), 4),
                   status="active", failure_reason="none", role="7s_event_source")
        candidate_edges = [e for e in edge_nodes if g.nodes[e]["zone"] == zone]
        # Attach to two local edges when possible for realistic redundancy.
        for e in rng.sample(candidate_edges, k=min(2, len(candidate_edges))):
            _add_link(g, n, e, rng, kind="sensor_edge")

    for zone in zones:
        z_edges = [e for e in edge_nodes if g.nodes[e]["zone"] == zone]
        for e in z_edges:
            for other in rng.sample([x for x in z_edges if x != e], k=min(3, max(0, len(z_edges)-1))):
                _add_link(g, e, other, rng, kind="edge_edge")
            for fog in rng.sample(fog_nodes, k=min(3, len(fog_nodes))):
                _add_link(g, e, fog, rng, kind="edge_fog")

    for fog in fog_nodes:
        for other in rng.sample([f for f in fog_nodes if f != fog], k=min(4, len(fog_nodes)-1)):
            _add_link(g, fog, other, rng, kind="fog_fog")
        for c in cloud_nodes:
            _add_link(g, fog, c, rng, kind="fog_cloud")

    return g

def _add_link(g: nx.Graph, a: str, b: str, rng: random.Random, kind: str) -> None:
    if g.has_edge(a, b):
        return
    params = {
        "sensor_edge": (20, 90, 0.2, 2.0),
        "edge_edge": (50, 180, 0.5, 4.0),
        "edge_fog": (100, 280, 1.0, 6.0),
        "fog_fog": (140, 350, 1.0, 5.0),
        "fog_cloud": (180, 550, 5.0, 18.0),
    }[kind]
    bw_min, bw_max, pr_min, pr_max = params
    g.add_edge(a, b, kind=kind,
               BW=round(rng.uniform(bw_min, bw_max), 3),
               PR=round(rng.uniform(pr_min, pr_max), 3),
               congestion=round(rng.uniform(0.03, 0.55), 3),
               reliability=round(rng.uniform(0.88, 0.999), 3))

def save_topology(g: nx.Graph, out_dir: Path = TOPOLOGY_DIR) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    nx.write_graphml(g, out_dir / "iiot_topology_1000.graphml")
    layers: dict[str, int] = {}
    sensor_distribution: dict[str, int] = {}
    for _, d in g.nodes(data=True):
        layers[d["layer"]] = layers.get(d["layer"], 0) + 1
        if d["layer"] == "sensor":
            st = d.get("sensor_type", "unknown")
            sensor_distribution[st] = sensor_distribution.get(st, 0) + 1
    summary = {
        "nodes": g.number_of_nodes(),
        "edges": g.number_of_edges(),
        "confirmed_distribution": {"sensor": 700, "edge": 220, "fog": 79, "cloud": 1},
        "layers": layers,
        "sensor_distribution_7s": sensor_distribution,
        "cloud_count_rule": "one centralized cloud node only",
    }
    (out_dir / "topology_summary.json").write_text(json.dumps(summary, indent=2))

if __name__ == "__main__":
    graph = generate_topology()
    save_topology(graph)
    print(f"Generated {graph.number_of_nodes()} nodes and {graph.number_of_edges()} links")
