"""
visualize_topology.py

Generates a clearer 1000-node IIoT topology visualization:
- 700 sensor nodes
- 220 edge nodes
- 79 fog nodes
- 1 cloud node

Output:
dashboard_exports/topology_1000_nodes.png
"""

from pathlib import Path
import json
import math
import random

import matplotlib.pyplot as plt
import networkx as nx


# ============================================================
# Configuration
# ============================================================

RANDOM_SEED = 42

TOTAL_SENSORS = 700
TOTAL_EDGE = 220
TOTAL_FOG = 79
TOTAL_CLOUD = 1

OUTPUT_DIR = Path("dashboard_exports")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_IMAGE = OUTPUT_DIR / "topology_1000_nodes.png"
OUTPUT_JSON = OUTPUT_DIR / "topology.json"

TITLE = "Confirmed 1000-node IIoT topology: 700 sensors, 220 edge, 79 fog, 1 cloud"


# ============================================================
# Node Creation
# ============================================================

def create_nodes():
    sensor_nodes = [f"sensor_{i:04d}" for i in range(TOTAL_SENSORS)]
    edge_nodes = [f"edge_{i:04d}" for i in range(TOTAL_EDGE)]
    fog_nodes = [f"fog_{i:04d}" for i in range(TOTAL_FOG)]
    cloud_nodes = ["cloud_0000"]

    return sensor_nodes, edge_nodes, fog_nodes, cloud_nodes


# ============================================================
# Position Layout
# ============================================================

def grid_positions(nodes, x, rows, y_min=0.05, y_max=0.95, x_spread=0.28):
    """
    Arrange nodes in a neat grid layer.
    x: center x position of the layer
    rows: number of rows in that layer
    """
    pos = {}
    cols = math.ceil(len(nodes) / rows)

    y_range = y_max - y_min
    x_start = x - x_spread / 2
    x_step = x_spread / max(cols - 1, 1)
    y_step = y_range / max(rows - 1, 1)

    for idx, node in enumerate(nodes):
        row = idx // cols
        col = idx % cols

        px = x_start + col * x_step
        py = y_max - row * y_step

        pos[node] = (px, py)

    return pos


def create_positions(sensor_nodes, edge_nodes, fog_nodes, cloud_nodes):
    """
    Fixed layered layout:
    sensors -> edge -> fog -> cloud
    """
    pos = {}

    # Sensors: dense left block
    pos.update(grid_positions(
        sensor_nodes,
        x=0.16,
        rows=28,
        y_min=0.08,
        y_max=0.92,
        x_spread=0.30
    ))

    # Edge: middle block
    pos.update(grid_positions(
        edge_nodes,
        x=0.52,
        rows=14,
        y_min=0.08,
        y_max=0.92,
        x_spread=0.20
    ))

    # Fog: right-center block
    pos.update(grid_positions(
        fog_nodes,
        x=0.78,
        rows=7,
        y_min=0.08,
        y_max=0.92,
        x_spread=0.12
    ))

    # Cloud: one node on far right
    pos[cloud_nodes[0]] = (0.96, 0.50)

    return pos


# ============================================================
# Edge Creation
# ============================================================

def create_edges(sensor_nodes, edge_nodes, fog_nodes, cloud_nodes):
    """
    Creates layered links:
    - sensor -> edge
    - edge -> edge
    - edge -> fog
    - fog -> fog
    - fog -> cloud

    This keeps all required topology behavior but avoids making the image unreadable.
    """
    random.seed(RANDOM_SEED)

    sensor_to_edge_edges = []
    edge_to_edge_edges = []
    edge_to_fog_edges = []
    fog_to_fog_edges = []
    fog_to_cloud_edges = []

    # Sensor to edge:
    # Each sensor connects to nearest-style assigned edge plus one backup edge.
    for i, sensor in enumerate(sensor_nodes):
        primary_edge = edge_nodes[i % len(edge_nodes)]
        backup_edge = edge_nodes[(i * 7 + 13) % len(edge_nodes)]

        sensor_to_edge_edges.append((sensor, primary_edge))
        sensor_to_edge_edges.append((sensor, backup_edge))

    # Edge to edge:
    # Connect edge nodes in local neighbor pattern for edge-to-edge routing.
    for i, edge in enumerate(edge_nodes):
        next_edge = edge_nodes[(i + 1) % len(edge_nodes)]
        jump_edge = edge_nodes[(i + 11) % len(edge_nodes)]

        edge_to_edge_edges.append((edge, next_edge))

        if i % 3 == 0:
            edge_to_edge_edges.append((edge, jump_edge))

    # Edge to fog:
    # Each edge connects to two fog candidates.
    for i, edge in enumerate(edge_nodes):
        primary_fog = fog_nodes[i % len(fog_nodes)]
        backup_fog = fog_nodes[(i * 5 + 9) % len(fog_nodes)]

        edge_to_fog_edges.append((edge, primary_fog))
        edge_to_fog_edges.append((edge, backup_fog))

    # Fog to fog:
    # Connect fog nodes to allow fog-to-fog path.
    for i, fog in enumerate(fog_nodes):
        next_fog = fog_nodes[(i + 1) % len(fog_nodes)]
        fog_to_fog_edges.append((fog, next_fog))

        if i % 4 == 0:
            jump_fog = fog_nodes[(i + 7) % len(fog_nodes)]
            fog_to_fog_edges.append((fog, jump_fog))

    # Fog to cloud:
    # Every fog node can escalate to the single cloud node.
    cloud = cloud_nodes[0]
    for fog in fog_nodes:
        fog_to_cloud_edges.append((fog, cloud))

    return {
        "sensor_to_edge": sensor_to_edge_edges,
        "edge_to_edge": edge_to_edge_edges,
        "edge_to_fog": edge_to_fog_edges,
        "fog_to_fog": fog_to_fog_edges,
        "fog_to_cloud": fog_to_cloud_edges,
    }


# ============================================================
# Graph Build
# ============================================================

def build_graph():
    sensor_nodes, edge_nodes, fog_nodes, cloud_nodes = create_nodes()
    pos = create_positions(sensor_nodes, edge_nodes, fog_nodes, cloud_nodes)
    edge_groups = create_edges(sensor_nodes, edge_nodes, fog_nodes, cloud_nodes)

    G = nx.Graph()

    for node in sensor_nodes:
        G.add_node(node, role="sensor")

    for node in edge_nodes:
        G.add_node(node, role="edge")

    for node in fog_nodes:
        G.add_node(node, role="fog")

    for node in cloud_nodes:
        G.add_node(node, role="cloud")

    for edge_type, edges in edge_groups.items():
        for u, v in edges:
            G.add_edge(u, v, edge_type=edge_type)

    return G, pos, sensor_nodes, edge_nodes, fog_nodes, cloud_nodes, edge_groups


# ============================================================
# Export Topology JSON
# ============================================================

def export_topology_json(G, pos):
    nodes = []
    links = []

    for node, attrs in G.nodes(data=True):
        x, y = pos[node]
        nodes.append({
            "id": node,
            "role": attrs.get("role", "unknown"),
            "x": round(float(x), 6),
            "y": round(float(y), 6)
        })

    for u, v, attrs in G.edges(data=True):
        links.append({
            "source": u,
            "target": v,
            "type": attrs.get("edge_type", "unknown")
        })

    data = {
        "title": TITLE,
        "confirmed_distribution": {
            "sensor": TOTAL_SENSORS,
            "edge": TOTAL_EDGE,
            "fog": TOTAL_FOG,
            "cloud": TOTAL_CLOUD,
            "total": TOTAL_SENSORS + TOTAL_EDGE + TOTAL_FOG + TOTAL_CLOUD
        },
        "nodes": nodes,
        "links": links
    }

    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ============================================================
# Visualization
# ============================================================

def draw_topology():
    G, pos, sensor_nodes, edge_nodes, fog_nodes, cloud_nodes, edge_groups = build_graph()

    fig, ax = plt.subplots(figsize=(26, 14), dpi=350)

    # ------------------------------------------------------------
    # Draw edges first, grouped by type for clearer visibility
    # ------------------------------------------------------------

    nx.draw_networkx_edges(
        G,
        pos,
        edgelist=edge_groups["sensor_to_edge"],
        ax=ax,
        edge_color="#7fa9df",
        width=0.65,
        alpha=0.34
    )

    nx.draw_networkx_edges(
        G,
        pos,
        edgelist=edge_groups["edge_to_edge"],
        ax=ax,
        edge_color="#4f8fd3",
        width=0.80,
        alpha=0.42
    )

    nx.draw_networkx_edges(
        G,
        pos,
        edgelist=edge_groups["edge_to_fog"],
        ax=ax,
        edge_color="#4b83c4",
        width=0.85,
        alpha=0.45
    )

    nx.draw_networkx_edges(
        G,
        pos,
        edgelist=edge_groups["fog_to_fog"],
        ax=ax,
        edge_color="#336db2",
        width=1.00,
        alpha=0.50
    )

    nx.draw_networkx_edges(
        G,
        pos,
        edgelist=edge_groups["fog_to_cloud"],
        ax=ax,
        edge_color="#1f5fa8",
        width=1.15,
        alpha=0.58
    )

    # ------------------------------------------------------------
    # Draw nodes on top of edges
    # ------------------------------------------------------------

    nx.draw_networkx_nodes(
        G,
        pos,
        nodelist=sensor_nodes,
        node_size=15,
        node_color="#0f78bd",
        edgecolors="white",
        linewidths=0.15,
        ax=ax,
        label="sensor (700)"
    )

    nx.draw_networkx_nodes(
        G,
        pos,
        nodelist=edge_nodes,
        node_size=48,
        node_color="#0f78bd",
        edgecolors="white",
        linewidths=0.25,
        ax=ax,
        label="edge (220)"
    )

    nx.draw_networkx_nodes(
        G,
        pos,
        nodelist=fog_nodes,
        node_size=85,
        node_color="#0f78bd",
        edgecolors="white",
        linewidths=0.35,
        ax=ax,
        label="fog (79)"
    )

    nx.draw_networkx_nodes(
        G,
        pos,
        nodelist=cloud_nodes,
        node_size=360,
        node_color="#0f78bd",
        edgecolors="white",
        linewidths=0.60,
        ax=ax,
        label="cloud (1)"
    )

    # ------------------------------------------------------------
    # Title and legend
    # ------------------------------------------------------------

    ax.set_title(TITLE, fontsize=20, pad=22)

    legend = ax.legend(
        loc="upper right",
        fontsize=14,
        frameon=True,
        borderpad=0.8,
        labelspacing=0.6
    )

    legend.get_frame().set_alpha(0.95)
    legend.get_frame().set_edgecolor("#cccccc")

    ax.set_axis_off()

    # Keep spacing clean
    plt.tight_layout()

    # Save high-resolution image
    plt.savefig(
        OUTPUT_IMAGE,
        dpi=400,
        bbox_inches="tight",
        facecolor="white"
    )

    export_topology_json(G, pos)

    print(f"[OK] Saved clearer topology image: {OUTPUT_IMAGE}")
    print(f"[OK] Saved topology JSON: {OUTPUT_JSON}")
    print(f"[OK] Nodes: {G.number_of_nodes()}")
    print(f"[OK] Edges: {G.number_of_edges()}")
    print("[OK] Confirmed nodes: 700 sensors, 220 edge, 79 fog, 1 cloud")


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    draw_topology()