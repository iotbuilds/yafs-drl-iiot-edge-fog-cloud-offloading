import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { getTopology } from '../services/yafsApi';
import { useDashboard } from '../components/layout/DashboardLayout';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import StatusBadge from '../components/shared/StatusBadge';
import { useYafsRealtime } from '@/hooks/useYafsRealtime';

export default function Topology() {
  const { selectNode } = useDashboard();
  const { data: topology, loading } = useYafsRealtime(getTopology, null);
  const [zoom, setZoom] = useState(0.85);
  const [selectedLink, setSelectedLink] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  if (loading || !topology) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  const { edges, fogs, cloud, links } = topology;

  // Layout positions
  const edgePositions = edges.map((e, i) => ({
    ...e,
    x: e.topologyX ?? 80 + i * 90,
    y: e.topologyY ?? 300,
    w: e.topologyWidth ?? 70,
    h: e.topologyHeight ?? 28,
    fontSize: e.topologyFontSize ?? 9,
  }));
  const fogPositions = fogs.map((f, i) => ({
    ...f,
    x: f.topologyX ?? 200 + i * 200,
    y: f.topologyY ?? 170,
    w: f.topologyWidth ?? 80,
    h: f.topologyHeight ?? 32,
    fontSize: f.topologyFontSize ?? 10,
  }));
  const cloudPos = {
    ...cloud,
    x: cloud.topologyX ?? 480,
    y: cloud.topologyY ?? 50,
    w: cloud.topologyWidth ?? 100,
    h: cloud.topologyHeight ?? 32,
  };

  const getNodePos = (id) => {
    const e = edgePositions.find(n => n.id === id);
    if (e) return { x: e.x + e.w / 2, y: e.y + e.h / 2 };
    const f = fogPositions.find(n => n.id === id);
    if (f) return { x: f.x + f.w / 2, y: f.y + f.h / 2 };
    if (id === cloud.id) return { x: cloudPos.x + cloudPos.w / 2, y: cloudPos.y + cloudPos.h / 2 };
    return { x: 0, y: 0 };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">YAFS Network Topology</h1>
          <p className="text-sm text-muted-foreground">
            {topology.edgeCount} edge • {topology.fogCount} fog • 1 cloud • {topology.linkCount} links
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setZoom(z => Math.max(z - 0.1, 0.4))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-auto">
          <svg
            width="100%"
            height={500 * zoom}
            viewBox="0 0 960 500"
            preserveAspectRatio="xMidYMid meet"
            className="bg-background"
          >
            {/* Links */}
            {links.map(link => {
              const src = getNodePos(link.source);
              const tgt = getNodePos(link.target);
              const isCongested = link.status === 'congested';
              return (
                <g key={link.id} onClick={() => setSelectedLink(link)} className="cursor-pointer">
                  <line
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={isCongested ? '#EF4444' : '#3B82F640'}
                    strokeWidth={isCongested ? 2.5 : 1.5}
                    strokeDasharray={isCongested ? "6 3" : "none"}
                  />
                  {/* Animated dot along link */}
                  <circle r={2.5} fill={isCongested ? '#EF4444' : '#3B82F6'}>
                    <animateMotion
                      dur={`${2 + Math.random() * 3}s`}
                      repeatCount="indefinite"
                      path={`M${src.x},${src.y} L${tgt.x},${tgt.y}`}
                    />
                  </circle>
                </g>
              );
            })}

            {/* IIoT Sensor nodes cluster (bottom) */}
            <g>
              <rect x={30} y={400} width={900} height={70} rx={10} fill="hsl(var(--muted))" opacity={0.3} />
              <text x={40} y={420} fontSize={10} fill="hsl(var(--muted-foreground))" fontWeight={600}>
                {topology.sensorCount} IIoT Sensor Nodes
              </text>
              {Array.from({ length: 50 }).map((_, i) => (
                <circle key={i} cx={50 + i * 17} cy={450} r={3} fill="#10B981" opacity={0.5} />
              ))}
              {/* Lines from sensor cluster to edge */}
              {edgePositions.slice(0, 25).map(e => (
                <line key={`s-${e.id}`} x1={e.x + e.w / 2} y1={400} x2={e.x + e.w / 2} y2={e.y + e.h}
                  stroke="#3B82F620" strokeWidth={1} strokeDasharray="4 4" />
              ))}
            </g>

            {/* Edge servers */}
            {edgePositions.map(e => (
              <g key={e.id}
                onClick={() => selectNode(e.id)}
                onMouseEnter={() => setHoveredNode(e.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                <rect
                  x={e.x} y={e.y} width={e.w} height={e.h} rx={e.w < 20 ? 3 : 8}
                  fill={hoveredNode === e.id ? '#3B82F630' : '#3B82F618'}
                  stroke="#3B82F660" strokeWidth={1.5}
                />
                {e.fontSize > 0 && (
                  <text x={e.x + 8} y={e.y + 18} fontSize={e.fontSize} fill="#3B82F6" fontWeight={600}>
                    {e.id}
                  </text>
                )}
              </g>
            ))}

            {/* Fog servers */}
            {fogPositions.map(f => (
              <g key={f.id} className="cursor-pointer"
                onMouseEnter={() => setHoveredNode(f.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <rect
                  x={f.x} y={f.y} width={f.w} height={f.h} rx={f.w < 24 ? 3 : 8}
                  fill={hoveredNode === f.id ? '#8B5CF630' : '#8B5CF618'}
                  stroke="#8B5CF660" strokeWidth={1.5}
                />
                {f.fontSize > 0 && (
                  <text x={f.x + 12} y={f.y + 20} fontSize={f.fontSize} fill="#8B5CF6" fontWeight={600}>
                    {f.id}
                  </text>
                )}
              </g>
            ))}

            {/* Cloud */}
            <g className="cursor-pointer">
              <rect
                x={cloudPos.x} y={cloudPos.y} width={cloudPos.w} height={cloudPos.h} rx={10}
                fill="#6B728018" stroke="#6B728060" strokeWidth={1.5}
              />
              <text x={cloudPos.x + 9} y={cloudPos.y + 18} fontSize={9} fill="#6B7280" fontWeight={700}>
                {cloud.id}
              </text>
            </g>

            {/* Layer labels */}
            <text x={10} y={318} fontSize={10} fill="hsl(var(--muted-foreground))" fontWeight={600} opacity={0.5}>EDGE LAYER</text>
            <text x={10} y={188} fontSize={10} fill="hsl(var(--muted-foreground))" fontWeight={600} opacity={0.5}>FOG LAYER</text>
            <text x={10} y={68} fontSize={10} fill="hsl(var(--muted-foreground))" fontWeight={600} opacity={0.5}>CLOUD LAYER</text>
          </svg>
        </CardContent>
      </Card>

      {/* Link detail sheet */}
      <Sheet open={!!selectedLink} onOpenChange={() => setSelectedLink(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selectedLink && (
            <>
              <SheetHeader>
                <SheetTitle>Link Details</SheetTitle>
                <SheetDescription className="sr-only">Network link information</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <DetailRow label="Source" value={selectedLink.source} />
                <DetailRow label="Destination" value={selectedLink.target} />
                <DetailRow label="Latency" value={formatMetric(selectedLink.latency, 'ms')} />
                <DetailRow label="Bandwidth" value={formatMetric(selectedLink.bandwidth, 'Mbps')} />
                <DetailRow label="Congestion" value={formatMetric(selectedLink.congestion, '%')} />
                <DetailRow label="Packet Loss" value={formatMetric(selectedLink.packetLoss, '%')} />
                <DetailRow label="Transmitted" value={formatMetric(selectedLink.bytes, 'bytes')} />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusBadge status={selectedLink.status} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono font-medium">{value}</span>
    </div>
  );
}

function formatMetric(value, suffix) {
  if (value === null || value === undefined) return 'N/A';
  return suffix === '%' ? `${value}%` : `${value} ${suffix}`;
}
