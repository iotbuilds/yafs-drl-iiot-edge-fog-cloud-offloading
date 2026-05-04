import React, { useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, MapPin, RadioTower, Route, Timer, Cloud } from 'lucide-react';
import { getNodes, getEdgeServers } from '../services/yafsApi';
import { FACTOR_THRESHOLDS, PLANT_ZONES, SENSOR_THRESHOLDS } from '../data/constants';
import StatusBadge from '../components/shared/StatusBadge';
import { useYafsRealtime } from '@/hooks/useYafsRealtime';

const STATUS_COLORS_HEX = {
  normal: '#10B981',
  warning: '#F59E0B',
  critical: '#EF4444',
  unknown: '#64748B',
};

const ZONE_POSITIONS = {
  zone_1: { x: 40, y: 95, w: 150, h: 245 },
  zone_2: { x: 220, y: 95, w: 150, h: 245 },
  zone_3: { x: 400, y: 95, w: 150, h: 245 },
  zone_4: { x: 580, y: 95, w: 150, h: 245 },
  zone_5: { x: 760, y: 95, w: 150, h: 245 },
  zone_6: { x: 40, y: 410, w: 150, h: 245 },
  zone_7: { x: 220, y: 410, w: 150, h: 245 },
  zone_8: { x: 400, y: 410, w: 150, h: 245 },
  zone_9: { x: 580, y: 410, w: 150, h: 245 },
  zone_10: { x: 760, y: 410, w: 150, h: 245 },
};

const MAX_NODES_PER_ZONE = 54;

export default function PlantView() {
  const { data } = useYafsRealtime(
    () => Promise.all([getNodes(), getEdgeServers()]),
    [[], []]
  );
  const [nodes, edges] = data;
  const [zoom, setZoom] = useState(0.7);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const containerRef = useRef(null);

  const filteredNodes = nodes.filter(node => {
    if (zoneFilter !== 'all' && node.zone !== zoneFilter) return false;
    if (statusFilter !== 'all' && node.status !== statusFilter) return false;
    return true;
  });

  const { positionedNodes, zoneGroups } = useMemo(
    () => buildPlantLayout(filteredNodes),
    [filteredNodes]
  );
  const selectedNode = selectedNodeId ? nodes.find(node => node.id === selectedNodeId) : null;

  const toggleFullscreen = () => {
    if (!fullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setFullscreen(!fullscreen);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interactive Plant View</h1>
          <p className="text-sm text-muted-foreground">
            {positionedNodes.length} of {filteredNodes.length} sensor nodes shown - grouped by YAFS zone and edge gateway
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-32 h-9 text-xs">
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {PLANT_ZONES.map(zone => (
                <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-28 h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setZoom(value => Math.min(value + 0.1, 1.5))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setZoom(value => Math.max(value - 0.1, 0.3))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <Card ref={containerRef} className="overflow-hidden">
        <CardContent className="p-0 overflow-auto" style={{ maxHeight: fullscreen ? '100vh' : '70vh' }}>
          <svg
            width="100%"
            height={800 * zoom}
            viewBox="0 0 960 800"
            preserveAspectRatio="xMidYMid meet"
            className="bg-background"
          >
            {PLANT_ZONES.map(zone => {
              const pos = ZONE_POSITIONS[zone.id];
              const groups = zoneGroups.get(zone.id) || [];
              const zoneCount = filteredNodes.filter(node => node.zone === zone.id).length;
              return (
                <g key={zone.id}>
                  <rect
                    x={pos.x} y={pos.y} width={pos.w} height={pos.h}
                    rx={12} fill={zone.color + '10'} stroke={zone.color + '40'}
                    strokeWidth={1.5} strokeDasharray="6 3"
                  />
                  <text x={pos.x + 12} y={pos.y + 22} fontSize={12} fontWeight={600} fill={zone.color}>
                    {zone.name}
                  </text>
                  <text x={pos.x + pos.w - 12} y={pos.y + 22} fontSize={9} textAnchor="end" fill="hsl(var(--muted-foreground))">
                    {zoneCount}
                  </text>
                  {groups.slice(0, 4).map(group => (
                    <text
                      key={`${zone.id}-${group.edge}`}
                      x={group.labelX}
                      y={pos.y + pos.h - 12}
                      fontSize={7}
                      textAnchor="middle"
                      fill="hsl(var(--muted-foreground))"
                      opacity={0.75}
                    >
                      {shortEdge(group.edge)}
                    </text>
                  ))}
                </g>
              );
            })}

            {positionedNodes.map(node => {
              const color = STATUS_COLORS_HEX[node.status] || STATUS_COLORS_HEX.unknown;
              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                >
                  <SensorMarker node={node} color={color} />
                  {hoveredNode?.id === node.id && <NodeTooltip node={node} color={color} />}
                </g>
              );
            })}

            {edges.slice(0, 20).map((edge, index) => (
              <g key={edge.id}>
                <rect
                  x={35 + (index % 20) * 44} y={20} width={36} height={22}
                  rx={6} fill="#3B82F620" stroke="#3B82F660" strokeWidth={1}
                />
                <text x={39 + (index % 20) * 44} y={35} fontSize={7} fill="#3B82F6" fontWeight={600}>
                  {shortEdge(edge.id)}
                </text>
              </g>
            ))}

            <g transform="translate(20, 760)">
              {[
                { label: 'Normal', color: '#10B981' },
                { label: 'Warning', color: '#F59E0B' },
                { label: 'Critical', color: '#EF4444' },
                { label: 'Edge gateway', color: '#3B82F6' },
              ].map((item, index) => (
                <g key={item.label} transform={`translate(${index * 112}, 0)`}>
                  <circle cx={6} cy={6} r={4} fill={item.color} />
                  <text x={14} y={10} fontSize={10} fill="hsl(var(--muted-foreground))">{item.label}</text>
                </g>
              ))}
            </g>
          </svg>
        </CardContent>
      </Card>

      <PlantNodeSheet
        node={selectedNode}
        open={!!selectedNode}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}

function buildPlantLayout(nodes) {
  const positionedNodes = [];
  const zoneGroups = new Map();

  PLANT_ZONES.forEach(zone => {
    const pos = ZONE_POSITIONS[zone.id];
    const zoneNodes = nodes
      .filter(node => node.zone === zone.id)
      .sort((a, b) => `${a.edgeServer}-${sensorKey(a)}-${a.id}`.localeCompare(`${b.edgeServer}-${sensorKey(b)}-${b.id}`));
    const visible = zoneNodes.slice(0, MAX_NODES_PER_ZONE);
    const grouped = groupBy(visible, node => node.edgeServer || 'unassigned');
    const groups = Array.from(grouped.entries()).map(([edge, groupNodes]) => ({ edge, nodes: groupNodes }));
    const segmentWidth = (pos.w - 28) / Math.max(1, groups.length);
    const groupLabels = [];

    groups.forEach((group, groupIndex) => {
      const cols = Math.max(1, Math.ceil(Math.sqrt(group.nodes.length)));
      const rows = Math.max(1, Math.ceil(group.nodes.length / cols));
      const groupX = pos.x + 14 + groupIndex * segmentWidth;
      const groupW = segmentWidth;
      const top = pos.y + 52;
      const height = pos.h - 86;
      groupLabels.push({ edge: group.edge, labelX: groupX + groupW / 2 });

      group.nodes.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const xStep = groupW / (cols + 1);
        const yStep = height / (rows + 1);
        positionedNodes.push({
          ...node,
          mapX: Math.round(groupX + xStep * (col + 1)),
          mapY: Math.round(top + yStep * (row + 1)),
          sensorKey: sensorKey(node),
        });
      });
    });

    zoneGroups.set(zone.id, groupLabels);
  });

  return { positionedNodes, zoneGroups };
}

function SensorMarker({ node, color }) {
  const x = node.mapX;
  const y = node.mapY;
  const key = node.sensorKey || sensorKey(node);

  if (key === 'temperature') {
    return <rect x={x - 4} y={y - 4} width={8} height={8} rx={2} fill={color} opacity={0.9} />;
  }
  if (key === 'pressure') {
    return <rect x={x - 4} y={y - 4} width={8} height={8} transform={`rotate(45 ${x} ${y})`} fill={color} opacity={0.9} />;
  }
  if (key === 'current') {
    return <polygon points={`${x},${y - 5} ${x + 5},${y + 4} ${x - 5},${y + 4}`} fill={color} opacity={0.9} />;
  }
  if (key === 'acoustic') {
    return <polygon points={`${x - 5},${y} ${x - 2},${y - 5} ${x + 3},${y - 5} ${x + 5},${y} ${x + 2},${y + 5} ${x - 3},${y + 5}`} fill={color} opacity={0.9} />;
  }
  if (key === 'flowRate') {
    return <ellipse cx={x} cy={y} rx={5} ry={3.5} fill={color} opacity={0.9} />;
  }
  if (key === 'humidity') {
    return <path d={`M ${x} ${y - 6} C ${x + 5} ${y - 1}, ${x + 4} ${y + 5}, ${x} ${y + 5} C ${x - 4} ${y + 5}, ${x - 5} ${y - 1}, ${x} ${y - 6} Z`} fill={color} opacity={0.9} />;
  }
  return <circle cx={x} cy={y} r={4} fill={color} opacity={0.9} />;
}

function NodeTooltip({ node, color }) {
  const reading = primaryReading(node);
  return (
    <g>
      <circle cx={node.mapX} cy={node.mapY} r={9} fill="none" stroke={color} strokeWidth={2} opacity={0.65} />
      <rect
        x={node.mapX + 10} y={node.mapY - 40}
        width={160} height={58} rx={6}
        fill="hsl(222, 28%, 12%)" stroke="hsl(222, 20%, 20%)" strokeWidth={1}
      />
      <text x={node.mapX + 16} y={node.mapY - 23} fontSize={10} fill="#fff" fontWeight={600}>
        {node.id}
      </text>
      <text x={node.mapX + 16} y={node.mapY - 9} fontSize={9} fill="#94A3B8">
        {reading.label}: {reading.display}
      </text>
      <text x={node.mapX + 16} y={node.mapY + 5} fontSize={9} fill="#94A3B8">
        Latest route: {node.decision.type}
      </text>
    </g>
  );
}

function PlantNodeSheet({ node, open, onClose }) {
  if (!node) return null;

  const event = node.raw?.event || {};
  const reading = primaryReading(node);
  const topFactors = dominantFactors(node);
  const routePath = formatRoute(event.route_path);
  const transmission = node.cloudTransmission;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg">{node.id}</SheetTitle>
          <SheetDescription>
            Latest YAFS event from this plant sensor node.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <InfoItem icon={MapPin} label="Zone" value={zoneName(node.zone)} />
          <InfoItem icon={RadioTower} label="Sensor Type" value={reading.label} />
          <InfoItem icon={RadioTower} label="Edge Gateway" value={node.edgeServer || 'N/A'} />
          <InfoItem icon={Timer} label="Last Update" value={formatTime(node.lastUpdate)} />
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Latest Reading</span>
            <StatusBadge status={reading.status || node.status || 'unknown'} />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono">{reading.display}</p>
            <p className="text-xs text-muted-foreground">{event.event_id || 'No event id received from YAFS'}</p>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">Latest Offloading Event</h4>
          </div>
          <DetailRow label="Path selected" value={<Badge variant="secondary" className="text-xs">{node.decision.type || 'N/A'}</Badge>} />
          <DetailRow label="Cloud transmission" value={<Badge variant="outline" className="text-xs gap-1"><Cloud className="w-3 h-3" />{transmission?.intervalLabel || 'N/A'}</Badge>} />
          <DetailRow label="Destination" value={event.destination || 'N/A'} />
          <DetailRow label="Route path" value={routePath} />
          <DetailRow label="Deadline met" value={formatBoolean(event.deadline_met)} />
          <DetailRow label="Delay" value={formatMetric(event.estimated_delay, 'ms')} />
          <p className="text-xs text-muted-foreground italic">"{node.decision.reason}"</p>
          {transmission?.detail && <p className="text-xs text-muted-foreground">{transmission.detail}</p>}
        </div>

        <div className="mt-4 rounded-xl border border-border/60 p-4">
          <h4 className="text-sm font-semibold mb-3">Dominant 7F Drivers</h4>
          <div className="space-y-2">
            {topFactors.length ? topFactors.map(item => (
              <div key={item.key} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-sm">{item.label}</span>
                <span className="text-xs font-mono">{formatMetric(item.value, item.unit)}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No 7F factors received for the latest YAFS event.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-medium">{value}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-right">{value}</span>
    </div>
  );
}

function groupBy(items, keyGetter) {
  return items.reduce((map, item) => {
    const key = keyGetter(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function sensorKey(node) {
  const raw = node.raw || {};
  const value = raw.event?.dominant_sensor_type || raw.event?.sensor_type || raw.node?.sensor_type || node.equipment;
  const normalized = String(value || '').toLowerCase().replace(/[\s-]/g, '_');
  if (normalized.includes('flow')) return 'flowRate';
  if (normalized.includes('temp')) return 'temperature';
  if (normalized.includes('vibration')) return 'vibration';
  if (normalized.includes('pressure')) return 'pressure';
  if (normalized.includes('current')) return 'current';
  if (normalized.includes('acoustic')) return 'acoustic';
  if (normalized.includes('humidity')) return 'humidity';
  return 'vibration';
}

function primaryReading(node) {
  const key = sensorKey(node);
  const threshold = SENSOR_THRESHOLDS[key];
  const sensor = node.sensors?.[key];
  const event = node.raw?.event || {};
  const eventValue = event.reading_value;
  const value = sensor?.value ?? eventValue;
  const unit = threshold?.unit || event.unit || '';

  return {
    key,
    label: threshold?.label || node.equipment || 'Sensor',
    value,
    status: sensor?.status || event.severity || node.status,
    display: value === null || value === undefined ? 'N/A' : `${value}${unit}`,
  };
}

function dominantFactors(node) {
  return Object.entries(node.factors || {})
    .filter(([, factor]) => factor?.value !== null && factor?.value !== undefined)
    .map(([key, factor]) => {
      const threshold = FACTOR_THRESHOLDS[key] || {};
      const divisor = threshold.warningMax || threshold.normalMax || 1;
      return {
        key,
        label: threshold.label || key,
        unit: threshold.unit || '',
        value: factor.value,
        score: Number(factor.value) / divisor,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function zoneName(id) {
  return PLANT_ZONES.find(zone => zone.id === id)?.name || id || 'N/A';
}

function shortEdge(value) {
  return String(value || 'N/A').replace('edge_', 'E');
}

function formatMetric(value, suffix = '') {
  return value === null || value === undefined || value === '' ? 'N/A' : `${value}${suffix}`;
}

function formatBoolean(value) {
  if (value === true || value === 'true') return 'Yes';
  if (value === false || value === 'false') return 'No';
  return 'N/A';
}

function formatRoute(path) {
  if (Array.isArray(path)) return path.join(' -> ');
  if (!path) return 'N/A';
  return String(path).replace(/[\[\]'"]/g, '').split(',').map(part => part.trim()).filter(Boolean).join(' -> ');
}

function formatTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
