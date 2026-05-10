/**
 * Live YAFS API service layer.
 *
 * The React dashboard keeps its current UI contract, while this file adapts the
 * confirmed YAFS local-cloud API outputs into the shape the screens already use.
 */

import { FACTOR_THRESHOLDS, PLANT_ZONES, SENSOR_THRESHOLDS } from '../data/constants';

const viteMeta = /** @type {any} */ (import.meta);
const API_BASE_URL = (viteMeta.env?.VITE_YAFS_API_BASE_URL || '').replace(/\/$/, '');
export const REALTIME_REFRESH_MS = Number(viteMeta.env?.VITE_YAFS_REFRESH_MS) || 5000;

const SENSOR_FIELDS = {
  vibration: ['reading_vibration', 'status_vibration'],
  temperature: ['reading_temperature', 'status_temperature'],
  pressure: ['reading_pressure', 'status_pressure'],
  current: ['reading_current', 'status_current'],
  acoustic: ['reading_acoustic', 'status_acoustic'],
  flowRate: ['reading_flow_rate', 'status_flow_rate'],
  humidity: ['reading_humidity', 'status_humidity'],
};

const PATH_TO_DECISION = {
  local_edge: 'Local Processing',
  edge_to_edge: 'Edge-to-Edge',
  edge_to_fog: 'Edge-to-Fog',
  fog_to_fog: 'Fog-to-Fog',
  cloud_escalation: 'Edge-to-Cloud',
};

const CLOUD_POLICY_BY_STATUS = {
  critical: {
    label: 'Critical cloud update',
    intervalLabel: 'Every 1 minute',
    intervalSeconds: 60,
    detail: 'Critical readings are transmitted to cloud once per node per 1-minute window.',
  },
  warning: {
    label: 'Warning cloud update',
    intervalLabel: 'Every 3 minutes',
    intervalSeconds: 180,
    detail: 'Warnings are transmitted to cloud once per node per 3-minute window; repeated_warning stays a warning flag.',
  },
  normal: {
    label: 'Normal edge summary',
    intervalLabel: 'Every 5 minutes',
    intervalSeconds: 300,
    detail: 'Normal readings remain aggregated at edge; cloud receives one normal summary per node per 5-minute window.',
  },
};

const KPI_TREND_WINDOW_SECONDS = 300;
const SIMULATION_REPLAY_SPEED = Number(viteMeta.env?.VITE_YAFS_SIM_REPLAY_SPEED) || 60;

let snapshotPromise = null;
let snapshotLoadedAt = 0;
let simulationReplayStartedAt = Date.now();

function buildUrl(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query.set(key, String(value));
  });

  const relative = `${path}${query.toString() ? `?${query}` : ''}`;
  return API_BASE_URL ? `${API_BASE_URL}${relative}` : relative;
}

async function requestJson(path, params) {
  const response = await fetch(buildUrl(path, params), { cache: 'no-store' });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`YAFS API ${response.status}: ${path}${detail ? ` - ${detail}` : ''}`);
  }
  return response.json();
}

function asItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rounded(value, digits = 2) {
  return Number(number(value).toFixed(digits));
}

function roundedOrNull(value, digits = 2) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(digits)) : null;
}

function pct(value, digits = 1) {
  return rounded(number(value) * 100, digits);
}

function pctOrNull(value, digits = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return rounded(parsed <= 1 ? parsed * 100 : parsed, digits);
}

function stableHash(input) {
  return String(input).split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function toTitle(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function simTimestampToDate(timestamp, maxTimestamp) {
  const offsetSeconds = Math.max(0, number(maxTimestamp) - number(timestamp));
  return new Date(Date.now() - offsetSeconds * 1000).toISOString();
}

function currentSimulationTimestamp(maxTimestamp) {
  const elapsedRealSeconds = Math.max(0, (Date.now() - simulationReplayStartedAt) / 1000);
  const current = elapsedRealSeconds * SIMULATION_REPLAY_SPEED;
  if (current > maxTimestamp) {
    simulationReplayStartedAt = Date.now();
    return maxTimestamp;
  }
  return current;
}

function formatSimulationTime(seconds) {
  const total = Math.max(0, Math.round(number(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `T+${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getThresholdStatus(thresholds, value) {
  if (!thresholds) return 'normal';
  const numeric = number(value);
  if (thresholds.warningMin !== undefined && numeric < thresholds.warningMin) return 'critical';
  if (thresholds.warningMax !== undefined && numeric > thresholds.warningMax) return 'critical';
  if (thresholds.normalMin !== undefined && numeric < thresholds.normalMin) return 'warning';
  if (thresholds.normalMax !== undefined && numeric > thresholds.normalMax) return 'warning';
  return 'normal';
}

function latestEventsBySensor(events) {
  const bySensor = new Map();
  events.forEach(event => {
    const id = event.node_id || event.source_sensor;
    const current = bySensor.get(id);
    if (!current || number(event.timestamp) >= number(current.timestamp)) {
      bySensor.set(id, event);
    }
  });
  return bySensor;
}

function groupBy(items, keyGetter) {
  return items.reduce((map, item) => {
    const key = keyGetter(item);
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function average(items, getter, fallback = 0) {
  if (!items.length) return fallback;
  return items.reduce((sum, item) => sum + number(getter(item)), 0) / items.length;
}

function trendDirection(current, previous, tolerance = 0) {
  const currentValue = number(current, NaN);
  const previousValue = number(previous, NaN);
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return 'stable';
  const delta = currentValue - previousValue;
  if (Math.abs(delta) <= tolerance) return 'stable';
  return delta > 0 ? 'up' : 'down';
}

function eventsInWindow(events, start, end) {
  return events.filter(event => {
    const timestamp = number(event.timestamp);
    return timestamp > start && timestamp <= end;
  });
}

function statusCountsAsOf(events, asOfTimestamp) {
  const latestByNode = new Map();
  events.forEach(event => {
    const timestamp = number(event.timestamp);
    const nodeId = event.node_id || event.source_sensor;
    if (!nodeId || timestamp > asOfTimestamp) return;
    const current = latestByNode.get(nodeId);
    if (!current || timestamp >= number(current.timestamp)) {
      latestByNode.set(nodeId, event);
    }
  });

  return Array.from(latestByNode.values()).reduce((counts, event) => {
    const status = event.event_level_3l || event.severity || 'unknown';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { normal: 0, warning: 0, critical: 0 });
}

function pathRatio(events, path) {
  if (!events.length) return 0;
  return events.filter(event => event.offloading_scenario === path).length / events.length;
}

function parseRoutePath(path) {
  if (Array.isArray(path)) return path;
  if (!path) return [];
  return String(path)
    .replace(/[\[\]'"]/g, '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function firstDefined(source, keys) {
  return keys.map(key => source?.[key]).find(value => value !== undefined && value !== null && value !== '');
}

function plantZoneBounds(zoneId) {
  const index = Math.max(0, PLANT_ZONES.findIndex(zone => zone.id === zoneId));
  const col = index % 5;
  const row = Math.floor(index / 5);
  return { x: 40 + col * 180, y: 95 + row * 315, w: 150, h: 245 };
}

function plantPosition(nodeId, zoneId) {
  const bounds = plantZoneBounds(zoneId);
  const hash = Math.abs(stableHash(nodeId));
  const rx = (hash % 1000) / 1000;
  const ry = (Math.floor(hash / 1000) % 1000) / 1000;
  return {
    posX: Math.round(bounds.x + 18 + rx * (bounds.w - 36)),
    posY: Math.round(bounds.y + 38 + ry * (bounds.h - 58)),
  };
}

function plantPositionFromApi(rawNode, event, zoneId) {
  const apiX = firstDefined(rawNode, ['posX', 'pos_x', 'plant_x', 'x']);
  const apiY = firstDefined(rawNode, ['posY', 'pos_y', 'plant_y', 'y']);
  const eventX = firstDefined(event, ['posX', 'pos_x', 'plant_x', 'x']);
  const eventY = firstDefined(event, ['posY', 'pos_y', 'plant_y', 'y']);
  const x = roundedOrNull(apiX ?? eventX, 0);
  const y = roundedOrNull(apiY ?? eventY, 0);
  return x !== null && y !== null
    ? { posX: x, posY: y, positionSource: 'api' }
    : { ...plantPosition(rawNode.node_id, zoneId), positionSource: 'derived' };
}

function topologyPosition(rawTopology, id, role) {
  const node = rawTopology?.nodes?.find(item => item.id === id);
  if (!node) return {};
  const width = role === 'cloud' ? 76 : role === 'fog' ? 20 : 14;
  const height = role === 'cloud' ? 28 : role === 'fog' ? 12 : 9;
  return {
    topologyX: Math.round(20 + number(node.x) * 900 - width / 2),
    topologyY: Math.round(38 + number(node.y) * 410 - height / 2),
    topologyWidth: width,
    topologyHeight: height,
    topologyFontSize: role === 'cloud' ? 9 : 0,
  };
}

function factor(value, key, weight = 1) {
  const thresholds = FACTOR_THRESHOLDS[key];
  const numeric = roundedOrNull(value, key === 'priority' || key === 'hopCount' ? 0 : 2);
  return {
    value: numeric,
    status: numeric === null ? 'unknown' : getThresholdStatus(thresholds, numeric),
    weight,
  };
}

function sensorsFromEvent(event) {
  return Object.fromEntries(
    Object.entries(SENSOR_FIELDS).map(([key, [readingField, statusField]]) => {
      const value = roundedOrNull(event?.[readingField], key === 'flowRate' ? 1 : 3);
      return [
        key,
        {
          value,
          status: event?.[statusField] || (value === null ? 'unknown' : getThresholdStatus(SENSOR_THRESHOLDS[key], value)),
        },
      ];
    })
  );
}

function factorsFromEvent(event) {
  const route = parseRoutePath(event?.route_path);
  const hopCount = route.length ? Math.max(0, route.length - 1) : event?.factor_hop_count;
  return {
    latency: factor(event?.estimated_delay, 'latency', 0.2),
    energy: factor(event?.factor_energy_cost, 'energy', 0.15),
    congestion: factor(pctOrNull(event?.factor_network_condition), 'congestion', 0.2),
    cpu: factor(pctOrNull(event?.factor_compute_pressure), 'cpu', 0.15),
    memory: factor(pctOrNull(event?.factor_bandwidth_cost), 'memory', 0.1),
    priority: factor(event?.task_size_kb, 'priority', 0.1),
    hopCount: factor(hopCount, 'hopCount', 0.1),
  };
}

function decisionFromEvent(event) {
  if (!event) {
    return {
      type: 'N/A',
      reason: 'No YAFS decision event received for this node',
      confidence: null,
      reward: null,
      qValue: null,
    };
  }

  const decisionType = PATH_TO_DECISION[event.offloading_scenario] || toTitle(event.offloading_scenario) || 'N/A';
  return {
    type: decisionType,
    reason: event.decision_reason || event.failure_congestion_reason || 'YAFS DQN decision output',
    confidence: event.score === undefined || event.score === null
      ? null
      : rounded(Math.max(0, Math.min(99.9, (1 - number(event.score, 0.1)) * 100)), 1),
    reward: roundedOrNull(event.reward, 3),
    qValue: roundedOrNull(event.q_value, 3),
  };
}

function cloudPolicyFromStatus(status) {
  return CLOUD_POLICY_BY_STATUS[status] || CLOUD_POLICY_BY_STATUS.normal;
}

function nodeFromSensor(rawNode, event, maxTimestamp) {
  const zone = rawNode.zone || 'zone_1';
  const position = plantPositionFromApi(rawNode, event, zone);
  const status = event?.event_level_3l || event?.severity || 'normal';
  return {
    id: rawNode.node_id,
    type: 'sensor',
    zone,
    equipment: `${toTitle(rawNode.sensor_type || event?.sensor_type || 'iiot')} Sensor`,
    status,
    edgeServer: event?.edge_gateway || event?.source_edge || 'unassigned',
    ...position,
    sensors: sensorsFromEvent(event),
    factors: factorsFromEvent(event),
    decision: decisionFromEvent(event),
    cloudTransmission: cloudPolicyFromStatus(status),
    lastUpdate: event?.timestamp === undefined || event?.timestamp === null ? null : simTimestampToDate(event.timestamp, maxTimestamp),
    raw: { node: rawNode, event },
  };
}

function layerNodeDetails(rawNode, layer) {
  const emptySensors = Object.fromEntries(
    Object.keys(SENSOR_THRESHOLDS).map(key => [key, { value: null, status: 'unknown' }])
  );
  const emptyFactors = Object.fromEntries(
    Object.keys(FACTOR_THRESHOLDS).map(key => [key, { value: null, status: 'unknown', weight: null }])
  );
  return {
    id: rawNode.node_id,
    type: layer,
    zone: rawNode.zone || layer,
    equipment: toTitle(rawNode.node_type || layer),
    status: rawNode.status === 'active' ? 'normal' : rawNode.status || 'normal',
    edgeServer: rawNode.node_id,
    posX: null,
    posY: null,
    sensors: emptySensors,
    factors: emptyFactors,
    decision: {
      type: layer === 'cloud' ? 'Cloud Analytics' : `${toTitle(layer)} Processing`,
      reason: rawNode.role || 'YAFS infrastructure node',
      confidence: null,
      reward: null,
      qValue: null,
    },
    lastUpdate: rawNode.last_update || rawNode.updated_at || null,
    raw: { node: rawNode },
  };
}

function logFromDecision(decision, eventById, maxTimestamp) {
  const event = eventById.get(decision.event_id) || {};
  const decisionType = PATH_TO_DECISION[decision.offloading_scenario] || toTitle(decision.offloading_scenario);
  return {
    taskId: decision.event_id,
    source: decision.source_sensor || event.node_id,
    destination: decision.destination || event.destination,
    decisionType,
    triggeringFactor: toTitle((decision.decision_reason || '').split('dominant 7F factor=')[1] || event.sensor_type || 'YAFS'),
    latency: rounded(decision.estimated_delay, 3),
    energy: rounded(decision.factor_energy_cost, 3),
    congestion: rounded(number(decision.factor_network_condition) * 100, 1),
    reward: rounded(decision.reward, 3),
    confidence: rounded(Math.max(0, Math.min(99.9, (1 - number(decision.score, 0.1)) * 100)), 1),
    timestamp: simTimestampToDate(event.timestamp, maxTimestamp),
    raw: { decision, event },
  };
}

function linkMetricFromApi(link) {
  const congestion = pctOrNull(firstDefined(link, [
    'congestion',
    'congestion_score',
    'network_condition',
    'factor_network_condition',
  ]));
  const status = link.status || (congestion === null ? 'unknown' : congestion >= 70 ? 'congested' : 'healthy');

  return {
    id: link.id || `${link.type}-${link.source}-${link.target}`,
    source: link.source,
    target: link.target,
    latency: roundedOrNull(firstDefined(link, ['latency', 'latency_ms', 'delay', 'estimated_delay']), 3),
    bandwidth: roundedOrNull(firstDefined(link, ['bandwidth', 'bandwidth_mbps', 'capacity_mbps']), 1),
    congestion,
    packetLoss: pctOrNull(firstDefined(link, ['packetLoss', 'packet_loss', 'packet_loss_rate']), 2),
    bytes: roundedOrNull(firstDefined(link, ['bytes', 'transmitted_bytes', 'traffic_bytes', 'data_volume_bytes']), 0),
    status: String(status).toLowerCase(),
    raw: link,
  };
}

function transformEdge(rawNode, rawTopology, decisionsBySourceEdge, sensorLinksByEdge) {
  const decisions = decisionsBySourceEdge.get(rawNode.node_id) || [];
  const cpu = average(decisions, item => item.factor_compute_pressure * 100, (1 - number(rawNode.compute_capacity)) * 100);
  return {
    id: rawNode.node_id,
    type: 'edge',
    load: rounded(cpu, 1),
    connectedNodes: new Set((sensorLinksByEdge.get(rawNode.node_id) || []).map(link => link.source)).size,
    tasksProcessed: decisions.filter(item => item.selected_layer === 'edge').length,
    tasksForwardedEdge: decisions.filter(item => item.offloading_scenario === 'edge_to_edge').length,
    tasksForwardedFog: decisions.filter(item => item.offloading_scenario === 'edge_to_fog').length,
    energySaved: rounded((1 - average(decisions, item => item.factor_energy_cost, 0.2)) * 100, 1),
    cpu: rounded(cpu, 1),
    memory: rounded(average(decisions, item => item.factor_bandwidth_cost * 100, number(rawNode.energy) * 100), 1),
    ...topologyPosition(rawTopology, rawNode.node_id, 'edge'),
    raw: rawNode,
  };
}

function transformFog(rawNode, rawTopology, decisions) {
  const toFog = decisions.filter(item => item.destination === rawNode.node_id || parseRoutePath(item.route_path).includes(rawNode.node_id));
  return {
    id: rawNode.node_id,
    type: 'fog',
    load: rounded(average(toFog, item => item.factor_compute_pressure * 100, (1 - number(rawNode.compute_capacity)) * 100), 1),
    tasksFromEdge: toFog.filter(item => item.offloading_scenario === 'edge_to_fog').length,
    fogToFogTransfers: toFog.filter(item => item.offloading_scenario === 'fog_to_fog').length,
    tasksToCloud: decisions.filter(item => item.offloading_scenario === 'cloud_escalation' && parseRoutePath(item.route_path).includes(rawNode.node_id)).length,
    avgDelay: rounded(average(toFog, item => item.estimated_delay, 0), 2),
    congestion: rounded(average(toFog, item => item.factor_network_condition * 100, 0), 1),
    cpu: rounded(number(rawNode.compute_capacity) * 100, 1),
    memory: rounded(number(rawNode.energy) * 100, 1),
    ...topologyPosition(rawTopology, rawNode.node_id, 'fog'),
    raw: rawNode,
  };
}

function transformCloud(rawNode, rawTopology, cloudRecords, decisions, kpis) {
  const totalEvents = number(kpis.total_events, decisions.length);
  const criticalUpdates = cloudRecords.filter(record => record.type === 'critical_update').length;
  const warningUpdates = cloudRecords.filter(record => record.type === 'warning_update').length;
  const normalSummaries = cloudRecords.filter(record => record.type === 'normal_summary').length;
  const repeatedWarningFlags = cloudRecords.filter(record => record.severity === 'warning' && record.repeated_warning).length;
  return {
    id: rawNode?.node_id || 'cloud_0000',
    type: 'cloud',
    status: rawNode?.status === 'active' ? 'connected' : rawNode?.status || 'connected',
    dataReceived: cloudRecords.length,
    historicalRecords: decisions.length,
    anomaliesReported: criticalUpdates + warningUpdates,
    rawAtEdge: pct(kpis.path_distribution?.local_edge / totalEvents || kpis.confirmed_10p?.offloading_ratio_path_distribution?.local_edge || 0),
    insightsToCloud: pct(cloudRecords.length / Math.max(1, totalEvents)),
    criticalAlerts: criticalUpdates,
    criticalUpdates,
    warningUpdates,
    normalSummaries,
    periodicSummary: normalSummaries,
    repeatedWarningFlags,
    transmissionPolicy: {
      critical: CLOUD_POLICY_BY_STATUS.critical,
      warning: CLOUD_POLICY_BY_STATUS.warning,
      normal: CLOUD_POLICY_BY_STATUS.normal,
    },
    ...topologyPosition(rawTopology, rawNode?.node_id || 'cloud_0000', 'cloud'),
    raw: rawNode,
  };
}

function transformTopology(rawTopology, edges, fogs, cloud) {
  const infrastructureLinks = (rawTopology.links || []).filter(link => link.type !== 'sensor_to_edge');
  const maxLinks = 500;
  const step = Math.max(1, Math.ceil(infrastructureLinks.length / maxLinks));
  const links = infrastructureLinks.filter((_, index) => index % step === 0).map(linkMetricFromApi);

  return {
    edges,
    fogs,
    cloud,
    links,
    edgeCount: rawTopology.confirmed_distribution?.edge || edges.length,
    fogCount: rawTopology.confirmed_distribution?.fog || fogs.length,
    sensorCount: rawTopology.confirmed_distribution?.sensor || 0,
    linkCount: rawTopology.links?.length || links.length,
  };
}

function transformKpiTrends(events, maxTimestamp) {
  const currentEnd = number(maxTimestamp);
  const previousEnd = Math.max(0, currentEnd - KPI_TREND_WINDOW_SECONDS);
  const previousStart = Math.max(0, previousEnd - KPI_TREND_WINDOW_SECONDS);
  const currentWindow = eventsInWindow(events, previousEnd, currentEnd);
  const previousWindow = eventsInWindow(events, previousStart, previousEnd);
  const currentStatus = statusCountsAsOf(events, currentEnd);
  const previousStatus = statusCountsAsOf(events, previousEnd);

  return {
    activeNodes: trendDirection(currentStatus.normal, previousStatus.normal),
    warningNodes: trendDirection(currentStatus.warning, previousStatus.warning),
    criticalNodes: trendDirection(currentStatus.critical, previousStatus.critical),
    avgLatency: trendDirection(
      average(currentWindow, event => event.estimated_delay, 0),
      average(previousWindow, event => event.estimated_delay, 0),
      0.01
    ),
    avgEnergy: trendDirection(
      average(currentWindow, event => event.factor_energy_cost, 0),
      average(previousWindow, event => event.factor_energy_cost, 0),
      0.001
    ),
    avgCongestion: trendDirection(
      average(currentWindow, event => event.factor_network_condition * 100, 0),
      average(previousWindow, event => event.factor_network_condition * 100, 0),
      0.1
    ),
    totalOffloaded: trendDirection(currentWindow.length, previousWindow.length),
    localPct: trendDirection(pathRatio(currentWindow, 'local_edge'), pathRatio(previousWindow, 'local_edge'), 0.001),
    cloudPct: trendDirection(pathRatio(currentWindow, 'cloud_escalation'), pathRatio(previousWindow, 'cloud_escalation'), 0.001),
  };
}

function transformKpis(kpis, nodes, rawNodes, decisions, cloud, trends = {}) {
  const pathRatios = kpis.confirmed_10p?.offloading_ratio_path_distribution || {};
  return {
    totalNodes: kpis.confirmed_distribution?.total || rawNodes.length || 1000,
    activeNodes: nodes.filter(node => node.status === 'normal').length,
    warningNodes: nodes.filter(node => node.status === 'warning').length,
    criticalNodes: nodes.filter(node => node.status === 'critical').length,
    edgeServers: rawNodes.filter(node => node.layer === 'edge').length,
    fogServers: rawNodes.filter(node => node.layer === 'fog').length,
    cloudStatus: cloud.status,
    avgLatency: rounded(kpis.confirmed_10p?.latency, 3),
    avgEnergy: rounded(kpis.confirmed_10p?.energy_consumption, 3),
    avgCongestion: pct(kpis.confirmed_10p?.congestion_score || kpis.avg_congestion_score || 0, 2),
    totalOffloaded: kpis.total_events || decisions.length,
    localPct: pct(pathRatios.local_edge),
    edgeToEdgePct: pct(pathRatios.edge_to_edge),
    edgeToFogPct: pct(pathRatios.edge_to_fog),
    fogToFogPct: pct(pathRatios.fog_to_fog),
    cloudPct: pct(pathRatios.cloud_escalation),
    trends,
  };
}

function cloudRecordTimestamp(record) {
  return number(
    firstDefined(record, ['window_start', 'condition_triggered_at', 'timestamp', 'cloud_sent_at']),
    0
  );
}

function transformTimeSeries(events, maxTimestamp, cloudRecords = [], visibleMaxTimestamp = maxTimestamp) {
  const bucketCount = 24;
  const max = Math.max(1, number(maxTimestamp));
  const bucketSize = Math.max(1, Math.ceil(max / bucketCount));
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    events: [],
    cloudRecords: [],
  }));

  events.forEach(event => {
    if (number(event.timestamp) > visibleMaxTimestamp) return;
    const index = Math.min(bucketCount - 1, Math.floor(number(event.timestamp) / bucketSize));
    buckets[index].events.push(event);
  });

  cloudRecords.forEach(record => {
    const timestamp = cloudRecordTimestamp(record);
    if (timestamp > visibleMaxTimestamp) return;
    const index = Math.min(bucketCount - 1, Math.floor(timestamp / bucketSize));
    buckets[index].cloudRecords.push(record);
  });

  const visibleBucketCount = Math.max(1, Math.min(bucketCount, Math.floor(number(visibleMaxTimestamp) / bucketSize) + 1));

  return buckets.slice(0, visibleBucketCount).map(bucket => {
    const items = bucket.events;
    const simulationTime = bucket.index * bucketSize;
    return {
      time: simulationTime,
      label: formatSimulationTime(simulationTime),
      avgLatency: rounded(average(items, item => item.estimated_delay, 0), 3),
      avgEnergy: rounded(average(items, item => item.factor_energy_cost, 0), 3),
      avgCongestion: rounded(average(items, item => item.factor_network_condition * 100, 0), 1),
      avgCPU: rounded(average(items, item => item.factor_compute_pressure * 100, 0), 1),
      avgMemory: rounded(average(items, item => item.factor_bandwidth_cost * 100, 0), 1),
      tasksProcessed: items.length,
      cloudDataVolume: bucket.cloudRecords.length,
      drlReward: rounded(average(items, item => item.reward, 0), 3),
    };
  });
}

async function loadSnapshot() {
  const [kpis, topology, nodesPayload, eventsPayload, decisionsPayload, cloudPayload, report] = await Promise.all([
    requestJson('/api/kpis'),
    requestJson('/api/topology'),
    requestJson('/api/nodes', { limit: 1000 }),
    requestJson('/api/events', { limit: 10000 }),
    requestJson('/api/decisions', { limit: 10000 }),
    requestJson('/api/cloud-records', { limit: 10000 }),
    requestJson('/api/report'),
  ]);

  const rawNodes = asItems(nodesPayload);
  const events = asItems(eventsPayload);
  const decisions = asItems(decisionsPayload);
  const cloudRecords = asItems(cloudPayload);
  const maxTimestamp = Math.max(...events.map(event => number(event.timestamp)), 0);
  const visibleMaxTimestamp = currentSimulationTimestamp(maxTimestamp);
  const eventById = new Map(events.map(event => [event.event_id, event]));
  const latestBySensor = latestEventsBySensor(events);
  const sensorNodes = rawNodes
    .filter(node => node.layer === 'sensor')
    .map(node => nodeFromSensor(node, latestBySensor.get(node.node_id), maxTimestamp));

  const decisionsBySourceEdge = groupBy(decisions, decision => decision.source_edge);
  const sensorLinksByEdge = groupBy((topology.links || []).filter(link => link.type === 'sensor_to_edge'), link => link.target);
  const edges = rawNodes
    .filter(node => node.layer === 'edge')
    .map(node => transformEdge(node, topology, decisionsBySourceEdge, sensorLinksByEdge));
  const fogs = rawNodes
    .filter(node => node.layer === 'fog')
    .map(node => transformFog(node, topology, decisions));
  const cloud = transformCloud(rawNodes.find(node => node.layer === 'cloud'), topology, cloudRecords, decisions, kpis);
  const logs = decisions
    .map(decision => logFromDecision(decision, eventById, maxTimestamp))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const transformedTopology = transformTopology(topology, edges, fogs, cloud);
  const trends = transformKpiTrends(events, maxTimestamp);
  const summary = transformKpis(kpis, sensorNodes, rawNodes, decisions, cloud, trends);
  const timeSeries = transformTimeSeries(events, maxTimestamp, cloudRecords, visibleMaxTimestamp);

  return {
    raw: { kpis, topology, nodes: rawNodes, events, decisions, cloudRecords, report },
    nodes: sensorNodes,
    allLayerNodes: rawNodes,
    edges,
    fogs,
    cloud,
    topology: transformedTopology,
    logs,
    kpis: summary,
    timeSeries,
    report,
  };
}

async function getSnapshot() {
  const now = Date.now();
  if (snapshotPromise && now - snapshotLoadedAt < 1000) return snapshotPromise;
  snapshotLoadedAt = now;
  snapshotPromise = loadSnapshot().catch(error => {
    snapshotPromise = null;
    throw error;
  });
  return snapshotPromise;
}

export function subscribeToYafsData(loader, onData, onError, intervalMs = REALTIME_REFRESH_MS) {
  let cancelled = false;
  let sequence = 0;

  const refresh = async () => {
    const current = ++sequence;
    try {
      const data = await loader();
      if (!cancelled && current === sequence) onData(data);
    } catch (error) {
      if (!cancelled) onError?.(error);
    }
  };

  refresh();
  const interval = globalThis.setInterval(refresh, intervalMs);
  return () => {
    cancelled = true;
    globalThis.clearInterval(interval);
  };
}

export async function getNodes() {
  return (await getSnapshot()).nodes;
}

export async function getNodeById(id) {
  const snapshot = await getSnapshot();
  const sensorNode = snapshot.nodes.find(node => node.id === id);
  if (sensorNode) return sensorNode;
  const rawNode = snapshot.allLayerNodes.find(node => node.node_id === id);
  return rawNode ? layerNodeDetails(rawNode, rawNode.layer) : null;
}

export async function getSensorReadings() {
  const nodes = await getNodes();
  return nodes.map(node => ({ nodeId: node.id, zone: node.zone, equipment: node.equipment, status: node.status, ...node.sensors }));
}

export async function getDecisionFactors() {
  const nodes = await getNodes();
  return nodes.map(node => ({ nodeId: node.id, zone: node.zone, decision: node.decision.type, ...node.factors }));
}

export async function getOffloadingLogs() {
  return (await getSnapshot()).logs;
}

export async function getEdgeServers() {
  return (await getSnapshot()).edges;
}

export async function getFogServers() {
  return (await getSnapshot()).fogs;
}

export async function getCloud() {
  return (await getSnapshot()).cloud;
}

export async function getTopology() {
  return (await getSnapshot()).topology;
}

export async function getKpiSummary() {
  return (await getSnapshot()).kpis;
}

export async function getTimeSeriesMetrics() {
  return (await getSnapshot()).timeSeries;
}

export async function getReportData() {
  const snapshot = await getSnapshot();
  const criticalNodes = snapshot.nodes.filter(node => node.status === 'critical').slice(0, 20);
  const congestedLinks = snapshot.topology.links.filter(link => link.status === 'congested');
  return {
    kpis: snapshot.kpis,
    criticalNodes,
    congestedLinks,
    logs: snapshot.logs.slice(0, 50),
    timeSeries: snapshot.timeSeries,
    cloud: snapshot.cloud,
    report: snapshot.report,
  };
}

export function clearCache() {
  snapshotPromise = null;
  snapshotLoadedAt = 0;
}
