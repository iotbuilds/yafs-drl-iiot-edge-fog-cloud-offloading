"""PyTorch DQN-based 7S/7F topology-aware offloading selector.

The selector keeps the same dashboard/API decision schema as ``DRLQSelector``,
but uses a real PyTorch neural Q-network, replay memory, Bellman targets,
Adam optimization, and a target network for DQN-style learning.
"""
from __future__ import annotations

import random
from collections import deque
from dataclasses import dataclass

import networkx as nx
import numpy as np
import torch
from torch import nn

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
    gradient_clip: float = 1.0


class _TorchQNetwork(nn.Module):
    def __init__(self, input_size: int, output_size: int, hidden_size: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, output_size),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class DRLDQNSelector(DRLQSelector):
    """PyTorch DQN selector with the same output contract as DRLQSelector."""

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
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        torch.set_num_threads(1)

        self.action_to_index = {action: i for i, action in enumerate(DRL_ACTIONS)}
        self.index_to_action = {i: action for action, i in self.action_to_index.items()}
        self.device = torch.device("cpu")
        self.replay = deque(maxlen=self.params.replay_capacity)
        self.previous_transition: tuple[np.ndarray, int, float] | None = None
        self.training_steps = 0
        self.last_loss = 0.0
        self.input_size = self._state_vector_size()
        self.online = _TorchQNetwork(self.input_size, len(DRL_ACTIONS), self.params.hidden_size).to(self.device)
        self.target = _TorchQNetwork(self.input_size, len(DRL_ACTIONS), self.params.hidden_size).to(self.device)
        self.target.load_state_dict(self.online.state_dict())
        self.target.eval()
        self.optimizer = torch.optim.Adam(self.online.parameters(), lr=self.params.learning_rate)
        self.loss_fn = nn.MSELoss()

    def select(self, event: dict) -> dict:
        self._release_completed_loads(float(event.get("timestamp", 0.0)))
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
        q_values = self._predict_q_values(state_vector)

        if self.rng.random() < self.epsilon:
            action_index = self.rng.choice(valid_actions)
            policy_mode = "pytorch_dqn_epsilon_exploration"
        else:
            masked = np.full(len(DRL_ACTIONS), -1e9)
            masked[valid_actions] = q_values[valid_actions]
            action_index = int(np.argmax(masked))
            policy_mode = "pytorch_dqn_policy_exploitation"

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
        decision["model_type"] = "PyTorch-DQN"
        decision["dqn_loss"] = round(float(self.last_loss), 6)
        decision["state_7f"] = self._state(event, source_edge)
        self.reward_trace.append({
            "event_id": event["event_id"],
            "reward": decision["reward"],
            "score": decision["score"],
            "action": decision["offloading_scenario"],
            "model_type": "PyTorch-DQN",
        })
        self.action_counts[decision["offloading_scenario"]] += 1
        self._reserve_dynamic_load(event, decision)
        return decision

    def _predict_q_values(self, state_vector: np.ndarray) -> np.ndarray:
        self.online.eval()
        with torch.no_grad():
            state = torch.as_tensor(state_vector, dtype=torch.float32, device=self.device).unsqueeze(0)
            q_values = self.online(state).squeeze(0).cpu().numpy()
        self.online.train()
        return q_values

    def _learn_from_previous(self, next_state: np.ndarray) -> None:
        if self.previous_transition is not None:
            prev_state, prev_action, prev_reward = self.previous_transition
            self.replay.append((prev_state, prev_action, prev_reward, next_state))

        if len(self.replay) < self.params.train_after:
            return

        batch_size = min(self.params.batch_size, len(self.replay))
        batch = self.rng.sample(list(self.replay), batch_size)
        states = torch.as_tensor(np.vstack([row[0] for row in batch]), dtype=torch.float32, device=self.device)
        actions = torch.as_tensor([row[1] for row in batch], dtype=torch.long, device=self.device).unsqueeze(1)
        rewards = torch.as_tensor([row[2] for row in batch], dtype=torch.float32, device=self.device)
        next_states = torch.as_tensor(np.vstack([row[3] for row in batch]), dtype=torch.float32, device=self.device)

        q_selected = self.online(states).gather(1, actions).squeeze(1)
        with torch.no_grad():
            next_q = self.target(next_states).max(dim=1).values
            targets = rewards + self.gamma * next_q

        loss = self.loss_fn(q_selected, targets)
        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.online.parameters(), self.params.gradient_clip)
        self.optimizer.step()

        self.last_loss = float(loss.detach().cpu().item())
        self.training_steps += 1
        if self.training_steps % self.params.target_sync_interval == 0:
            self.target.load_state_dict(self.online.state_dict())

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
                values.extend([0.0] * 12)
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
                float(candidate.get("factor_compute_demand_ratio", 0.0)),
                float(candidate.get("factor_task_cpu_cycles", 0.0)),
                float(candidate.get("factor_target_compute_capacity_cycles", 0.0)),
            ])
        return np.array(values, dtype=np.float32)

    def _state_vector_size(self) -> int:
        event_features = len(EVENT_LEVELS) + len(SENSOR_TYPES) + 2
        source_features = 3
        action_features = len(DRL_ACTIONS) * 12
        return event_features + source_features + action_features
