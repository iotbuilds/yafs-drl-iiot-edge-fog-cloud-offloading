"""Legacy 7F severity-aware DRL offloading selector.

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
        self.node_loads = defaultdict(list)
        self.link_loads = defaultdict(list)

    def select(self, event: dict) -> dict:
        self._release_completed_loads(float(event.get("timestamp", 0.0)))
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
        self._reserve_dynamic_load(event, decision)
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
            w.compute * factors["compute_pressure"]
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
        decision_metadata_kb = self._decision_metadata_size(path)
        transfer_kb_before_monitoring = float(event.get("task_size_kb", 0)) + decision_metadata_kb
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
            "decision_metadata_kb": decision_metadata_kb,
            "monitoring_export_kb": 0.0,
            "total_transfer_kb": round(transfer_kb_before_monitoring, 3),
            **{f"factor_{k}": round(v, 6) for k, v in factors.items() if k != "estimated_delay"},
        }

    def _factors(self, event: dict, path: List[str], dst: str) -> Dict[str, float]:
        deadline = max(float(event.get("deadline", 1.0)), 1.0)
        if len(path) == 1:
            delay = 0.8
            hops = 0
            avg_congestion = 0.05
            avg_dynamic_link_load = 0.0
            min_bw = 1_000.0
            reliability_risk = 0.01
        else:
            edges = list(zip(path[:-1], path[1:]))
            delay = sum(float(self.graph.edges[e].get("PR", 1.0)) for e in edges)
            hops = len(edges)
            dynamic_link_loads = []
            congestion_values = []
            for e in edges:
                edge_data = self.graph.edges[e]
                bw = max(float(edge_data.get("BW", 1.0)), 1.0)
                link_capacity_kb = bw * 125.0 * deadline
                dynamic_load = min(self._active_link_load_kb(*e) / max(link_capacity_kb, 1.0), 2.0)
                dynamic_link_loads.append(dynamic_load)
                static_congestion = float(edge_data.get("congestion", 0.1))
                congestion_values.append(min(1.0, static_congestion + dynamic_load * 0.65))
            avg_dynamic_link_load = sum(dynamic_link_loads) / max(hops, 1)
            avg_congestion = sum(congestion_values) / max(hops, 1)
            min_bw = min(float(self.graph.edges[e].get("BW", 1.0)) for e in edges)
            reliability = min(float(self.graph.edges[e].get("reliability", 0.95)) for e in edges)
            reliability_risk = 1.0 - reliability
        nd = self.graph.nodes[dst]
        task_size = float(event["task_size_kb"])
        task_cpu_cycles = float(event.get("task_cpu_cycles", 0.0))
        target_compute_capacity = self._target_compute_capacity_cycles(nd)
        active_node_cycles = self._active_node_load_cycles(dst)
        dynamic_node_load = min(active_node_cycles / max(target_compute_capacity, 1.0), 2.0)
        available_compute_cycles = max(target_compute_capacity - active_node_cycles, target_compute_capacity * 0.05)
        compute_demand_ratio = min(task_cpu_cycles / max(available_compute_cycles, 1.0), 2.0)
        node_compute_pressure = 1.0 - float(nd.get("compute_capacity", 1.0))
        compute_pressure = min(1.0, node_compute_pressure * 0.35 + dynamic_node_load * 0.35 + compute_demand_ratio * 0.30)
        estimated_delay = delay + (task_size / max(min_bw, 1.0)) + avg_congestion * 3 + compute_demand_ratio * 2.0 + dynamic_node_load * 2.0 + avg_dynamic_link_load * 2.0
        return {
            "delay": delay / 20.0,
            "hop_count": hops / 8.0,
            "network_condition": avg_congestion,
            "energy_cost": 1.0 - float(nd.get("energy", 1.0)),
            "task_size": task_size / 512.0,
            "bandwidth_cost": task_size / max(min_bw, 1.0) / 10.0,
            "compute_pressure": compute_pressure,
            "node_compute_pressure": node_compute_pressure,
            "dynamic_node_load": dynamic_node_load,
            "dynamic_link_load": avg_dynamic_link_load,
            "available_compute_ratio": min(1.0, available_compute_cycles / max(target_compute_capacity, 1.0)),
            "compute_demand_ratio": compute_demand_ratio,
            "task_cpu_cycles": task_cpu_cycles / 1_000_000_000.0,
            "target_compute_capacity_cycles": target_compute_capacity / 1_000_000_000.0,
            "reliability_risk": reliability_risk,
            "estimated_delay": estimated_delay,
        }

    def _target_compute_capacity_cycles(self, node_data: dict) -> float:
        ipt = float(node_data.get("IPT", 0.0))
        if ipt > 0:
            return ipt * 100_000.0
        return max(float(node_data.get("compute_capacity", 0.0)), 0.01) * 100_000_000.0

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
            ("dynamic_node_load", factors.get("dynamic_node_load", 0.0)),
            ("dynamic_link_load", factors.get("dynamic_link_load", 0.0)),
            ("task_cpu_cycles", factors.get("compute_demand_ratio", 0.0)),
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

    def _decision_metadata_size(self, path: List[str]) -> float:
        hop_count = max(len(path) - 1, 0)
        return round(4.0 + hop_count * 0.35, 3)

    def _release_completed_loads(self, now: float) -> None:
        for loads in (self.node_loads, self.link_loads):
            for key in list(loads.keys()):
                loads[key] = [item for item in loads[key] if item[0] > now]
                if not loads[key]:
                    del loads[key]

    def _active_node_load_cycles(self, node: str) -> float:
        return sum(float(cycles) for _, cycles in self.node_loads.get(node, []))

    def _active_link_load_kb(self, src: str, dst: str) -> float:
        return sum(float(kb) for _, kb in self.link_loads.get(self._link_key(src, dst), []))

    def _link_key(self, src: str, dst: str) -> tuple[str, str]:
        return tuple(sorted((src, dst)))

    def _reserve_dynamic_load(self, event: dict, decision: dict) -> None:
        now = float(event.get("timestamp", 0.0))
        deadline = max(float(event.get("deadline", 1.0)), 1.0)
        dst = decision.get("destination")
        if not dst or dst not in self.graph.nodes:
            return

        task_cpu_cycles = float(event.get("task_cpu_cycles", 0.0))
        target_capacity = self._target_compute_capacity_cycles(self.graph.nodes[dst])
        before_cycles = self._active_node_load_cycles(dst)
        processing_time = min(max(task_cpu_cycles / max(target_capacity, 1.0) * 120.0, 1.0), deadline * 2.0)
        self.node_loads[dst].append((now + processing_time, task_cpu_cycles))
        after_cycles = before_cycles + task_cpu_cycles

        route = decision.get("route_path", [])
        task_size_kb = float(event.get("task_size_kb", 0.0))
        before_link_loads = []
        after_link_loads = []
        for src, next_dst in zip(route[:-1], route[1:]):
            if not self.graph.has_edge(src, next_dst):
                continue
            edge_data = self.graph.edges[src, next_dst]
            bw = max(float(edge_data.get("BW", 1.0)), 1.0)
            capacity_kb = bw * 125.0 * deadline
            before_kb = self._active_link_load_kb(src, next_dst)
            transfer_time = min(max(task_size_kb / max(bw * 125.0, 1.0), 0.1), deadline * 2.0)
            self.link_loads[self._link_key(src, next_dst)].append((now + transfer_time, task_size_kb))
            before_link_loads.append(min(before_kb / max(capacity_kb, 1.0), 2.0))
            after_link_loads.append(min((before_kb + task_size_kb) / max(capacity_kb, 1.0), 2.0))

        decision.update({
            "dynamic_node_load_before": round(min(before_cycles / max(target_capacity, 1.0), 2.0), 6),
            "dynamic_node_load_after": round(min(after_cycles / max(target_capacity, 1.0), 2.0), 6),
            "dynamic_available_compute_before": round(max(target_capacity - before_cycles, 0.0), 3),
            "dynamic_available_compute_after": round(max(target_capacity - after_cycles, 0.0), 3),
            "dynamic_processing_time": round(processing_time, 4),
            "dynamic_link_load_before": round(sum(before_link_loads) / len(before_link_loads), 6) if before_link_loads else 0.0,
            "dynamic_link_load_after": round(sum(after_link_loads) / len(after_link_loads), 6) if after_link_loads else 0.0,
        })

    def _state(self, event: dict, edge: str) -> tuple:
        # Discretized state used by the Q-policy. The 7F values are logged in the decision row.
        return (edge, event["severity"], event["dominant_sensor_type"], int(event["task_size_kb"] // 64))
