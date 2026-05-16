# IIoT Solution Proposal: DRL-Based Private Cloud Monitoring for Industrial Equipment

## 1. Executive Summary

Industrial facilities depend on continuous equipment operation, stable production quality, and fast response to abnormal machine behavior. However, many plants still rely on delayed inspection, fixed threshold alarms, and centralized monitoring systems that do not react quickly enough when network conditions, edge capacity, or equipment risk change. This proposal presents an Industrial Internet of Things (IIoT) solution for intelligent monitoring and dynamic task offloading in a private industrial cloud environment. The design is aligned with recent research on multi-objective task offloading, edge/cloud cooperation, and DRL-based resource allocation [1], [2].

The proposed solution uses distributed IIoT sensors, edge gateways, fog nodes, and a private cloud dashboard. Each sensor produces single-sensor events such as temperature, vibration, current, pressure, humidity, acoustic, or flow-rate readings. The system analyzes the current reading against its own recent history to detect threshold violations, spikes, trends, volatility, and anomaly risk. A Deep Reinforcement Learning (DRL) policy then decides whether the task should be processed locally at the edge, forwarded to another edge gateway, routed to a fog node, transferred between fog nodes, or escalated to the cloud. This follows the general direction of adaptive and energy-aware task offloading research in edge and IIoT networks [3], [4].

The project was implemented and evaluated using a YAFS-based simulation environment with 700 sensor nodes, 220 edge gateways, 79 fog nodes, and one private cloud node. The dashboard reports latency, congestion, task size, CPU-cycle demand, energy cost, reliability risk, dynamic node load, dynamic link load, offloading decisions, and cloud monitoring records. The solution aims to improve equipment visibility, reduce response delay, balance computing resources, and support safer, more reliable industrial operations.

## 2. Industrial Problem and Pain Point

The selected industrial problem is unreliable and delayed detection of abnormal equipment behavior in smart manufacturing and industrial operations. In many industrial environments, machines generate continuous operational data, but the monitoring architecture is often not intelligent enough to decide where data should be processed. Sending all events directly to the cloud may increase latency and network congestion. Processing everything locally may overload edge gateways and miss broader operational insight. Static routing rules also fail when node capacity, link traffic, or event severity changes over time. This is why dynamic computation offloading and adaptive resource allocation are important themes in edge computing literature [2], [7].

This creates several pain points for the company:

- Critical equipment faults may not be detected or escalated fast enough.
- Edge gateways can become overloaded when several sensors produce abnormal events at the same time.
- Cloud-only analytics can increase bandwidth use and delay.
- Operators may see alarms without understanding route decisions, task size, network congestion, or compute pressure.
- The company lacks a clear digital view of how sensor events travel through edge, fog, and cloud infrastructure.

The proposed solution addresses this by combining IIoT sensing, edge/fog/cloud computing, DRL-based task offloading, and a private cloud dashboard.

## 3. Proposed IIoT Solution

The proposed architecture has four main layers:

- Sensor layer: industrial sensors produce readings and event metadata.
- Edge layer: edge gateways receive sensor events and perform local inspection and routing decisions.
- Fog layer: fog nodes provide intermediate computation and load balancing between edge and cloud.
- Private cloud layer: the cloud stores, analyzes, reports, and visualizes the final monitoring data.

In the implemented simulation, each sensor node represents one physical sensor type. One event is generated from one sensor reading, not from a combined group of seven sensors. The event includes the current reading, recent history from the same sensor, timestamp, sensor ID, edge gateway, severity, deadline, payload size, and computation demand. The algorithm classifies the reading into normal, warning, or critical levels and calculates spike, trend, volatility, and anomaly scores.

After the event is created, the DRL policy evaluates candidate processing paths. The policy considers delay, hop count, congestion, energy cost, task size, bandwidth cost, compute pressure, reliability risk, severity deadline, dynamic node load, and dynamic link load. The selected route is then recorded and shown in the cloud dashboard. These factors reflect common objectives used in computation offloading studies, especially latency, energy, reliability, resource pressure, and task demand [1], [5], [6].

## 4. Sensors and Information Used

The solution can use the following industrial sensor types:

- Temperature sensors for overheating and thermal abnormality detection.
- Vibration sensors for mechanical imbalance, bearing issues, and abnormal machine movement.
- Current sensors for electrical load and motor behavior.
- Pressure sensors for process stability and pipeline/system pressure.
- Flow-rate sensors for production or fluid movement monitoring.
- Acoustic sensors for abnormal sound patterns.
- Humidity sensors for environmental and equipment condition monitoring.

Each event includes:

- Sensor ID and node ID.
- Edge gateway ID.
- Timestamp.
- Sensor type.
- Current reading value and unit.
- Recent history from the same sensor.
- Threshold status.
- Severity level: normal, warning, or critical.
- Priority and deadline.
- Event reason.
- Payload size in KB.
- CPU-cycle demand.
- DRL routing decision and route path.

This gives the company both the operational reading and the technical context needed to understand how the system handled the event.

## 5. Communication Technologies

The solution can use a combination of industrial and IIoT communication technologies:

- MQTT for lightweight publish/subscribe sensor messaging.
- OPC UA for secure industrial data exchange with machines, PLCs, and supervisory systems.
- Modbus TCP for integration with existing industrial devices.
- REST APIs for cloud dashboard access and reporting.
- Ethernet, Wi-Fi, or private 5G depending on plant requirements.

In the simulation, communication overhead is modeled through `protocol_security_overhead_kb`. This represents the estimated API wrapper, protocol metadata, serialization overhead, and security/authentication metadata that would travel with the event in a real system. The model does not simulate exact TCP segmentation or packet-level retransmission, because the focus is task offloading and resource allocation rather than packet-level network emulation. This is consistent with task-level offloading models, where the task is commonly represented using data size, computation demand, deadline, and communication cost rather than exact packet traces [5], [7].

## 6. IIoT Analytics

The solution applies analytics at the event, routing, and cloud-reporting levels.

At the sensor-event level, the system calculates:

- Threshold classification.
- Historical average.
- Previous-value delta.
- Spike score.
- Trend score.
- Trend direction.
- Volatility score.
- History anomaly score.
- Final severity level.

At the offloading level, the DRL policy evaluates multi-objective factors similar to those used in DRL and MEC offloading studies [1], [2]:

- Estimated delay.
- Hop count.
- Network congestion.
- Energy cost.
- Task size.
- Bandwidth cost.
- Compute pressure.
- Reliability risk.
- Deadline satisfaction.

At the cloud-dashboard level, the system reports:

- Total events.
- Normal, warning, and critical distributions.
- Offloading path distribution.
- Dynamic node load.
- Dynamic link load.
- Total transmitted data.
- Event payload size.
- CPU cycles.
- Cloud records and status traces.

These analytics help operators understand not only what happened to the equipment, but also how the infrastructure responded.

## 7. Cybersecurity Considerations

Cybersecurity is essential because the solution handles industrial sensor data, routing decisions, and operational records. The proposed cybersecurity controls include:

- Device authentication for sensor nodes, edge gateways, fog nodes, and cloud services.
- Encrypted communication using TLS where supported.
- Role-based access control for dashboard users.
- API authentication for cloud endpoints.
- Segmentation between sensor networks, edge/fog infrastructure, and dashboard users.
- Logging and monitoring of abnormal communication behavior.
- Integrity checks for event and decision records.

In the simulation, cybersecurity overhead is included as part of the modeled data size. The field `payload_device_security_metadata_kb` represents device/security metadata attached to the event, while `protocol_security_overhead_kb` represents the communication and security wrapper around the transferred message.

## 8. Digital Twin Concept

The digital twin in this solution is a virtual representation of the industrial sensing and computing environment. It includes sensor nodes, edge gateways, fog nodes, cloud infrastructure, communication links, event routes, load conditions, and performance metrics.

The digital twin helps the company by:

- Visualizing the plant and topology layers.
- Showing which sensors are normal, warning, or critical.
- Showing how events move through edge, fog, and cloud.
- Displaying link status, transmitted data, congestion, and routed tasks.
- Testing different workloads without disrupting the real plant.
- Supporting decision-making before deploying changes to the physical environment.

The implemented dashboard acts as the digital twin interface. It includes plant view, network topology, node details, factor analysis, sensor readings, offloading decisions, analytics, logs, and reports.

## 9. Edge and Fog Computing

The solution uses edge and fog computing to avoid sending every event directly to the cloud. Edge gateways are close to the sensors and can support fast local processing. Fog nodes provide additional intermediate capacity and can reduce pressure on both edge and cloud layers.

The implemented policy does not assign fixed computation roles such as “edge always performs stage one” or “fog always performs stage two.” Instead, the DRL policy dynamically evaluates candidate destinations for each event. This is more flexible because the best decision depends on current severity, deadline, available capacity, link condition, congestion, and reliability. This design is aligned with adaptive offloading and layered edge-cloud decision models, where the offloading action changes according to task and resource conditions [3], [4].

The system supports these offloading scenarios:

- Local edge processing.
- Edge-to-edge rerouting.
- Edge-to-fog processing.
- Fog-to-fog rerouting.
- Cloud escalation.

After each decision, the selected destination node and route links reserve simulated load for a period of time. This means later decisions react to changing node capacity and link traffic, making the simulation more realistic than a static routing model. This supports the resource-allocation perspective discussed in dynamic offloading and MEC studies [2], [7].

## 10. Expected Benefits

The proposed IIoT solution can provide several business and operational benefits:

- Reduced latency for critical events by processing suitable tasks closer to the sensor.
- Better resource utilization through dynamic edge, fog, and cloud offloading.
- Lower network congestion compared with sending all events directly to the cloud.
- Improved equipment visibility through sensor history, anomaly scores, and cloud records.
- Increased uptime by detecting warning and critical behavior earlier.
- Better safety through faster escalation of critical equipment conditions.
- Improved decision transparency because the dashboard shows why and where each task was routed.
- Better planning through digital twin simulation before real deployment.

## 11. Conclusion

This proposal presents a practical IIoT solution for smart industrial monitoring using sensors, edge/fog/cloud infrastructure, DRL-based offloading, and a private cloud dashboard. The implemented YAFS simulation demonstrates how single-sensor events can be classified, sized, processed, routed, and reported across a large topology of 700 sensors, 220 edge gateways, 79 fog nodes, and one cloud node.

The main contribution is not only detecting abnormal sensor readings, but also deciding where each event should be processed based on network, compute, energy, reliability, and deadline conditions. This makes the solution suitable for industrial environments where real-time response, resource efficiency, and operational visibility are important. The proposed approach therefore connects the practical IIoT monitoring problem with current research directions in DRL-based task offloading, latency-aware processing, energy-aware routing, and dynamic resource allocation [1]-[7].

## References

[1] “Distributed task offloading in edge computing: A multi-objective adaptive deep reinforcement learning algorithm,” *Engineering Applications of Artificial Intelligence*, 2025, doi: 10.1016/j.engappai.2025.112653.

[2] “Multi-objective task offloading optimization using deep reinforcement learning with resource distribution clustering,” *ICT Express*, 2025, doi: 10.1016/j.icte.2025.05.006.

[3] “Energy-efficient task offloading in the Industrial Internet of Things: A Lyapunov-guided multi-agent deep reinforcement learning approach,” *Journal of Industrial Information Integration*, 2025, doi: 10.1016/j.jii.2025.101037.

[4] “An advanced deep reinforcement learning algorithm for three-layer D2D-edge-cloud computing architecture for efficient task offloading in the Internet of Things,” *Sustainable Computing: Informatics and Systems*, 2024, doi: 10.1016/j.suscom.2024.100992.

[5] “Deep reinforcement learning for optimizing computation latency in wireless-powered Multi-Access Edge Computing systems: A partial offloading approach,” *Ad Hoc Networks*, 2025, doi: 10.1016/j.adhoc.2025.103971.

[6] “Reliable and efficient computation offloading for dependency-aware tasks in IIoT using evolutionary multi-objective optimization,” *Future Generation Computer Systems*, 2025, doi: 10.1016/j.future.2025.107923.

[7] “Dynamic offloading strategy for computational energy efficiency of wireless power transfer based MEC networks in Industry 5.0,” *Journal of King Saud University - Computer and Information Sciences*, 2023, doi: 10.1016/j.jksuci.2023.101841.
