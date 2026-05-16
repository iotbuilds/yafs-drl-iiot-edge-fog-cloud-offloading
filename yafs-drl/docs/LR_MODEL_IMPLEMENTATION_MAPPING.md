# Literature Review Mapping for the Current YAFS/DRL Model

This note documents how the current implementation is positioned against the literature review papers provided in `PAPERS F10.zip` and `PAPERS L10.zip`.

## Current Implementation Position

The current system keeps the DRL policy flexible. It does not assign fixed computation stages to edge, fog, or cloud. Instead, each event is evaluated dynamically and routed to the most suitable candidate path based on severity, deadline, delay, hops, congestion, energy, task size, bandwidth cost, node computing capacity, and dynamic resource state.

The event model is now single-sensor history based:

- One sensor node produces one event for one physical sensor type.
- The event includes the current reading and recent history from the same sensor.
- The algorithm calculates threshold status, spike score, trend score, volatility score, history anomaly score, severity, payload size, and CPU cycles.
- DRL uses `task_size_kb`, `task_cpu_cycles`, deadline, and network/node factors to choose a route.
- After a decision, the destination node and route links reserve load for a simulated duration, so later decisions react to changing resources.

## LR Concept Mapping

| Literature concept | Current field or behavior | How it is used |
|---|---|---|
| Task/data size | `task_size_kb` | Modeled transferred input size for the IIoT event, calculated as `event_payload_kb + protocol_security_overhead_kb`. |
| CPU cycles / computation demand | `task_cpu_cycles` and stage cycle fields | Separates compute burden from network payload size. Used in compute demand and compute pressure factors. |
| Deadline / delay-sensitive offloading | `deadline`, `deadline_met` | Severity defines the timing requirement. DRL rewards routes that satisfy the deadline. |
| Computation offloading action | `selected_layer`, `destination`, `route_path`, `offloading_scenario` | DRL chooses local edge, edge-to-edge, edge-to-fog, fog-to-fog, or cloud escalation. |
| Dynamic resource allocation | `dynamic_node_load_*`, `dynamic_link_load_*` | Assigned tasks reserve compute and link load; later events observe changed capacity/congestion. |
| Network condition and bandwidth cost | `factor_network_condition`, `factor_bandwidth_cost` | Route scoring includes congestion and data-size-to-bandwidth burden. |
| Node computing capacity-aware offloading | `factor_compute_pressure`, `factor_compute_demand_ratio`, `factor_target_compute_capacity_cycles` | Node computing capacity is the seventh decision factor. |
| Multi-objective optimization | 7F factor score and reward | The DQN decision balances latency, hops, congestion, energy, size, bandwidth, and compute capacity. |

## Paper Examples from the Provided LR Files

| Paper title from provided files | Relevant concept | Mapping to this implementation |
|---|---|---|
| Distributed task offloading in edge computing: A multi-objective adaptive deep reinforcement learning algorithm | Multi-objective adaptive DRL task offloading | Supports the multi-factor route decision and adaptive policy framing. |
| Energy-efficient task offloading in the Industrial Internet of Things: A Lyapunov-guided multi-agent deep reinforcement learning approach | IIoT offloading, energy-aware decision making, resource pressure | Supports retaining energy and dynamic resource state as decision factors. |
| An advanced deep reinforcement learning algorithm for three-layer D2D-edge-cloud computing architecture for efficient task offloading in the Internet of Things | Layered IoT task offloading | Supports layered actions across local edge, edge-to-edge, edge/fog, fog/fog, and cloud escalation. |
| Multi-objective task offloading optimization using deep reinforcement learning with resource distribution clustering | Resource-aware multi-objective DRL offloading | Supports comparing candidate resource conditions before choosing a route. |
| Deep reinforcement learning for optimizing computation latency in wireless-powered Multi-Access Edge Computing systems: A partial offloading approach | Computation latency, CPU/resource management | Supports separating data size from computation demand through `task_cpu_cycles`. |
| Reliable and efficient computation offloading for dependency-aware tasks in IIoT using evolutionary multi-objective optimization | IIoT multi-objective offloading | Supports deadline-aware and resource-aware offloading in the reported model. |
| Dynamic offloading strategy for computational energy efficiency of wireless power transfer based MEC networks in Industry 5.0 | Dynamic offloading, task computational model, local/edge computational model, resource allocation | Supports dynamic node load and task CPU demand without requiring fixed layer-specific computation roles. |

## Recommended Thesis Wording

The proposed implementation models each IIoT event as a single-sensor task rather than a combined 7S snapshot. Each sensor event carries its current reading, same-sensor historical context, threshold status, severity, priority/deadline, and modeled communication overhead. The resulting `task_size_kb` represents the network transfer burden, while `task_cpu_cycles` represents the computation burden required to validate, classify, extract features, analyze history, aggregate, and package the event.

The DRL policy is not restricted to fixed layer-specific computation roles. Instead, it evaluates candidate destinations and paths dynamically using latency, hop count, congestion, energy, task size, bandwidth cost, node computing capacity, severity deadline, and current simulated resource load. After each offloading decision, the selected node and traversed links reserve compute and traffic load for a simulated duration. This allows subsequent decisions to react to changing resource availability, which better reflects dynamic computation offloading behavior described in the literature.

## What Is Not Modeled

The implementation remains a task-level simulation. It does not model exact TCP segmentation, packet retransmission behavior, full TLS handshake exchange, or packet-level protocol diversity. Those are intentionally abstracted into `protocol_security_overhead_kb` and link congestion factors because the DRL policy is focused on task offloading decisions rather than packet-level network emulation.
