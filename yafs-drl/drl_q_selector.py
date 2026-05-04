"""7F severity-aware DRL/Q-learning offloading selector.

State = confirmed 7F factors plus routing context.
Action = one of: local_edge, edge_to_edge, edge_to_fog, fog_to_fog, cloud_escalation.
"""
from __future__ import annotations
import math
import random
from collections import defaultdict
from typing import Dict, List
import networkx as nx

from config import SEED, SEVERITY_WEIGHTS

class DRLQSelector:
    def __init__(self, graph: nx.Graph, epsilon: float = 0.08, alpha: float = 0.25, gamma: float = 0.85, seed: int = SEED):
        self.graph = graph
        self.epsilon = epsilon
        self.alpha = alpha
        self.gamma = gamma
        self.rng = random.Random(seed)
        self.q = defaultdict(float)
        self.reward_trace: list[dict] = []
        self.action_counts = defaultdict(int)
        self._path_cache = {}

    def select(self, event: dict) -> dict:
        source_edge = event["edge_gateway"]
        severity = event["severity"]
        candidates = self._candidate_nodes(source_edge, severity)
        scored = [self._score_candidate(event, source_edge, dst) for dst in candidates]
        scored = [s for s in scored if not math.isinf(s["score"])]
        if event.get("stress_scenario") == "force_fog_to_fog":
            f2f = [s for s in scored if s.get("offloading_scenario") == "fog_to_fog"]
            if f2f:
                scored = f2f
        if not scored:
            raise RuntimeError("No valid offloading candidate found")

        state = self._state(event, source_edge)
        if self.rng.random() < self.epsilon:
            decision = self.rng.choice(scored)
            decision["policy_mode"] = "epsilon_exploration"
        else:
            decision = min(scored, key=lambda x: x["score"] - self.q[(state, x["destination"])] * 0.01)
            decision["policy_mode"] = "q_policy_exploitation"

        reward = self._reward(event, decision)
        key = (state, decision["destination"])
        future = max([0.0] + [self.q[(state, s["destination"])] for s in scored])
        self.q[key] = (1 - self.alpha) * self.q[key] + self.alpha * (reward + self.gamma * future)
        decision["reward"] = round(reward, 6)
        decision["q_value"] = round(self.q[key], 6)
        decision["state_7f"] = state
        self.reward_trace.append({"event_id": event["event_id"], "reward": decision["reward"], "score": decision["score"], "action": decision["offloading_scenario"]})
        self.action_counts[decision["offloading_scenario"]] += 1
        return decision

    def _path(self, src: str, dst: str) -> List[str]:
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

    def _candidate_nodes(self, source_edge: str, severity: str) -> List[str]:
        candidates = {source_edge}
        edge_neighbors = []
        fog_neighbors = []
        for n in self.graph.neighbors(source_edge):
            layer = self.graph.nodes[n].get("layer")
            if layer == "edge":
                edge_neighbors.append(n)
            elif layer == "fog":
                fog_neighbors.append(n)
        candidates.update(edge_neighbors[:4])
        candidates.update(fog_neighbors[:4])
        for fog in fog_neighbors[:2]:
            added = 0
            for nn in self.graph.neighbors(fog):
                if self.graph.nodes[nn].get("layer") in {"fog", "cloud"}:
                    candidates.add(nn)
                    added += 1
                if added >= 3:
                    break
        if severity == "critical":
            candidates.update([n for n, d in self.graph.nodes(data=True) if d.get("layer") == "cloud"])
        return list(candidates)

    def _score_candidate(self, event: dict, src: str, dst: str) -> dict:
        try:
            path = self._path(src, dst)
        except nx.NetworkXNoPath:
            return {"score": math.inf, "destination": dst}
        layer = self.graph.nodes[dst].get("layer")
        nd = self.graph.nodes[dst]
        if nd.get("status") != "active":
            return {"score": math.inf, "destination": dst, "failure_reason": nd.get("failure_reason", "inactive")}
        factors = self._factors(event, path, dst)
        w = SEVERITY_WEIGHTS[event["severity"]]
        score = (
            w.delay * factors["delay"] + w.hops * factors["hop_count"] + w.congestion * factors["network_condition"] +
            w.energy * factors["energy_cost"] + w.task_size * factors["task_size"] + w.bandwidth * factors["bandwidth_cost"] +
            w.compute * factors["compute_pressure"] + w.reliability * factors["reliability_risk"]
        )
        scenario = self._scenario(layer, src, dst, path)
        if scenario == "cloud_escalation" and event["severity"] == "normal":
            score += 0.35
        if scenario == "cloud_escalation" and event["severity"] == "warning":
            score += 0.15
        if event["severity"] == "critical" and factors["estimated_delay"] <= event["deadline"]:
            score -= 0.05
        reason = self._reason(factors, scenario)
        deadline = event.get("deadline")
        estimated_delay = factors["estimated_delay"]
        return {
            "event_id": event["event_id"],
            "source_sensor": event["node_id"],
            "source_edge": src,
            "destination": dst,
            "selected_layer": layer,
            "route_path": path,
            "offloading_scenario": scenario,
            "decision_reason": reason,
            "estimated_delay": round(estimated_delay, 4),
            "deadline": deadline,
            "deadline_met": bool(estimated_delay <= float(deadline)),
            "score": round(score, 6),
            "failure_congestion_reason": reason if "congestion" in reason or "overload" in reason else "none",
            **{f"factor_{k}": round(v, 6) for k, v in factors.items() if k != "estimated_delay"},
        }

    def _factors(self, event: dict, path: List[str], dst: str) -> Dict[str, float]:
        if len(path) == 1:
            delay = 0.8
            hops = 0
            avg_congestion = 0.05
            min_bw = 1_000.0
            reliability_risk = 0.01
        else:
            edges = list(zip(path[:-1], path[1:]))
            delay = sum(float(self.graph.edges[e].get("PR", 1.0)) for e in edges)
            hops = len(edges)
            avg_congestion = sum(float(self.graph.edges[e].get("congestion", 0.1)) for e in edges) / max(hops, 1)
            min_bw = min(float(self.graph.edges[e].get("BW", 1.0)) for e in edges)
            reliability = min(float(self.graph.edges[e].get("reliability", 0.95)) for e in edges)
            reliability_risk = 1.0 - reliability
        nd = self.graph.nodes[dst]
        task_size = float(event["task_size_kb"])
        estimated_delay = delay + (task_size / max(min_bw, 1.0)) + avg_congestion * 3
        return {
            "delay": delay / 20.0,
            "hop_count": hops / 8.0,
            "network_condition": avg_congestion,
            "energy_cost": 1.0 - float(nd.get("energy", 1.0)),
            "task_size": task_size / 512.0,
            "bandwidth_cost": task_size / max(min_bw, 1.0) / 10.0,
            "compute_pressure": 1.0 - float(nd.get("compute_capacity", 1.0)),
            "reliability_risk": reliability_risk,
            "estimated_delay": estimated_delay,
        }

    def _scenario(self, layer: str, src: str, dst: str, path: List[str]) -> str:
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

    def _reason(self, factors: Dict[str, float], scenario: str) -> str:
        base = {
            "local_edge": "local edge processing",
            "edge_to_edge": "edge-to-edge reroute",
            "edge_to_fog": "edge-to-fog processing",
            "fog_to_fog": "fog-to-fog reroute for load balancing/congestion",
            "cloud_escalation": "selective cloud escalation",
        }.get(scenario, "dynamic offloading")
        dominant = max([
            ("delay", factors["delay"]),
            ("hop_count", factors["hop_count"]),
            ("network_condition/congestion", factors["network_condition"]),
            ("energy", factors["energy_cost"]),
            ("task_size", factors["task_size"]),
            ("bandwidth", factors["bandwidth_cost"]),
            ("node_compute_capacity", factors["compute_pressure"]),
        ], key=lambda x: x[1])[0]
        return f"{base}; dominant 7F factor={dominant}"

    def _reward(self, event: dict, decision: dict) -> float:
        reward = -float(decision["score"])
        if decision["deadline_met"]:
            reward += {"normal": 0.20, "warning": 0.45, "critical": 0.75}[event["severity"]]
        else:
            reward -= {"normal": 0.50, "warning": 1.50, "critical": 3.00}[event["severity"]]
        if decision["offloading_scenario"] == "cloud_escalation" and event["severity"] != "critical":
            reward -= 0.30
        return reward

    def _state(self, event: dict, edge: str) -> tuple:
        # Discretized state used by the Q-policy. The 7F values are logged in the decision row.
        return (edge, event["severity"], event["dominant_sensor_type"], int(event["task_size_kb"] // 64))
