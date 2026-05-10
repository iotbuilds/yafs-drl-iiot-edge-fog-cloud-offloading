"""DQN-based 7S/7F topology-aware offloading selector.

This keeps the Bellman reward-learning formulation used by ``DRLQSelector`` but replaces
the tabular Q lookup with a small neural approximator implemented in NumPy.
The public decision schema remains dashboard/API compatible.
"""
from __future__ import annotations

import random
from collections import defaultdict, deque
from dataclasses import dataclass

import networkx as nx
import numpy as np

from config import DEADLINES, DRL_ACTIONS, EVENT_LEVELS, SEED, SENSOR_TYPES
from drl_q_selector import DRLQSelector


@dataclass
class DQNHyperParams:
    epsilon: float = 0.08
    gamma: float = 0.85
    learning_rate: float = 0.0015
    replay_capacity: int = 4096
    batch_size: int = 32
    hidden_size: int = 64
    train_after: int = 48
    target_sync_interval: int = 100


class _NumpyQNetwork:
    def __init__(self, input_size: int, output_size: int, hidden_size: int, rng: np.random.Generator):
        scale1 = np.sqrt(2.0 / max(input_size, 1))
        scale2 = np.sqrt(2.0 / hidden_size)
        self.w1 = rng.normal(0.0, scale1, (input_size, hidden_size))
        self.b1 = np.zeros(hidden_size)
        self.w2 = rng.normal(0.0, scale2, (hidden_size, hidden_size))
        self.b2 = np.zeros(hidden_size)
        self.w3 = rng.normal(0.0, 0.01, (hidden_size, output_size))
        self.b3 = np.zeros(output_size)

    def copy_from(self, other: "_NumpyQNetwork") -> None:
        for name in ("w1", "b1", "w2", "b2", "w3", "b3"):
            setattr(self, name, getattr(other, name).copy())

    def forward(self, x: np.ndarray) -> tuple[np.ndarray, tuple[np.ndarray, np.ndarray, np.ndarray]]:
        z1 = x @ self.w1 + self.b1
        h1 = np.maximum(z1, 0.0)
        z2 = h1 @ self.w2 + self.b2
        h2 = np.maximum(z2, 0.0)
        out = h2 @ self.w3 + self.b3
        return out, (h1, z2, h2)

    def train_batch(self, states: np.ndarray, actions: np.ndarray, targets: np.ndarray, lr: float) -> float:
        q_values, (h1, z2, h2) = self.forward(states)
        chosen = q_values[np.arange(len(states)), actions]
        error = chosen - targets
        loss = float(np.mean(error ** 2))

        grad_out = np.zeros_like(q_values)
        grad_out[np.arange(len(states)), actions] = (2.0 / len(states)) * error

        grad_w3 = h2.T @ grad_out
        grad_b3 = grad_out.sum(axis=0)
        grad_h2 = grad_out @ self.w3.T
        grad_z2 = grad_h2 * (z2 > 0.0)
        grad_w2 = h1.T @ grad_z2
        grad_b2 = grad_z2.sum(axis=0)
        grad_h1 = grad_z2 @ self.w2.T
        grad_z1 = grad_h1 * (h1 > 0.0)
        grad_w1 = states.T @ grad_z1
        grad_b1 = grad_z1.sum(axis=0)

        for grad in (grad_w1, grad_b1, grad_w2, grad_b2, grad_w3, grad_b3):
            np.clip(grad, -1.0, 1.0, out=grad)

        self.w1 -= lr * grad_w1
        self.b1 -= lr * grad_b1
        self.w2 -= lr * grad_w2
        self.b2 -= lr * grad_b2
        self.w3 -= lr * grad_w3
        self.b3 -= lr * grad_b3
        return loss


class DRLDQNSelector(DRLQSelector):
    """DQN selector with the same output contract as DRLQSelector."""

    def __init__(
        self,
        graph: nx.Graph,
        seed: int = SEED,
        params: DQNHyperParams | None = None,
    ):
        self.params = params or DQNHyperParams()
        super().__init__(
            graph=graph,
            epsilon=self.params.epsilon,
            alpha=self.params.learning_rate,
            gamma=self.params.gamma,
            seed=seed,
        )
        self.action_to_index = {action: i for i, action in enumerate(DRL_ACTIONS)}
        self.index_to_action = {i: action for action, i in self.action_to_index.items()}
        self.np_rng = np.random.default_rng(seed)
        self.replay = deque(maxlen=self.params.replay_capacity)
        self.previous_transition: tuple[np.ndarray, int, float] | None = None
        self.training_steps = 0
        self.last_loss = 0.0
        self.input_size = self._state_vector_size()
        self.online = _NumpyQNetwork(self.input_size, len(DRL_ACTIONS), self.params.hidden_size, self.np_rng)
        self.target = _NumpyQNetwork(self.input_size, len(DRL_ACTIONS), self.params.hidden_size, self.np_rng)
        self.target.copy_from(self.online)

    def select(self, event: dict) -> dict:
        source_edge = event["edge_gateway"]
        severity = event["severity"]
        candidates = self._candidate_nodes(source_edge, severity)
        scored = [self._score_candidate(event, source_edge, dst) for dst in candidates]
        scored = [s for s in scored if not np.isinf(s["score"])]
        if event.get("stress_scenario") == "force_fog_to_fog":
            f2f = [s for s in scored if s.get("offloading_scenario") == "fog_to_fog"]
            if f2f:
                scored = f2f
        if not scored:
            raise RuntimeError("No valid offloading candidate found")

        action_options = self._best_candidate_by_action(scored)
        state_vector = self._encode_state(event, source_edge, action_options)
        valid_actions = sorted(self.action_to_index[a] for a in action_options)
        q_values, _ = self.online.forward(state_vector.reshape(1, -1))
        q_values = q_values[0]

        if self.rng.random() < self.epsilon:
            action_index = self.rng.choice(valid_actions)
            policy_mode = "dqn_epsilon_exploration"
        else:
            masked = np.full(len(DRL_ACTIONS), -1e9)
            masked[valid_actions] = q_values[valid_actions]
            action_index = int(np.argmax(masked))
            policy_mode = "dqn_policy_exploitation"

        action_name = self.index_to_action[action_index]
        decision = dict(action_options[action_name])
        decision["policy_mode"] = policy_mode

        reward = self._reward(event, decision)
        self._learn_from_previous(state_vector)
        self.previous_transition = (state_vector, action_index, reward)

        decision["reward"] = round(reward, 6)
        decision["q_value"] = round(float(q_values[action_index]), 6)
        decision["dqn_q_value"] = decision["q_value"]
        decision["dqn_action"] = action_name
        decision["model_type"] = "DQN"
        decision["dqn_loss"] = round(float(self.last_loss), 6)
        decision["state_7f"] = self._state(event, source_edge)
        self.reward_trace.append({
            "event_id": event["event_id"],
            "reward": decision["reward"],
            "score": decision["score"],
            "action": decision["offloading_scenario"],
            "model_type": "DQN",
        })
        self.action_counts[decision["offloading_scenario"]] += 1
        return decision

    def _learn_from_previous(self, next_state: np.ndarray) -> None:
        if self.previous_transition is not None:
            prev_state, prev_action, prev_reward = self.previous_transition
            self.replay.append((prev_state, prev_action, prev_reward, next_state))

        if len(self.replay) < self.params.train_after:
            return

        batch_size = min(self.params.batch_size, len(self.replay))
        batch = self.rng.sample(list(self.replay), batch_size)
        states = np.vstack([row[0] for row in batch])
        actions = np.array([row[1] for row in batch], dtype=int)
        rewards = np.array([row[2] for row in batch], dtype=float)
        next_states = np.vstack([row[3] for row in batch])
        next_q, _ = self.target.forward(next_states)
        targets = rewards + self.gamma * np.max(next_q, axis=1)
        self.last_loss = self.online.train_batch(states, actions, targets, self.params.learning_rate)
        self.training_steps += 1
        if self.training_steps % self.params.target_sync_interval == 0:
            self.target.copy_from(self.online)

    def _best_candidate_by_action(self, scored: list[dict]) -> dict[str, dict]:
        best: dict[str, dict] = {}
        for candidate in scored:
            action = candidate["offloading_scenario"]
            current = best.get(action)
            if current is None or candidate["score"] < current["score"]:
                best[action] = candidate
        return best

    def _encode_state(self, event: dict, source_edge: str, action_options: dict[str, dict]) -> np.ndarray:
        values: list[float] = []
        values.extend(1.0 if event["severity"] == level else 0.0 for level in EVENT_LEVELS)
        values.extend(1.0 if event["dominant_sensor_type"] == sensor else 0.0 for sensor in SENSOR_TYPES)
        values.append(min(float(event["task_size_kb"]) / 512.0, 2.0))
        values.append(min(float(event.get("deadline", DEADLINES[event["severity"]])) / 120.0, 2.0))

        src = self.graph.nodes[source_edge]
        values.extend([
            1.0 - float(src.get("energy", 1.0)),
            1.0 - float(src.get("compute_capacity", 1.0)),
            1.0 if src.get("status") == "active" else 0.0,
        ])

        for action in DRL_ACTIONS:
            candidate = action_options.get(action)
            if candidate is None:
                values.extend([0.0] * 9)
                continue
            values.extend([
                1.0,
                float(candidate.get("factor_delay", 0.0)),
                float(candidate.get("factor_hop_count", 0.0)),
                float(candidate.get("factor_network_condition", 0.0)),
                float(candidate.get("factor_energy_cost", 0.0)),
                float(candidate.get("factor_task_size", 0.0)),
                float(candidate.get("factor_bandwidth_cost", 0.0)),
                float(candidate.get("factor_compute_pressure", 0.0)),
                float(candidate.get("factor_reliability_risk", 0.0)),
            ])
        return np.array(values, dtype=float)

    def _state_vector_size(self) -> int:
        event_features = len(EVENT_LEVELS) + len(SENSOR_TYPES) + 2
        source_features = 3
        action_features = len(DRL_ACTIONS) * 9
        return event_features + source_features + action_features
