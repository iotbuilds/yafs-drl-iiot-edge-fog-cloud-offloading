import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChartCardComponent } from './chart-card.component';
import { AlertOctagon, AlertTriangle, ArrowUpRight, CheckCircle, Cloud, Cpu, GitBranch, LucideAngularModule, Server, Timer, Wifi, Zap } from 'lucide-angular';
import { Snapshot, YafsApiService } from './yafs-api.service';

const PATH_LABELS: Record<string, string> = {
  local_edge: 'Local',
  edge_to_edge: 'Edge-to-Edge',
  edge_to_fog: 'Edge-to-Fog',
  fog_to_fog: 'Fog-to-Fog',
  cloud_escalation: 'Cloud'
};

const FACTORS = [
  { key: 'factor_delay', label: 'Delay', unit: 'score', normal: '0.00 - 0.40', warning: '0.40 - 0.70', critical: '> 0.70' },
  { key: 'factor_hop_count', label: 'Hop Count', unit: 'score', normal: '0.00 - 0.30', warning: '0.30 - 0.60', critical: '> 0.60' },
  { key: 'factor_network_condition', label: 'Congestion', unit: '%', normal: '0 - 40%', warning: '40 - 75%', critical: '> 75%' },
  { key: 'factor_energy_cost', label: 'Energy', unit: 'score', normal: '0.00 - 0.40', warning: '0.40 - 0.70', critical: '> 0.70' },
  { key: 'factor_task_size', label: 'Task Size', unit: 'score', normal: '0.00 - 0.40', warning: '0.40 - 0.70', critical: '> 0.70' },
  { key: 'factor_bandwidth_cost', label: 'Bandwidth Cost', unit: 'score', normal: '0.00 - 0.40', warning: '0.40 - 0.70', critical: '> 0.70' },
  { key: 'factor_compute_pressure', label: 'Computational Load', unit: '%', normal: '0 - 40%', warning: '40 - 75%', critical: '> 75%' },
  { key: 'factor_compute_demand_ratio', label: 'Task CPU Demand', unit: '%', normal: '0 - 40%', warning: '40 - 75%', critical: '> 75%' }
];

const SENSOR_FIELDS = [
  ['vibration', 'reading_vibration', 'status_vibration', 'mm/s RMS'],
  ['temperature', 'reading_temperature', 'status_temperature', 'C'],
  ['pressure', 'reading_pressure', 'status_pressure', 'bar'],
  ['current', 'reading_current', 'status_current', 'A'],
  ['acoustic', 'reading_acoustic', 'status_acoustic', 'dB'],
  ['flow rate', 'reading_flow_rate', 'status_flow_rate', 'L/min'],
  ['humidity', 'reading_humidity', 'status_humidity', '%RH']
] as const;

const PAYLOAD_COMPONENTS = [
  ['payload_event_metadata_kb', 'Event Metadata'],
  ['payload_sensor_sample_window_kb', 'Sensor Sample Window'],
  ['payload_waveform_fault_window_kb', 'Waveform / Fault Window'],
  ['payload_diagnostic_logs_kb', 'Diagnostic Logs'],
  ['payload_machine_context_kb', 'Machine Context'],
  ['payload_calculated_features_kb', 'Calculated Features'],
  ['payload_device_security_metadata_kb', 'Device/Security Metadata']
] as const;

const COMPUTE_STAGES = [
  ['intake_validation_cycles', 'Intake Validation'],
  ['threshold_classification_cycles', 'Threshold Classification'],
  ['feature_extraction_cycles', 'Feature Extraction'],
  ['history_analysis_cycles', 'History Analysis'],
  ['aggregation_cycles', 'Aggregation'],
  ['cloud_analytics_cycles', 'Cloud Analytics'],
  ['decision_packaging_cycles', 'Decision Packaging']
] as const;

const PLANT_ZONES = [
  { id: 'zone_1', name: 'Zone 1', color: '#3b82f6', x: 40, y: 95, w: 150, h: 245 },
  { id: 'zone_2', name: 'Zone 2', color: '#8b5cf6', x: 220, y: 95, w: 150, h: 245 },
  { id: 'zone_3', name: 'Zone 3', color: '#f59e0b', x: 400, y: 95, w: 150, h: 245 },
  { id: 'zone_4', name: 'Zone 4', color: '#10b981', x: 580, y: 95, w: 150, h: 245 },
  { id: 'zone_5', name: 'Zone 5', color: '#ef4444', x: 760, y: 95, w: 150, h: 245 },
  { id: 'zone_6', name: 'Zone 6', color: '#06b6d4', x: 40, y: 410, w: 150, h: 245 },
  { id: 'zone_7', name: 'Zone 7', color: '#ec4899', x: 220, y: 410, w: 150, h: 245 },
  { id: 'zone_8', name: 'Zone 8', color: '#84cc16', x: 400, y: 410, w: 150, h: 245 },
  { id: 'zone_9', name: 'Zone 9', color: '#f97316', x: 580, y: 410, w: 150, h: 245 },
  { id: 'zone_10', name: 'Zone 10', color: '#14b8a6', x: 760, y: 410, w: 150, h: 245 }
];

const SENSOR_COLORS: Record<string, string> = {
  normal: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  unknown: '#64748b'
};

const NAV_ITEMS = ['Overview', 'Plant View', 'Network Topology', 'Node Details', '7F Factors', '7S Sensors', 'Offloading Decisions', 'Analytics', 'Tables & Logs', 'Reports'];

type Trend = 'increasing' | 'decreasing' | 'stable';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ChartCardComponent, LucideAngularModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly api = inject(YafsApiService);
  private sub?: Subscription;

  readonly navItems = NAV_ITEMS;
  readonly selectedPage = signal('Overview');
  readonly isLightMode = signal(false);
  readonly plantZoom = signal(0.7);
  readonly plantFullscreen = signal(false);
  readonly plantZoneFilter = signal('all');
  readonly plantStatusFilter = signal('all');
  readonly hoveredPlantNode = signal<any | null>(null);
  readonly selectedPlantNode = signal<any | null>(null);
  readonly topologyZoom = signal(0.85);
  readonly hoveredTopologyNode = signal<string | null>(null);
  readonly selectedTopologyLink = signal<any | null>(null);
  readonly topologyStateFilter = signal('all');
  readonly topologyTypeFilter = signal('all');
  readonly nodeSearch = signal('');
  readonly nodeLayerFilter = signal('all');
  readonly nodeZoneFilter = signal('all');
  readonly nodeStatusFilter = signal('all');
  readonly nodeDecisionFilter = signal('all');
  readonly nodePage = signal(0);
  readonly nodePageSize = 25;
  readonly selectedNodeDetails = signal<any | null>(null);
  readonly snapshot = this.api.snapshot;
  readonly active = this.api.active;
  readonly view = computed(() => buildView(this.snapshot()));
  readonly charts = computed(() => buildCharts(this.snapshot()));

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('cloud-light', this.isLightMode());
    });
  }

  ngOnInit() {
    this.sub = this.api.startPolling();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  selectPage(page: string) {
    this.selectedPage.set(page);
  }

  setPlantZoneFilter(value: string) {
    this.plantZoneFilter.set(value);
    this.selectedPlantNode.set(null);
  }

  setPlantStatusFilter(value: string) {
    this.plantStatusFilter.set(value);
    this.selectedPlantNode.set(null);
  }

  zoomPlant(delta: number) {
    this.plantZoom.update(value => Math.max(0.3, Math.min(1.5, round(value + delta, 2))));
  }

  togglePlantFullscreen() {
    this.plantFullscreen.update(value => !value);
  }

  zoomTopology(delta: number) {
    this.topologyZoom.update(value => Math.max(0.4, Math.min(1.5, round(value + delta, 2))));
  }

  refresh() {
    this.sub?.unsubscribe();
    this.sub = this.api.startPolling();
  }

  toggleTheme() {
    this.isLightMode.update(value => !value);
  }

  plantNodes() {
    return visiblePlantNodes(this.view().plant, this.plantZoneFilter(), this.plantStatusFilter());
  }

  plantZones() {
    return visiblePlantZones(this.view().plant, this.plantNodes());
  }

  shortEdge(value: unknown) {
    return shortEdge(value);
  }

  setTopologyStateFilter(value: string) {
    this.topologyStateFilter.set(value);
  }

  setTopologyTypeFilter(value: string) {
    this.topologyTypeFilter.set(value);
  }

  filteredTopologyLinks() {
    return filterTopologyLinks(this.view().topology.links, this.topologyStateFilter(), this.topologyTypeFilter());
  }

  topologyLinkTypes() {
    return this.view().topology.linkTypes;
  }

  trackByLinkId(_: number, link: any) {
    return link.id;
  }

  setNodeSearch(value: string) {
    this.nodeSearch.set(value);
    this.nodePage.set(0);
  }

  setNodeLayerFilter(value: string) {
    this.nodeLayerFilter.set(value);
    this.nodePage.set(0);
  }

  setNodeZoneFilter(value: string) {
    this.nodeZoneFilter.set(value);
    this.nodePage.set(0);
  }

  setNodeStatusFilter(value: string) {
    this.nodeStatusFilter.set(value);
    this.nodePage.set(0);
  }

  setNodeDecisionFilter(value: string) {
    this.nodeDecisionFilter.set(value);
    this.nodePage.set(0);
  }

  filteredNodeDetails() {
    return filterNodeDetails(this.view().nodeDetails, {
      query: this.nodeSearch(),
      layer: this.nodeLayerFilter(),
      zone: this.nodeZoneFilter(),
      status: this.nodeStatusFilter(),
      decision: this.nodeDecisionFilter()
    });
  }

  pagedNodeDetails() {
    const filtered = this.filteredNodeDetails();
    const start = this.nodePage() * this.nodePageSize;
    return filtered.slice(start, start + this.nodePageSize);
  }

  nodeTotalPages() {
    return Math.max(1, Math.ceil(this.filteredNodeDetails().length / this.nodePageSize));
  }

  nodeRangeStart() {
    return this.filteredNodeDetails().length ? this.nodePage() * this.nodePageSize + 1 : 0;
  }

  nodeRangeEnd() {
    return Math.min((this.nodePage() + 1) * this.nodePageSize, this.filteredNodeDetails().length);
  }

  previousNodePage() {
    this.nodePage.update(page => Math.max(0, page - 1));
  }

  nextNodePage() {
    this.nodePage.update(page => Math.min(this.nodeTotalPages() - 1, page + 1));
  }

  selectNodeDetails(node: any) {
    this.selectedNodeDetails.set(node);
  }

  nodeFilterOptions(field: string) {
    const values = new Set(this.view().nodeDetails.map((node: any) => String(node[field] ?? '')).filter(Boolean));
    return Array.from(values).sort();
  }

  trackByNodeId(_: number, node: any) {
    return node.node_id;
  }

  topologyNodeCenter(id: string) {
    const topology = this.view().topology;
    const node = [...topology.edges, ...topology.fogs, topology.cloud].find((item: any) => item?.id === id);
    return node ? { x: node.x + node.w / 2, y: node.y + node.h / 2 } : { x: 0, y: 0 };
  }

  trackByLabel(index: number, item: { label?: string; id?: string; event_id?: string; node_id?: string }) {
    return item.label ?? item.id ?? item.event_id ?? item.node_id ?? index;
  }
}

function buildView(snapshot: Snapshot | null) {
  const kpis = snapshot?.kpis ?? {};
  const confirmed = kpis.confirmed_10p ?? {};
  const nodes = snapshot?.nodes ?? [];
  const events = snapshot?.events ?? [];
  const decisions = snapshot?.decisions ?? [];
  const cloudRecords = snapshot?.cloudRecords ?? [];
  const latestSensors = latestSensorRows(events);
  const pathCounts = { ...countBy(decisions, 'offloading_scenario'), ...(kpis.path_distribution ?? {}) };
  const severity = kpis.severity_counts_3l ?? countBy(events, 'severity');
  const nodeLayers = countBy(nodes, 'layer');
  const policyModes = confirmed.drl_model_efficiency?.policy_modes ?? countBy(decisions, 'policy_mode');
  const avgCompute = average(decisions.map(item => Number(item.factor_compute_pressure ?? 0))) * 100;
  const trends = buildTrends(decisions, events);

  const totalEvents = Number(kpis.total_events ?? decisions.length) || 1;
  const pathRatios = confirmed.offloading_ratio_path_distribution ?? {};
  const localPct = percentFromRatioOrCount(pathRatios.local_edge, pathCounts.local_edge, totalEvents);
  const edgeToCloudPct = percentFromRatioOrCount(pathRatios.cloud_escalation, pathCounts.cloud_escalation, totalEvents);
  const edgeServers = nodes.filter(node => node.layer === 'edge').length;
  const fogServers = nodes.filter(node => node.layer === 'fog').length;
  const sensorCount = nodes.filter(node => node.has_7s || node.layer === 'sensor').length || latestSensors.length;

  const summary = [
    { label: 'Total IIoT Sensors', value: formatInt(sensorCount), icon: Server, colorClass: 'blue', trend: 'stable' as Trend, tooltip: 'Total sensors deployed across the industrial plant' },
    { label: 'Active Sensors', value: formatInt(severity.normal ?? 0), icon: CheckCircle, colorClass: 'green', trend: trends.normal, tooltip: 'Sensors operating within normal parameters' },
    { label: 'Warning Sensors', value: formatInt(severity.warning ?? 0), icon: AlertTriangle, colorClass: 'amber', trend: trends.warning, tooltip: 'Sensors with readings approaching thresholds' },
    { label: 'Critical Sensors', value: formatInt(severity.critical ?? 0), icon: AlertOctagon, colorClass: 'red', trend: trends.critical, tooltip: 'Sensors with readings exceeding critical thresholds' },
    { label: 'Edge Servers', value: formatInt(edgeServers), icon: Cpu, colorClass: 'blue', trend: 'stable' as Trend, tooltip: 'Active edge computing servers' },
    { label: 'Fog Servers', value: formatInt(fogServers), icon: Cloud, colorClass: 'purple', trend: 'stable' as Trend, tooltip: 'Active fog computing servers' },
    { label: 'Avg Latency', value: round(confirmed.latency ?? 0, 3), suffix: 'ms', icon: Timer, colorClass: 'cyan', trend: trends.latency, tooltip: 'Average task processing latency across all nodes' },
    { label: 'Avg Energy', value: round(confirmed.energy_consumption ?? 0, 3), suffix: 'J', icon: Zap, colorClass: 'yellow', trend: trends.energy, tooltip: 'Average energy consumption per task' },
    { label: 'Avg Congestion', value: round((confirmed.congestion_score ?? kpis.avg_congestion_score ?? 0) * 100, 2), suffix: '%', icon: Wifi, colorClass: 'orange', trend: trends.congestion, tooltip: 'Average network congestion level' },
    { label: 'Tasks Offloaded', value: formatInt(kpis.total_events ?? decisions.length), icon: GitBranch, colorClass: 'indigo', trend: trends.totalEvents, tooltip: 'Total DQN offloading decisions made' },
    { label: 'Local Processing', value: localPct, suffix: '%', icon: Server, colorClass: 'green', trend: trends.local, tooltip: 'Tasks processed locally at source node' },
    { label: 'Cloud Offload', value: edgeToCloudPct, suffix: '%', icon: ArrowUpRight, colorClass: 'gray', trend: trends.cloud, tooltip: 'Tasks escalated to cloud' }
  ];
  const layers = ['sensor', 'edge', 'fog', 'cloud'].map(layer => ({
    label: title(layer),
    value: nodeLayers[layer] ?? (layer === 'sensor' ? nodes.filter(node => node.has_7s).length : 0)
  }));

  const factors = FACTORS.map(factor => {
    const values = decisions.map(decision => Number(decision[factor.key] ?? 0));
    const avg = average(values);
    const display = factor.unit === '%' ? `${round(avg * 100, 2)}%` : round(avg, 3).toString();
    return { ...factor, avg, display, status: factorStatus(avg) };
  });

  const topNodes = Object.entries(kpis.top_risky_nodes ?? {}).slice(0, 10).map(([id, count]) => ({ id, count }));
  const pathRows = Object.keys(PATH_LABELS).map(key => ({ label: PATH_LABELS[key], count: Number(pathCounts[key] ?? 0) }));
  const plant = buildPlantView(nodes, events, decisions);
  const topology = buildTopologyView(snapshot?.topology ?? {}, nodes, events, decisions, cloudRecords, kpis);
  const nodeDetails = buildNodeDetails(nodes, events, decisions);
  const payloadReport = buildPayloadReport(kpis, events, decisions, cloudRecords);

  return {
    summary,
    layers,
    plant,
    topology,
    factors,
    pathRows,
    topNodes,
    nodeDetails,
    latestSensors: latestSensors.slice(0, 20),
    nodes: nodes.slice(0, 30),
    decisions: decisions.slice(0, 30),
    events: events.slice(0, 30),
    cloudRecords: cloudRecords.slice(0, 30),
    payloadReport,
    policyModes: Object.entries(policyModes).map(([label, count]) => ({ label: title(label), count })),
    report: [
      { label: 'Average Reward', value: round(confirmed.drl_model_efficiency?.avg_reward ?? 0, 4) },
      { label: 'Average Score', value: round(confirmed.drl_model_efficiency?.avg_score ?? 0, 4) },
      { label: 'Throughput', value: formatInt(confirmed.throughput ?? 0) },
      { label: 'Network Overhead', value: formatInt(confirmed.network_overhead_bytes ?? kpis.network_bytes_transmitted_est ?? 0) },
      { label: 'Total Transfer', value: formatInt(confirmed.total_transfer_bytes_est ?? kpis.total_transfer_bytes_est ?? 0) },
      { label: 'Fairness Load Balancing', value: round(confirmed.fairness_load_balancing ?? 0, 4) }
    ]
  };
}

function buildPlantView(nodes: any[], events: any[], decisions: any[]) {
  const latestBySensor = new Map<string, any>();
  for (const event of events) {
    const id = event.source_sensor ?? event.node_id;
    if (!id) continue;
    const current = latestBySensor.get(id);
    if (!current || Number(event.timestamp ?? 0) >= Number(current.timestamp ?? 0)) latestBySensor.set(id, event);
  }

  const decisionByEvent = new Map(decisions.map(decision => [decision.event_id, decision]));
  const edgeCounts = countBy(nodes.filter(node => node.layer === 'edge'), 'zone');
  const sensorNodes = nodes
    .filter(node => node.layer === 'sensor' || node.has_7s)
    .map(node => {
      const event = latestBySensor.get(node.node_id);
      const decision = event ? decisionByEvent.get(event.event_id) : null;
      const status = event?.severity ?? event?.event_level_3l ?? node.status ?? 'unknown';
      const sensorType = normalizeSensorKey(event?.dominant_sensor_type ?? event?.sensor_type ?? node.sensor_type);
      return {
        id: node.node_id,
        zone: node.zone ?? event?.zone ?? 'zone_1',
        edge: node.edge_gateway ?? event?.edge_gateway ?? event?.source_edge ?? 'unassigned',
        status,
        color: SENSOR_COLORS[status] ?? SENSOR_COLORS.unknown,
        sensorType,
        sensorLabel: title(sensorType),
        event,
        decision,
        reading: event?.reading_value,
        unit: event?.unit ?? '',
        delay: decision?.estimated_delay,
        route: formatRoutePath(decision?.route_path ?? event?.route_path),
        deadlineMet: decision?.deadline_met ?? event?.deadline_met,
        selectedLayer: decision?.selected_layer ?? event?.selected_layer,
        reason: decision?.decision_reason ?? event?.event_reason ?? ''
      };
    });

  const positionedNodes: any[] = [];
  const zoneGroups = new Map<string, any[]>();
  for (const zone of PLANT_ZONES) {
    const zoneNodes = sensorNodes
      .filter(node => node.zone === zone.id)
      .sort((a, b) => `${a.edge}-${a.sensorType}-${a.id}`.localeCompare(`${b.edge}-${b.sensorType}-${b.id}`));
    const grouped = groupByMap(zoneNodes, node => node.edge || 'unassigned');
    const groups = Array.from(grouped.entries()).map(([edge, groupNodes]) => ({ edge, nodes: groupNodes as any[] }));
    const segmentWidth = (zone.w - 28) / Math.max(1, groups.length);
    const labels: any[] = [];

    groups.forEach((group, groupIndex) => {
      const cols = Math.max(1, Math.ceil(Math.sqrt(group.nodes.length)));
      const rows = Math.max(1, Math.ceil(group.nodes.length / cols));
      const groupX = zone.x + 14 + groupIndex * segmentWidth;
      const groupW = segmentWidth;
      const top = zone.y + 52;
      const height = zone.h - 86;
      labels.push({ edge: group.edge, labelX: groupX + groupW / 2 });

      group.nodes.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const xStep = groupW / (cols + 1);
        const yStep = height / (rows + 1);
        positionedNodes.push({
          ...node,
          mapX: Math.round(groupX + xStep * (col + 1)),
          mapY: Math.round(top + yStep * (row + 1))
        });
      });
    });

    zoneGroups.set(zone.id, labels);
  }

  return {
    zones: PLANT_ZONES.map(zone => ({
      ...zone,
      count: sensorNodes.filter(node => node.zone === zone.id).length,
      edgeCount: edgeCounts[zone.id] ?? 0,
      groups: zoneGroups.get(zone.id) ?? []
    })),
    nodes: positionedNodes,
    edgeGateways: nodes.filter(node => node.layer === 'edge').slice(0, 20).map((node, index) => ({
      id: node.node_id,
      x: 35 + (index % 20) * 44,
      y: 20
    })),
    legend: [
      { label: 'Normal', color: SENSOR_COLORS.normal },
      { label: 'Warning', color: SENSOR_COLORS.warning },
      { label: 'Critical', color: SENSOR_COLORS.critical },
      { label: 'Edge gateway', color: '#3b82f6' }
    ]
  };
}

function buildTopologyView(rawTopology: any, nodes: any[], events: any[], decisions: any[], cloudRecords: any[], kpis: any) {
  const decisionsBySourceEdge = groupByMap(decisions, decision => decision.source_edge || 'unknown');
  const allLinks = rawTopology.links ?? [];
  const sensorLinks = allLinks.filter(isSensorEdgeLink);
  const sensorLinksByEdge = groupByMap(sensorLinks, sensorEdgeEndpoint);
  const edges = nodes.filter(node => node.layer === 'edge').map(node => transformEdgeNode(node, rawTopology, decisionsBySourceEdge, sensorLinksByEdge));
  const fogs = nodes.filter(node => node.layer === 'fog').map(node => transformFogNode(node, rawTopology, decisions));
  const cloudNode = nodes.find(node => node.layer === 'cloud');
  const cloud = transformCloudNode(cloudNode, rawTopology, cloudRecords, decisions, kpis);
  const infrastructureNodeIds = new Set([
    ...edges.map(edge => edge.id),
    ...fogs.map(fog => fog.id),
    cloud.id
  ]);
  const infrastructureLinks = allLinks.filter((link: any) =>
    !isSensorEdgeLink(link) && infrastructureNodeIds.has(link.source) && infrastructureNodeIds.has(link.target)
  );
  const linkTraffic = buildLinkTrafficStats(decisions, events);
  const links = infrastructureLinks.map((link: any, index: number) => linkMetricFromApi(link, linkTraffic.get(physicalLinkKey(link.source, link.target)), index));
  const linkTypes = Array.from(new Set(links.map((link: any) => link.type)));
  const totalTransmittedBytes = links.reduce((total: number, link: any) => total + Number(link.bytes ?? 0), 0);
  const sensorGroups = edges
    .filter(edge => edge.connectedNodes > 0)
    .map(edge => ({
      id: `${edge.id}-sensors`,
      edgeId: edge.id,
      count: edge.connectedNodes,
      x: edge.x + edge.w / 2,
      y: edge.y + edge.h + 17,
      r: Math.max(4, Math.min(11, 3 + Math.sqrt(edge.connectedNodes) * 1.6)),
      label: `${edge.connectedNodes}`
    }));

  return {
    edges,
    fogs,
    cloud,
    sensorGroups,
    links,
    linkTypes,
    edgeCount: rawTopology.confirmed_distribution?.edge ?? edges.length,
    fogCount: rawTopology.confirmed_distribution?.fog ?? fogs.length,
    sensorCount: rawTopology.confirmed_distribution?.sensor ?? nodes.filter(node => node.layer === 'sensor').length,
    linkCount: infrastructureLinks.length,
    activeLinkCount: links.filter((link: any) => link.status === 'active' || link.status === 'healthy').length,
    inactiveLinkCount: links.filter((link: any) => link.status === 'inactive').length,
    congestedLinkCount: links.filter((link: any) => link.status === 'congested').length,
    totalTransmittedBytes,
    totalTransmittedLabel: formatBytes(totalTransmittedBytes)
  };
}

function buildPayloadReport(kpis: any, events: any[], decisions: any[], cloudRecords: any[]) {
  const confirmed = kpis.confirmed_10p ?? {};
  const componentBytes = kpis.payload_component_bytes_est ?? confirmed.payload_component_bytes ?? {};
  const computeStageCycles = kpis.compute_stage_cycles_est ?? confirmed.compute_stage_cycles ?? {};
  const algorithmMetrics = kpis.algorithm_metrics ?? confirmed.algorithm_metrics ?? {};
  const dynamicMetrics = kpis.dynamic_resource_metrics ?? confirmed.dynamic_resource_metrics ?? {};
  const avgEvent = (key: string) => round(average(events.map(event => Number(event[key] ?? 0))), 3);
  const avgDecision = (key: string) => round(average(decisions.map(decision => Number(decision[key] ?? 0))), 4);
  const avgCloud = (key: string) => round(average(cloudRecords.map(record => Number(record[key] ?? 0))), 3);

  return {
    formulas: [
      { label: 'event_payload_kb', formula: 'metadata + sample window + waveform/fault window + logs + machine context + features + device/security metadata', usedFor: 'Original sensor event payload before DRL' },
      { label: 'protocol_security_overhead_kb', formula: 'base protocol/security overhead + 4% of event_payload_kb', usedFor: 'Communication wrapper added before routing' },
      { label: 'task_size_kb', formula: 'event_payload_kb + protocol_security_overhead_kb', usedFor: 'Main data size used by YAFS/DRL routing' },
      { label: 'task_cpu_cycles', formula: 'task_size_kb * severity CPU cycles per KB', usedFor: 'Task processing burden' },
      { label: 'compute_demand_ratio', formula: 'task_cpu_cycles / target node compute capacity', usedFor: 'DRL compute feasibility factor' },
      { label: 'decision_metadata_kb', formula: '4.0 KB + 0.35 KB per route hop', usedFor: 'DRL decision information after the route is selected' },
      { label: 'monitoring_export_kb', formula: 'cloud/API record overhead by record type', usedFor: 'Dashboard/cloud reporting only' },
      { label: 'total_transfer_kb', formula: 'task_size_kb + decision_metadata_kb + monitoring_export_kb', usedFor: 'Reporting total, not direct DRL routing input' }
    ],
    components: PAYLOAD_COMPONENTS.map(([key, label]) => {
      const shortKey = key.replace('payload_', '').replace('_kb', '');
      return {
        label,
        what: payloadComponentMeaning(key),
        avgKb: `${avgEvent(key)} KB`,
        total: formatBytes(Number(componentBytes[shortKey] ?? 0)),
        countedIn: 'event_payload_kb'
      };
    }),
    computeStages: COMPUTE_STAGES.map(([key, label]) => {
      const shortKey = key.replace('_cycles', '');
      return {
        label,
        what: computeStageMeaning(key),
        avgCycles: formatInt(Math.round(average(events.map(event => Number(event[key] ?? 0))))),
        totalCycles: formatInt(Number(computeStageCycles[shortKey] ?? 0)),
        countedIn: 'task_cpu_cycles'
      };
    }),
    averages: [
      { label: 'Avg Event Payload', value: `${avgEvent('event_payload_kb')} KB` },
      { label: 'Avg Protocol/Security Overhead', value: `${avgEvent('protocol_security_overhead_kb')} KB` },
      { label: 'Avg Task Size Used by DRL', value: `${avgEvent('task_size_kb')} KB` },
      { label: 'Avg Task CPU Cycles', value: formatInt(Math.round(average(events.map(event => Number(event.task_cpu_cycles ?? 0))))) },
      { label: 'Avg Compute Demand Ratio', value: `${round(avgDecision('factor_compute_demand_ratio') * 100, 2)}%` },
      { label: 'Avg Node Load Before', value: `${round(Number(dynamicMetrics.avg_node_load_before ?? avgDecision('dynamic_node_load_before')) * 100, 2)}%` },
      { label: 'Avg Node Load After', value: `${round(Number(dynamicMetrics.avg_node_load_after ?? avgDecision('dynamic_node_load_after')) * 100, 2)}%` },
      { label: 'Avg Link Load After', value: `${round(Number(dynamicMetrics.avg_link_load_after ?? avgDecision('dynamic_link_load_after')) * 100, 2)}%` },
      { label: 'Avg Decision Metadata', value: `${avgDecision('decision_metadata_kb')} KB` },
      { label: 'Avg Monitoring Export', value: `${avgCloud('monitoring_export_kb')} KB` }
    ],
    algorithmCards: [
      { label: 'Validation Pass Rate', value: `${round(Number(algorithmMetrics.validation_pass_rate ?? 0) * 100, 2)}%` },
      { label: 'Avg Feature Severity Score', value: round(Number(algorithmMetrics.avg_feature_severity_score ?? 0), 4) },
      { label: 'Avg History Anomaly Score', value: round(Number(algorithmMetrics.avg_history_anomaly_score ?? algorithmMetrics.avg_correlation_score ?? 0), 4) },
      { label: 'Avg Abnormal Sensors', value: round(Number(algorithmMetrics.avg_abnormal_sensor_count ?? 0), 3) }
    ],
    algorithmOutputs: [
      { stage: 'Intake Validation', outputs: 'validation_passed, validation_score, missing/invalid readings', meaning: 'Checks event identity, timestamp, missing readings, and configured reading ranges.' },
      { stage: 'Threshold Classification', outputs: 'current_status, severity', meaning: 'Classifies the current reading from this sensor using the threshold table.' },
      { stage: 'Feature Extraction', outputs: 'historical average, previous delta, spike, trend, volatility, severity score', meaning: 'Calculates same-sensor history features from the current and recent readings.' },
      { stage: 'History Analysis', outputs: 'history anomaly score, anomaly level, active patterns', meaning: 'Detects same-sensor spike, rising/falling trend, and volatility.' },
      { stage: 'Aggregation', outputs: 'window averages, risk distribution, top history patterns', meaning: 'Summarizes recent events for warning, normal, and periodic cloud reports.' },
      { stage: 'Cloud Analytics', outputs: 'cloud_risk_score, cloud_risk_level, escalation recommendation', meaning: 'Combines severity, features, history anomaly, and deadline result into a cloud risk score.' }
    ],
    literatureAlignment: [
      { concept: 'Task/data size', implementedAs: 'task_size_kb', mapping: 'Modeled transferred input size: single-sensor event payload plus protocol/security overhead.' },
      { concept: 'CPU cycles / computation demand', implementedAs: 'task_cpu_cycles', mapping: 'Processing burden derived from task size and severity, then split across the implemented algorithm stages.' },
      { concept: 'Deadline / latency-sensitive offloading', implementedAs: 'deadline, deadline_met', mapping: 'Severity defines the allowed response time; DRL is rewarded when the chosen path meets it.' },
      { concept: 'Computation offloading action', implementedAs: 'selected_layer, destination, route_path, offloading_scenario', mapping: 'The policy chooses local edge, edge-to-edge, edge-to-fog, fog-to-fog, or cloud escalation without fixed layer-specific algorithm roles.' },
      { concept: 'Dynamic resource allocation', implementedAs: 'dynamic_node_load_* and dynamic_link_load_*', mapping: 'Each assigned task reserves compute/link load for a simulated duration, so later decisions react to changing available resources.' },
      { concept: 'Network cost / congestion / bandwidth', implementedAs: 'factor_network_condition, factor_bandwidth_cost', mapping: 'The path score combines topology bandwidth/congestion with active routed traffic.' }
    ],
    literatureReferences: [
      { paper: 'Distributed task offloading in edge computing', supports: 'Multi-objective adaptive DRL task offloading', mapping: 'Used to justify the multi-factor DRL route decision.' },
      { paper: 'Energy-efficient task offloading in IIoT', supports: 'Energy-aware IIoT task offloading and DRL framing', mapping: 'Used to justify keeping energy and resource pressure as policy factors.' },
      { paper: 'Three-layer D2D-edge-cloud task offloading', supports: 'Device/edge/cloud offloading architecture', mapping: 'Used to justify layered routing actions without fixed computation roles.' },
      { paper: 'DRL with resource distribution clustering', supports: 'Resource-aware multi-objective offloading', mapping: 'Used to justify candidate resource comparison and dynamic resource state.' },
      { paper: 'Computation latency optimization in MEC', supports: 'CPU cycles, latency, and resource management', mapping: 'Used to justify separating task_size_kb from task_cpu_cycles.' },
      { paper: 'IIoT dependency-aware computation offloading', supports: 'IIoT reliability and multi-objective optimization', mapping: 'Used to justify reliability risk and deadline reporting.' },
      { paper: 'Dynamic offloading strategy in Industry 5.0 MEC', supports: 'Task computational model and dynamic resource allocation', mapping: 'Used to justify dynamic node load with task CPU demand.' }
    ],
    severityExamples: ['normal', 'warning', 'critical'].map(severity => {
      const group = events.filter(event => event.severity === severity);
      return {
        severity: title(severity),
        events: group.length,
        eventPayload: `${round(average(group.map(event => Number(event.event_payload_kb ?? 0))), 2)} KB`,
        taskSize: `${round(average(group.map(event => Number(event.task_size_kb ?? 0))), 2)} KB`,
        cpuCycles: formatInt(Math.round(average(group.map(event => Number(event.task_cpu_cycles ?? 0)))))
      };
    })
  };
}

function computeStageMeaning(key: string) {
  const meanings: Record<string, string> = {
    intake_validation_cycles: 'message parsing, timestamp/device check, missing-value and range validation',
    threshold_classification_cycles: 'compare the current sensor reading against normal/warning/critical thresholds',
    feature_extraction_cycles: 'derive peaks, averages, RMS-style indicators, deviations, and trends',
    history_analysis_cycles: 'same-sensor spike, trend, and volatility checks using recent readings',
    aggregation_cycles: 'combine events, edge summaries, or regional context',
    cloud_analytics_cycles: 'deeper escalation analytics, storage, and reporting preparation',
    decision_packaging_cycles: 'attach DRL route, factors, deadline result, and monitoring metadata'
  };
  return meanings[key] ?? '';
}

function payloadComponentMeaning(key: string) {
  const meanings: Record<string, string> = {
    payload_event_metadata_kb: 'sensor ID, edge gateway, timestamp, severity, priority, deadline, and event reason',
    payload_sensor_sample_window_kb: 'recent readings from the same sensor used to detect spikes, trends, and volatility',
    payload_waveform_fault_window_kb: 'extra same-sensor values around an abnormal spike or fault window',
    payload_diagnostic_logs_kb: 'diagnostic context attached when the event needs explanation',
    payload_machine_context_kb: 'equipment, zone, edge gateway, operating/source context currently modeled from topology metadata',
    payload_calculated_features_kb: 'derived values such as peaks, averages, RMS, threshold deviations, and trend features',
    payload_device_security_metadata_kb: 'device identity and security/authentication metadata estimate'
  };
  return meanings[key] ?? '';
}

function buildNodeDetails(nodes: any[], events: any[], decisions: any[]) {
  const eventsBySensor = groupByMap(events, event => event.node_id || event.source_sensor || 'unknown');
  const eventsByEdge = groupByMap(events, event => event.edge_gateway || event.source_edge || 'unknown');
  const eventsById = new Map(events.map(event => [event.event_id, event]));
  const decisionsBySourceEdge = groupByMap(decisions, decision => decision.source_edge || 'unknown');
  const transferByNode = buildNodeTransferStats(decisions, eventsById);

  return nodes.map(node => {
    const nodeId = node.node_id;
    const layer = node.layer || (node.has_7s ? 'sensor' : 'unknown');
    const relatedDecisions = decisions.filter(decision => decision.destination === nodeId || formatRoutePath(decision.route_path).split(' -> ').includes(nodeId));
    const sourceDecisions = decisionsBySourceEdge.get(nodeId) ?? [];
    const nodeEvents = layer === 'sensor' ? eventsBySensor.get(nodeId) ?? [] : layer === 'edge' ? eventsByEdge.get(nodeId) ?? [] : [];
    const latestEvent = nodeEvents.length ? nodeEvents[nodeEvents.length - 1] : null;
    const decisionCounts = countBy([...relatedDecisions, ...sourceDecisions], 'offloading_scenario');
    const topDecision = Object.entries(decisionCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] ?? 'N/A';
    const edgeServer = layer === 'sensor'
      ? latestEvent?.edge_gateway ?? node.edge_gateway ?? 'N/A'
      : layer === 'edge'
        ? nodeId
        : relatedDecisions.find(decision => decision.source_edge)?.source_edge ?? 'N/A';
    const transfer = transferByNode.get(nodeId) ?? emptyNodeTransfer();
    const ipt = Number(node.IPT ?? 0);
    const computeCapacityCycles = ipt > 0 ? ipt * 100_000 : Number(node.compute_capacity ?? 0) * 100_000_000;
    const computeDemandRatio = computeCapacityCycles > 0 && transfer.cpuCycles > 0 ? transfer.cpuCycles / computeCapacityCycles : 0;

    return {
      ...node,
      equipment: node.node_type || node.role || title(layer),
      edgeServer,
      decisionKey: topDecision,
      decisionType: title(topDecision),
      decisionCount: relatedDecisions.length + sourceDecisions.length,
      lastUpdate: latestEvent?.timestamp ?? relatedDecisions.at(-1)?.timestamp ?? null,
      lastUpdateLabel: latestEvent?.timestamp !== undefined ? formatSimTime(Number(latestEvent.timestamp)) : 'N/A',
      computeDisplay: round(Number(node.compute_capacity ?? 0), 4),
      iptDisplay: formatInt(node.IPT ?? 0),
      energyDisplay: round(Number(node.energy ?? 0), 4),
      transmittedBytes: transfer.taskBytes,
      transmittedLabel: formatBytes(transfer.taskBytes),
      eventPayloadLabel: formatBytes(transfer.eventPayloadBytes),
      protocolOverheadLabel: formatBytes(transfer.protocolOverheadBytes),
      decisionMetadataLabel: formatBytes(transfer.decisionMetadataBytes),
      totalTransferLabel: formatBytes(transfer.totalTransferBytes),
      taskCpuCycles: transfer.cpuCycles,
      taskCpuCyclesLabel: formatInt(transfer.cpuCycles),
      computeDemandRatio,
      computeDemandRatioLabel: `${round(Math.min(computeDemandRatio, 2) * 100, 2)}%`,
      payloadComponents: PAYLOAD_COMPONENTS.map(([key, label]) => ({
        key,
        label,
        bytes: transfer.payloadComponentBytes[key] ?? 0,
        value: formatBytes(transfer.payloadComponentBytes[key] ?? 0)
      })),
      computeStages: COMPUTE_STAGES.map(([key, label]) => ({
        key,
        label,
        cycles: transfer.computeStageCycles[key] ?? 0,
        value: formatInt(transfer.computeStageCycles[key] ?? 0)
      })),
      statusLabel: title(node.status || 'unknown')
    };
  });
}

function buildNodeTransferStats(decisions: any[], eventsById: Map<any, any>) {
  const totals = new Map<string, any>();
  decisions.forEach(decision => {
    const route = routeNodes(decision.route_path);
    const event = eventsById.get(decision.event_id) ?? {};
    const taskBytes = Math.max(0, Math.round(Number(decision.task_size_kb ?? event.task_size_kb ?? 0) * 1024));
    const eventPayloadBytes = Math.max(0, Math.round(Number(decision.event_payload_kb ?? event.event_payload_kb ?? 0) * 1024));
    const protocolOverheadBytes = Math.max(0, Math.round(Number(decision.protocol_security_overhead_kb ?? event.protocol_security_overhead_kb ?? 0) * 1024));
    const decisionMetadataBytes = Math.max(0, Math.round(Number(decision.decision_metadata_kb ?? event.decision_metadata_kb ?? 0) * 1024));
    const totalTransferBytes = Math.max(0, Math.round(Number(decision.total_transfer_kb ?? event.total_transfer_kb ?? decision.task_size_kb ?? event.task_size_kb ?? 0) * 1024));
    const cpuCycles = Math.max(0, Math.round(Number(decision.task_cpu_cycles ?? event.task_cpu_cycles ?? 0)));
    const payloadComponentBytes = payloadComponentByteValues(decision, event);
    const computeStageCycles = computeStageCycleValues(decision, event);
    new Set(route).forEach(nodeId => {
      const current = totals.get(nodeId) ?? emptyNodeTransfer();
      current.taskBytes += taskBytes;
      current.eventPayloadBytes += eventPayloadBytes;
      current.protocolOverheadBytes += protocolOverheadBytes;
      current.decisionMetadataBytes += decisionMetadataBytes;
      current.totalTransferBytes += totalTransferBytes;
      current.cpuCycles += cpuCycles;
      for (const [key] of PAYLOAD_COMPONENTS) current.payloadComponentBytes[key] += payloadComponentBytes[key] ?? 0;
      for (const [key] of COMPUTE_STAGES) current.computeStageCycles[key] += computeStageCycles[key] ?? 0;
      totals.set(nodeId, current);
    });
  });
  return totals;
}

function emptyNodeTransfer() {
  return {
    taskBytes: 0,
    eventPayloadBytes: 0,
    protocolOverheadBytes: 0,
    decisionMetadataBytes: 0,
    totalTransferBytes: 0,
    cpuCycles: 0,
    payloadComponentBytes: Object.fromEntries(PAYLOAD_COMPONENTS.map(([key]) => [key, 0])) as Record<string, number>,
    computeStageCycles: Object.fromEntries(COMPUTE_STAGES.map(([key]) => [key, 0])) as Record<string, number>
  };
}

function payloadComponentByteValues(decision: any, event: any) {
  return Object.fromEntries(PAYLOAD_COMPONENTS.map(([key]) => [
    key,
    Math.max(0, Math.round(Number(decision[key] ?? event[key] ?? 0) * 1024))
  ])) as Record<string, number>;
}

function computeStageCycleValues(decision: any, event: any) {
  return Object.fromEntries(COMPUTE_STAGES.map(([key]) => [
    key,
    Math.max(0, Math.round(Number(decision[key] ?? event[key] ?? 0)))
  ])) as Record<string, number>;
}

function transformEdgeNode(rawNode: any, rawTopology: any, decisionsBySourceEdge: Map<string, any[]>, sensorLinksByEdge: Map<string, any[]>) {
  const decisions = decisionsBySourceEdge.get(rawNode.node_id) ?? [];
  const cpu = average(decisions.map(item => Number(item.factor_compute_pressure ?? 0))) * 100 || (1 - Number(rawNode.compute_capacity ?? 0)) * 100;
  return {
    id: rawNode.node_id,
    type: 'edge',
    load: round(cpu, 1),
    connectedNodes: new Set((sensorLinksByEdge.get(rawNode.node_id) ?? []).map(link => link.source)).size,
    tasksProcessed: decisions.filter(item => item.selected_layer === 'edge').length,
    tasksForwardedEdge: decisions.filter(item => item.offloading_scenario === 'edge_to_edge').length,
    tasksForwardedFog: decisions.filter(item => item.offloading_scenario === 'edge_to_fog').length,
    ...topologyPosition(rawTopology, rawNode.node_id, 'edge')
  };
}

function transformFogNode(rawNode: any, rawTopology: any, decisions: any[]) {
  const toFog = decisions.filter(item => item.destination === rawNode.node_id || formatRoutePath(item.route_path).split(' -> ').includes(rawNode.node_id));
  return {
    id: rawNode.node_id,
    type: 'fog',
    tasksFromEdge: toFog.filter(item => item.offloading_scenario === 'edge_to_fog').length,
    fogToFogTransfers: toFog.filter(item => item.offloading_scenario === 'fog_to_fog').length,
    tasksToCloud: decisions.filter(item => item.offloading_scenario === 'cloud_escalation' && formatRoutePath(item.route_path).split(' -> ').includes(rawNode.node_id)).length,
    avgDelay: round(average(toFog.map(item => Number(item.estimated_delay ?? 0))), 2),
    congestion: round(average(toFog.map(item => Number(item.factor_network_condition ?? 0))) * 100, 1),
    ...topologyPosition(rawTopology, rawNode.node_id, 'fog')
  };
}

function transformCloudNode(rawNode: any, rawTopology: any, cloudRecords: any[], decisions: any[], kpis: any) {
  const totalEvents = Number(kpis.total_events ?? decisions.length) || 1;
  return {
    id: rawNode?.node_id || 'cloud_0000',
    type: 'cloud',
    status: rawNode?.status === 'active' ? 'connected' : rawNode?.status || 'connected',
    dataReceived: cloudRecords.length,
    historicalRecords: decisions.length,
    insightsToCloud: round((cloudRecords.length / Math.max(1, totalEvents)) * 100, 1),
    ...topologyPosition(rawTopology, rawNode?.node_id || 'cloud_0000', 'cloud')
  };
}

function topologyPosition(rawTopology: any, id: string, role: string) {
  const node = rawTopology?.nodes?.find((item: any) => item.id === id || item.node_id === id);
  if (!node) {
    const numericId = Number(String(id).match(/\d+$/)?.[0] ?? Math.abs(stableHash(id)));
    const width = role === 'cloud' ? 100 : role === 'fog' ? 74 : 56;
    const height = role === 'cloud' ? 32 : role === 'fog' ? 28 : 22;
    const columns = role === 'fog' ? 10 : 11;
    const col = numericId % columns;
    const row = Math.floor(numericId / columns);
    const xStart = role === 'fog' ? 168 : 155;
    const xGap = role === 'fog' ? 72 : 64;
    const yBase = role === 'fog' ? 172 : 315;
    const yGap = role === 'fog' ? 7 : 4;
    return {
      x: role === 'cloud' ? 430 : xStart + col * xGap,
      y: role === 'cloud' ? 50 : yBase + Math.min(row, 8) * yGap,
      w: width,
      h: height,
      fontSize: role === 'cloud' ? 9 : role === 'fog' ? 10 : 9
    };
  }
  const width = role === 'cloud' ? 100 : role === 'fog' ? 74 : 56;
  const height = role === 'cloud' ? 32 : role === 'fog' ? 28 : 22;
  const numericId = Number(String(id).match(/\d+$/)?.[0] ?? Math.abs(stableHash(id)));
  const columns = role === 'fog' ? 10 : 11;
  const col = numericId % columns;
  const row = Math.floor(numericId / columns);
  const columnX = role === 'cloud' ? 430 : (role === 'fog' ? 168 : 155) + col * (role === 'fog' ? 72 : 64);
  const rowY = role === 'cloud' ? 50 : (role === 'fog' ? 172 : 315) + Math.min(row, 8) * (role === 'fog' ? 7 : 4);
  return {
    x: Math.round(columnX),
    y: Math.round(rowY),
    w: width,
    h: height,
    fontSize: role === 'cloud' ? 9 : role === 'fog' ? 8 : 0
  };
}

function linkMetricFromApi(link: any, traffic: any | undefined, index: number) {
  const congestion = percentValue(firstDefined(link, ['congestion', 'congestion_score', 'network_condition', 'factor_network_condition']));
  const transmittedBytes = roundOrNull(firstDefined(link, ['bytes', 'transmitted_bytes', 'traffic_bytes', 'data_volume_bytes']), 0) ?? traffic?.bytes ?? 0;
  const reportedStatus = firstDefined(link, ['status', 'link_status']);
  const status = String(reportedStatus || ((congestion ?? traffic?.congestion ?? 0) >= 70 ? 'congested' : traffic?.taskCount ? 'active' : 'inactive')).toLowerCase().replace('idle', 'inactive');
  return {
    id: link.id || `${topologyLinkType(link)}-${String(index + 1).padStart(4, '0')}`,
    source: link.source,
    target: link.target,
    type: topologyLinkType(link),
    typeLabel: topologyTypeLabel(topologyLinkType(link)),
    latency: roundOrNull(firstDefined(link, ['latency', 'latency_ms', 'delay', 'estimated_delay', 'PR']), 3) ?? traffic?.latency ?? null,
    bandwidth: roundOrNull(firstDefined(link, ['bandwidth', 'bandwidth_mbps', 'capacity_mbps', 'BW']), 3),
    bandwidthCost: traffic?.bandwidthCost ?? null,
    bandwidthSource: link.bandwidth_source ?? (roundOrNull(firstDefined(link, ['bandwidth', 'bandwidth_mbps', 'capacity_mbps', 'BW']), 3) === null ? 'Not reported' : 'YAFS topology'),
    congestion: congestion ?? traffic?.congestion ?? null,
    packetLoss: percentValue(firstDefined(link, ['packetLoss', 'packet_loss', 'packet_loss_rate'])),
    bytes: transmittedBytes,
    bytesLabel: formatBytes(transmittedBytes),
    taskCount: traffic?.taskCount ?? 0,
    trafficInfo: traffic?.taskCount ? `${formatInt(traffic.taskCount)} routed tasks in the current sample` : 'No routed tasks recorded for this link in the current sample',
    status,
    statusLabel: title(status),
    statusSource: reportedStatus ? 'Reported by topology API' : traffic?.taskCount ? 'Derived from routed task traffic' : 'Topology link exists; inactive in current sample'
  };
}

function topologyLinkType(link: any) {
  return String(link?.type ?? link?.kind ?? 'unknown');
}

function isSensorEdgeLink(link: any) {
  const type = topologyLinkType(link);
  return type === 'sensor_to_edge' || type === 'sensor_edge' || String(link?.source ?? '').startsWith('sensor_') || String(link?.target ?? '').startsWith('sensor_');
}

function sensorEdgeEndpoint(link: any) {
  const source = String(link?.source ?? '');
  const target = String(link?.target ?? '');
  if (source.startsWith('edge_')) return source;
  if (target.startsWith('edge_')) return target;
  return target || source || 'unknown';
}

function buildLinkTrafficStats(decisions: any[], events: any[]) {
  const eventsById = new Map(events.map(event => [event.event_id, event]));
  const totals = new Map<string, any>();
  decisions.forEach(decision => {
    const route = routeNodes(decision.route_path);
    const event = eventsById.get(decision.event_id) ?? {};
    const taskSizeKb = Number(decision.task_size_kb ?? event.task_size_kb ?? 0);
    const bytes = Math.max(0, Math.round(taskSizeKb * 1024));
    for (let index = 0; index < route.length - 1; index += 1) {
      const key = physicalLinkKey(route[index], route[index + 1]);
      const current = totals.get(key) ?? { bytes: 0, taskCount: 0, latencyValues: [], congestionValues: [], bandwidthCostValues: [] };
      current.bytes += bytes;
      current.taskCount += 1;
      current.latencyValues.push(Number(decision.estimated_delay ?? 0));
      current.congestionValues.push(Number(decision.factor_network_condition ?? 0));
      current.bandwidthCostValues.push(Number(decision.factor_bandwidth_cost ?? 0));
      totals.set(key, current);
    }
  });
  totals.forEach((value, key) => {
    totals.set(key, {
      bytes: value.bytes,
      taskCount: value.taskCount,
      latency: round(average(value.latencyValues), 3),
      congestion: round(average(value.congestionValues) * 100, 2),
      bandwidthCost: round(average(value.bandwidthCostValues), 3)
    });
  });
  return totals;
}

function routeNodes(routePath: unknown) {
  const formatted = formatRoutePath(routePath);
  return formatted === 'N/A' ? [] : formatted.split(' -> ').filter(Boolean);
}

function physicalLinkKey(source: string, target: string) {
  return [source, target].sort().join('<->');
}

function topologyTypeLabel(type: string) {
  return title(String(type ?? 'unknown').replace(/_/g, ' '));
}

function filterTopologyLinks(links: any[], stateFilter: string, typeFilter: string) {
  return links.filter(link => {
    const stateMatch = stateFilter === 'all' || link.status === stateFilter || (stateFilter === 'active' && link.status === 'healthy');
    const typeMatch = typeFilter === 'all' || link.type === typeFilter;
    return stateMatch && typeMatch;
  });
}

function filterNodeDetails(nodes: any[], filters: { query: string; layer: string; zone: string; status: string; decision: string }) {
  const normalized = filters.query.trim().toLowerCase();
  return nodes.filter(node => {
    const queryMatch = !normalized || [
      node.node_id,
      node.zone,
      node.equipment,
      node.layer,
      node.status,
      node.edgeServer,
      node.decisionType
    ].some(value => String(value ?? '').toLowerCase().includes(normalized));
    const layerMatch = filters.layer === 'all' || node.layer === filters.layer;
    const zoneMatch = filters.zone === 'all' || node.zone === filters.zone;
    const statusMatch = filters.status === 'all' || node.status === filters.status;
    const decisionMatch = filters.decision === 'all' || node.decisionKey === filters.decision;
    return queryMatch && layerMatch && zoneMatch && statusMatch && decisionMatch;
  });
}

function buildCharts(snapshot: Snapshot | null) {
  const events = snapshot?.events ?? [];
  const decisions = snapshot?.decisions ?? [];
  const kpis = snapshot?.kpis ?? {};
  const buckets = bucketDecisions(decisions, events);
  const eventBuckets = bucketEvents(events);
  const pathCounts = { ...countBy(decisions, 'offloading_scenario'), ...(kpis.path_distribution ?? {}) };
  const severityCounts = kpis.severity_counts_3l ?? countBy(events, 'severity');
  const sensorStatus = latestSensorStatus(events);
  const policyModes = kpis.confirmed_10p?.drl_model_efficiency?.policy_modes ?? countBy(decisions, 'policy_mode');
  const anomalyDistribution = kpis.algorithm_metrics?.history_anomaly_distribution ?? kpis.confirmed_10p?.algorithm_metrics?.history_anomaly_distribution ?? countBy(events, 'history_anomaly_level');
  return {
    latencyEnergy: lineChart(buckets.map(item => item.label), [
      { label: 'Latency (ms)', data: buckets.map(item => item.latency), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.18)' },
      { label: 'Energy (J)', data: buckets.map(item => item.energy), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.18)' }
    ]),
    congestionLoad: lineChart(buckets.map(item => item.label), [
      { label: 'Congestion (%)', data: buckets.map(item => item.congestion), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.18)' },
      { label: 'Computational Load (%)', data: buckets.map(item => item.compute), borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,.18)' }
    ]),
    offloading: doughnutChart(Object.keys(PATH_LABELS).map(key => PATH_LABELS[key]), Object.keys(PATH_LABELS).map(key => Number(pathCounts[key] ?? 0)), ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'], true),
    sensorStatus: barChart(['Normal', 'Warning', 'Critical'], [sensorStatus.normal, sensorStatus.warning, sensorStatus.critical], ['#10b981', '#f59e0b', '#ef4444'], 'Sensors'),
    severity: barChart(['Normal', 'Warning', 'Critical'], [severityCounts.normal ?? 0, severityCounts.warning ?? 0, severityCounts.critical ?? 0], ['#10b981', '#f59e0b', '#ef4444'], 'Events'),
    policy: doughnutChart(Object.keys(policyModes).map(title), Object.values(policyModes).map(Number), ['#3b82f6', '#10b981', '#f59e0b']),
    anomalyTrend: lineChart(eventBuckets.map(item => item.label), [
      { label: 'Spike Score', data: eventBuckets.map(item => item.spike), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.16)' },
      { label: 'Trend Score', data: eventBuckets.map(item => item.trend), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,.16)' },
      { label: 'Anomaly Score', data: eventBuckets.map(item => item.anomaly), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.16)' }
    ]),
    anomalyRisk: barChart(['Low', 'Medium', 'High'], [anomalyDistribution.low ?? 0, anomalyDistribution.medium ?? 0, anomalyDistribution.high ?? 0], ['#10b981', '#f59e0b', '#ef4444'], 'Events'),
    dynamicResources: lineChart(buckets.map(item => item.label), [
      { label: 'Node Load After (%)', data: buckets.map(item => item.nodeLoadAfter), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,.16)' },
      { label: 'Link Load After (%)', data: buckets.map(item => item.linkLoadAfter), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.16)' }
    ])
  };
}

function buildTrends(decisions: any[], events: any[]) {
  const timestampById = new Map(events.map(event => [event.event_id, Number(event.timestamp ?? event.condition_triggered_at ?? 0)]));
  const rows = decisions.map(decision => ({ ...decision, timestamp: timestampById.get(decision.event_id) ?? 0 })).sort((a, b) => a.timestamp - b.timestamp);
  if (rows.length < 4) return stableTrends();
  const max = rows[rows.length - 1].timestamp;
  const window = Math.max(300, (max || 0) / 8);
  const current = rows.filter(row => row.timestamp > max - window);
  const previous = rows.filter(row => row.timestamp <= max - window && row.timestamp > max - window * 2);
  const currentEventIds = new Set(current.map(row => row.event_id));
  const previousEventIds = new Set(previous.map(row => row.event_id));
  const currentEvents = events.filter(event => currentEventIds.has(event.event_id));
  const previousEvents = events.filter(event => previousEventIds.has(event.event_id));
  return {
    totalEvents: trendDirection(current.length, previous.length, 1),
    latency: trendDirection(average(current.map(row => Number(row.estimated_delay ?? 0))), average(previous.map(row => Number(row.estimated_delay ?? 0))), 0.01),
    energy: trendDirection(average(current.map(row => Number(row.factor_energy_cost ?? 0))), average(previous.map(row => Number(row.factor_energy_cost ?? 0))), 0.005),
    congestion: trendDirection(average(current.map(row => Number(row.factor_network_condition ?? 0))), average(previous.map(row => Number(row.factor_network_condition ?? 0))), 0.005),
    compute: trendDirection(average(current.map(row => Number(row.factor_compute_pressure ?? 0))), average(previous.map(row => Number(row.factor_compute_pressure ?? 0))), 0.005),
    cloud: trendDirection(current.filter(row => row.offloading_scenario === 'cloud_escalation').length, previous.filter(row => row.offloading_scenario === 'cloud_escalation').length, 0),
    local: trendDirection(current.filter(row => row.offloading_scenario === 'local_edge').length, previous.filter(row => row.offloading_scenario === 'local_edge').length, 1),
    normal: trendDirection(currentEvents.filter(event => event.severity === 'normal').length, previousEvents.filter(event => event.severity === 'normal').length, 0),
    warning: trendDirection(currentEvents.filter(event => event.severity === 'warning').length, previousEvents.filter(event => event.severity === 'warning').length, 0),
    critical: trendDirection(currentEvents.filter(event => event.severity === 'critical').length, previousEvents.filter(event => event.severity === 'critical').length, 0)
  };
}

function stableTrends() {
  return { totalEvents: 'stable' as Trend, latency: 'stable' as Trend, energy: 'stable' as Trend, congestion: 'stable' as Trend, compute: 'stable' as Trend, cloud: 'stable' as Trend, local: 'stable' as Trend, normal: 'stable' as Trend, warning: 'stable' as Trend, critical: 'stable' as Trend };
}

function trendDirection(current: number, previous: number, tolerance = 0): Trend {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || (previous === 0 && current === 0)) return 'stable';
  const delta = current - previous;
  if (Math.abs(delta) <= tolerance) return 'stable';
  return delta > 0 ? 'increasing' : 'decreasing';
}

function bucketDecisions(decisions: any[], events: any[]) {
  const timestampById = new Map(events.map(event => [event.event_id, Number(event.timestamp ?? event.condition_triggered_at ?? 0)]));
  const rows = decisions.map(decision => ({ ...decision, timestamp: timestampById.get(decision.event_id) ?? 0 })).sort((a, b) => a.timestamp - b.timestamp);
  if (!rows.length) return [];
  const bucketCount = Math.min(18, Math.max(10, Math.ceil(rows.length / 650)));
  const min = rows[0].timestamp;
  const max = rows[rows.length - 1].timestamp;
  const span = Math.max(1, max - min);
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({ label: formatSimTime(min + (span * index / Math.max(1, bucketCount - 1))), rows: [] as any[] }));
  for (const row of rows) {
    const index = Math.min(bucketCount - 1, Math.floor(((row.timestamp - min) / span) * bucketCount));
    buckets[index].rows.push(row);
  }
  return buckets.map(bucket => ({
    label: bucket.label,
    latency: round(average(bucket.rows.map(row => Number(row.estimated_delay ?? 0))), 3),
    energy: round(average(bucket.rows.map(row => Number(row.factor_energy_cost ?? 0))), 3),
    congestion: round(average(bucket.rows.map(row => Number(row.factor_network_condition ?? 0))) * 100, 2),
    compute: round(average(bucket.rows.map(row => Number(row.factor_compute_pressure ?? 0))) * 100, 2),
    nodeLoadAfter: round(average(bucket.rows.map(row => Number(row.dynamic_node_load_after ?? row.factor_dynamic_node_load ?? 0))) * 100, 2),
    linkLoadAfter: round(average(bucket.rows.map(row => Number(row.dynamic_link_load_after ?? row.factor_dynamic_link_load ?? 0))) * 100, 2)
  }));
}

function bucketEvents(events: any[]) {
  const rows = events.map(event => ({ ...event, timestamp: Number(event.timestamp ?? event.condition_triggered_at ?? 0) })).sort((a, b) => a.timestamp - b.timestamp);
  if (!rows.length) return [];
  const bucketCount = Math.min(18, Math.max(10, Math.ceil(rows.length / 650)));
  const min = rows[0].timestamp;
  const max = rows[rows.length - 1].timestamp;
  const span = Math.max(1, max - min);
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({ label: formatSimTime(min + (span * index / Math.max(1, bucketCount - 1))), rows: [] as any[] }));
  for (const row of rows) {
    const index = Math.min(bucketCount - 1, Math.floor(((row.timestamp - min) / span) * bucketCount));
    buckets[index].rows.push(row);
  }
  return buckets.map(bucket => ({
    label: bucket.label,
    spike: round(average(bucket.rows.map(row => Number(row.feature_spike_score ?? 0))), 3),
    trend: round(average(bucket.rows.map(row => Number(row.feature_trend_score ?? 0))), 3),
    anomaly: round(average(bucket.rows.map(row => Number(row.history_anomaly_score ?? 0))), 3)
  }));
}

function latestSensorRows(events: any[]) {
  const latest = new Map<string, any>();
  for (const event of events) {
    const id = event.source_sensor ?? event.node_id;
    if (!id) continue;
    const current = latest.get(id);
    if (!current || Number(event.timestamp ?? 0) >= Number(current.timestamp ?? 0)) latest.set(id, event);
  }
  return [...latest.values()].map(event => ({
    node_id: event.source_sensor ?? event.node_id,
    sensor_type: event.sensor_type ?? event.dominant_sensor_type,
    severity: event.severity ?? event.event_level_3l ?? 'normal',
    timestamp: event.timestamp ?? 0,
    readings: SENSOR_FIELDS
      .map(([label, readingKey, statusKey, unit]) => ({ label, value: event[readingKey], status: event[statusKey], unit }))
      .filter(reading => reading.value !== undefined && reading.value !== null)
  })).sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
}

function visiblePlantNodes(plant: any, zoneFilter: string, statusFilter: string) {
  return plant.nodes.filter((node: any) => {
    if (zoneFilter !== 'all' && node.zone !== zoneFilter) return false;
    if (statusFilter !== 'all' && node.status !== statusFilter) return false;
    return true;
  });
}

function visiblePlantZones(plant: any, nodes: any[]) {
  return plant.zones.map((zone: any) => ({
    ...zone,
    count: nodes.filter(node => node.zone === zone.id).length
  }));
}

function normalizeSensorKey(value: unknown) {
  const normalized = String(value ?? '').toLowerCase().replace(/[\s-]/g, '_');
  if (normalized.includes('flow')) return 'flow_rate';
  if (normalized.includes('temp')) return 'temperature';
  if (normalized.includes('pressure')) return 'pressure';
  if (normalized.includes('current')) return 'current';
  if (normalized.includes('acoustic')) return 'acoustic';
  if (normalized.includes('humidity')) return 'humidity';
  return 'vibration';
}

function groupByMap<T>(items: T[], keyGetter: (item: T) => string) {
  return items.reduce((map, item) => {
    const key = keyGetter(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
    return map;
  }, new Map<string, T[]>());
}

function formatRoutePath(path: unknown) {
  if (Array.isArray(path)) return path.join(' -> ');
  if (!path) return 'N/A';
  return String(path).replace(/[\[\]'"]/g, '').split(',').map(part => part.trim()).filter(Boolean).join(' -> ');
}

function shortEdge(value: unknown) {
  return String(value || 'N/A').replace('edge_', 'E');
}

function stableHash(input: unknown) {
  return String(input).split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function firstDefined(source: any, keys: string[]) {
  return keys.map(key => source?.[key]).find(value => value !== undefined && value !== null && value !== '');
}

function roundOrNull(value: unknown, places = 2) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? round(parsed, places) : null;
}

function percentValue(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return round(parsed <= 1 ? parsed * 100 : parsed, 2);
}

function latestSensorStatus(events: any[]) {
  const latest = latestSensorRows(events);
  return {
    normal: latest.filter(value => value.severity === 'normal').length,
    warning: latest.filter(value => value.severity === 'warning').length,
    critical: latest.filter(value => value.severity === 'critical').length
  };
}

function lineChart(labels: string[], datasets: any[]) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(dataset => ({
        ...dataset,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 14,
        pointHoverBorderWidth: 3,
        pointHoverBackgroundColor: '#15152b',
        pointHoverBorderColor: dataset.borderColor,
        tension: .35,
        fill: true
      }))
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      hover: { mode: 'index', intersect: false },
      elements: { point: { radius: 0, hoverRadius: 5, hitRadius: 14 } }
    }
  };
}

function doughnutChart(labels: string[], data: number[], colors: string[], highlightSmall = false) {
  const displayData = highlightSmall ? data.map(value => value > 0 && value < 180 ? 180 : value) : data;
  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: displayData, rawValues: data, backgroundColor: colors, borderColor: 'var(--yafs-panel)', borderWidth: 2, offset: 0, spacing: 2 }]
    },
    options: {
      cutout: '58%',
      plugins: {
        legend: { display: !highlightSmall },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const raw = context.dataset.rawValues?.[context.dataIndex] ?? context.parsed;
              return `${context.label}: ${raw} decisions`;
            }
          }
        }
      }
    }
  };
}

function barChart(labels: string[], data: number[], colors: string[], label: string) {
  return {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: colors, borderRadius: 8 }] },
    options: { plugins: { legend: { display: false } } }
  };
}

function countBy(rows: any[], key: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = row[key] ?? 'unknown';
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function average(values: number[]) {
  const valid = values.filter(value => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function factorStatus(avg: number) {
  if (avg > 0.75) return 'critical';
  if (avg > 0.4) return 'warning';
  return 'normal';
}

function percentFromRatioOrCount(ratio: unknown, count: unknown, total: number) {
  const ratioValue = Number(ratio);
  if (Number.isFinite(ratioValue) && ratioValue > 0) return round(ratioValue * 100, 1);
  const countValue = Number(count);
  return Number.isFinite(countValue) && total > 0 ? round((countValue / total) * 100, 1) : 0;
}

function title(value: unknown) {
  return String(value ?? '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function round(value: number, places = 2) {
  return Number(Number(value ?? 0).toFixed(places));
}

function formatInt(value: unknown) {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

function formatBytes(value: unknown) {
  const bytes = Number(value ?? 0);
  if (bytes < 1024) {
    return `${formatInt(bytes)} bytes`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(size)} ${units[unitIndex]}`;
}

function formatSimTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600).toString().padStart(2, '0');
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `T+${h}:${m}:${s}`;
}
