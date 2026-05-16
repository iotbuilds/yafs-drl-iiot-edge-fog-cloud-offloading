"""Baseline policies for 10B comparison."""
from __future__ import annotations
import random
import networkx as nx
from config import SEED

class StaticCloudFogSelector:
    def __init__(self, graph: nx.Graph, policy: str = "rule_based_static_cloud_fog", seed: int = SEED):
        self.graph = graph
        self.policy = policy
        self.rng = random.Random(seed)
        self._path_cache = {}
        self.cloud_nodes = [n for n, d in graph.nodes(data=True) if d.get("layer") == "cloud"]
        self.fog_nodes = [n for n, d in graph.nodes(data=True) if d.get("layer") == "fog"]
        self.edge_nodes = [n for n, d in graph.nodes(data=True) if d.get("layer") == "edge"]

    def select(self, event: dict) -> dict:
        src = event["edge_gateway"]
        dst = self._choose_destination(event, src)
        return self._decision(event, src, dst)

    def select_for_policy(self, event: dict, policy: str) -> dict:
        old = self.policy
        self.policy = policy
        try:
            return self.select(event)
        finally:
            self.policy = old

    def _choose_destination(self, event: dict, src: str) -> str:
        if self.policy == "local_only":
            return src
        if self.policy == "edge_only":
            edge_candidates = [n for n in self.graph.neighbors(src) if self.graph.nodes[n].get("layer") == "edge"]
            return edge_candidates[0] if edge_candidates else src
        if self.policy == "cloud_only":
            return self.cloud_nodes[0]
        if self.policy == "random":
            pool = [src] + self.edge_nodes[:40] + self.fog_nodes[:30] + self.cloud_nodes
            return self.rng.choice(pool)
        # rule_based_static_cloud_fog baseline.
        if event["severity"] == "critical":
            return self.cloud_nodes[0]
        if event["severity"] == "warning":
            fog_candidates = [n for n in self.graph.neighbors(src) if self.graph.nodes[n].get("layer") == "fog"]
            return fog_candidates[0] if fog_candidates else self.fog_nodes[0]
        return src

    def _decision(self, event: dict, src: str, dst: str) -> dict:
        try:
            path = self._path(src, dst)
        except Exception:
            path = [src]
            dst = src
        delay = self._delay(path)
        hops = max(len(path) - 1, 0)
        layer = self.graph.nodes[dst].get("layer")
        scenario = self._scenario(layer, src, dst, path)
        energy = max(0.0001, 1.0 - float(self.graph.nodes[dst].get("energy", 1.0)))
        congestion = self._avg_edge_attr(path, "congestion", 0.05)
        return {
            "event_id": event["event_id"],
            "baseline_policy": self.policy,
            "source_sensor": event["node_id"],
            "source_edge": src,
            "destination": dst,
            "selected_layer": layer,
            "route_path": path,
            "offloading_scenario": scenario,
            "decision_reason": f"{self.policy} baseline",
            "estimated_delay": round(delay, 4),
            "deadline": event.get("deadline"),
            "deadline_met": bool(delay <= float(event.get("deadline", 0))),
            "score": round(delay, 6),
            "failure_congestion_reason": "baseline_static",
            "factor_delay": round(delay / 20.0, 6),
            "factor_hop_count": round(hops / 8.0, 6),
            "factor_network_condition": round(congestion, 6),
            "factor_energy_cost": round(energy, 6),
            "factor_task_size": round(float(event["task_size_kb"]) / 512.0, 6),
            "factor_bandwidth_cost": round(float(event["task_size_kb"]) / 1000.0 / 10.0, 6),
            "factor_compute_pressure": round(1.0 - float(self.graph.nodes[dst].get("compute_capacity", 1.0)), 6),
        }


    def _path(self, src: str, dst: str) -> list[str]:
        if src == dst:
            return [src]
        key = (src, dst)
        if key in self._path_cache:
            return self._path_cache[key]
        if self.graph.has_edge(src, dst):
            path = [src, dst]
        else:
            dst_layer = self.graph.nodes[dst].get("layer")
            src_fogs = [n for n in self.graph.neighbors(src) if self.graph.nodes[n].get("layer") == "fog"]
            if dst_layer == "cloud":
                via = next((f for f in src_fogs if self.graph.has_edge(f, dst)), src_fogs[0] if src_fogs else src)
                path = [src, via, dst] if via != src else [src, dst]
            elif dst_layer == "fog" and src_fogs:
                via = next((f for f in src_fogs if self.graph.has_edge(f, dst)), None)
                if via is not None and via != dst:
                    path = [src, via, dst]
                elif self.graph.has_edge(src, dst):
                    path = [src, dst]
                else:
                    path = nx.shortest_path(self.graph, src, dst, weight="PR")
            else:
                path = nx.shortest_path(self.graph, src, dst, weight="PR")
        self._path_cache[key] = path
        return path
    def _delay(self, path: list[str]) -> float:
        if len(path) == 1:
            return 0.8
        edges = list(zip(path[:-1], path[1:]))
        return sum(float(self.graph.edges[e].get("PR", 1.0)) for e in edges) + self._avg_edge_attr(path, "congestion", 0.05) * 3

    def _avg_edge_attr(self, path: list[str], attr: str, default: float) -> float:
        if len(path) == 1:
            return default
        vals = [float(self.graph.edges[e].get(attr, default)) for e in zip(path[:-1], path[1:])]
        return sum(vals) / max(len(vals), 1)

    def _path_cost(self, src: str, dst: str) -> float:
        try:
            return nx.shortest_path_length(self.graph, src, dst, weight="PR")
        except Exception:
            return float("inf")

    def _scenario(self, layer: str, src: str, dst: str, path: list[str]) -> str:
        if src == dst and layer == "edge":
            return "local_edge"
        if src != dst and layer == "edge":
            return "edge_to_edge"
        if layer == "fog":
            for a, b in zip(path[:-1], path[1:]):
                if self.graph.nodes[a].get("layer") == "fog" and self.graph.nodes[b].get("layer") == "fog":
                    return "fog_to_fog"
            return "edge_to_fog"
        if layer == "cloud":
            return "cloud_escalation"
        return "unknown"
