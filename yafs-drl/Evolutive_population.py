"""YAFS-style evolutive population wrapper for confirmed 7S/3L events."""
from __future__ import annotations
from config import EVENTS_PER_STEP, SEED
from event_generator import EventGenerator

class EvolutivePopulation:
    def __init__(self, graph, events_per_step=EVENTS_PER_STEP, seed=SEED):
        self.generator = EventGenerator(graph, seed=seed)
        self.events_per_step = events_per_step

    def run_step(self, step: int):
        return self.generator.generate_step(step, self.events_per_step)

Population = EvolutivePopulation
