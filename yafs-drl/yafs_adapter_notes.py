"""Notes for plugging this logic into a native YAFS project.

Use this package as the decision/workload layer. In an existing YAFS example:
1. Replace the old Generator -> Actuator-only flow with SensorEvent -> EdgeProcessing -> FogProcessing -> CloudAnalytics.
2. Use topology/iiot_topology_1000.graphml as the topology input.
3. Use DRLQSelector.select(event) where your custom YAFS selector chooses a destination DES/node.
4. Use EvolutivePopulation.run_step(step) as the source of periodic sensor events.
5. Keep selection_multipleDeploys.py for static cloud/fog baseline comparison.

The standalone main.py is included so the logic can be validated before binding to a specific YAFS installation/version.
"""
