import React from 'react';
import KpiCard from '../shared/KpiCard';
import {
  Server, AlertTriangle, AlertOctagon, CheckCircle, Cloud,
  Timer, Zap, Wifi, GitBranch, Cpu, ArrowUpRight
} from 'lucide-react';

export default function OverviewKpis({ kpis }) {
  if (!kpis) return null;

  const cards = [
    { title: 'Total IIoT Nodes', value: kpis.totalNodes, icon: Server, color: 'bg-blue-500/10', trend: 'stable', tooltip: 'Total sensor nodes deployed across the industrial plant' },
    { title: 'Active Nodes', value: kpis.activeNodes, icon: CheckCircle, color: 'bg-emerald-500/10', trend: 'up', tooltip: 'Nodes operating within normal parameters' },
    { title: 'Warning Nodes', value: kpis.warningNodes, icon: AlertTriangle, color: 'bg-amber-500/10', trend: 'down', tooltip: 'Nodes with sensor readings approaching thresholds' },
    { title: 'Critical Nodes', value: kpis.criticalNodes, icon: AlertOctagon, color: 'bg-red-500/10', trend: 'down', tooltip: 'Nodes with readings exceeding critical thresholds' },
    { title: 'Edge Servers', value: kpis.edgeServers, icon: Cpu, color: 'bg-blue-500/10', trend: 'stable', tooltip: 'Active edge computing servers' },
    { title: 'Fog Servers', value: kpis.fogServers, icon: Cloud, color: 'bg-purple-500/10', trend: 'stable', tooltip: 'Active fog computing servers' },
    { title: 'Avg Latency', value: kpis.avgLatency, suffix: 'ms', icon: Timer, color: 'bg-cyan-500/10', trend: 'down', tooltip: 'Average task processing latency across all nodes' },
    { title: 'Avg Energy', value: kpis.avgEnergy, suffix: 'J', icon: Zap, color: 'bg-yellow-500/10', trend: 'down', tooltip: 'Average energy consumption per task' },
    { title: 'Avg Congestion', value: kpis.avgCongestion, suffix: '%', icon: Wifi, color: 'bg-orange-500/10', trend: 'down', tooltip: 'Average network congestion level' },
    { title: 'Tasks Offloaded', value: kpis.totalOffloaded, icon: GitBranch, color: 'bg-indigo-500/10', trend: 'up', tooltip: 'Total DRL offloading decisions made' },
    { title: 'Local Processing', value: kpis.localPct, suffix: '%', icon: Server, color: 'bg-emerald-500/10', trend: 'stable', tooltip: 'Tasks processed locally at source node' },
    { title: 'Cloud Offload', value: kpis.cloudPct, suffix: '%', icon: ArrowUpRight, color: 'bg-gray-500/10', trend: 'stable', tooltip: 'Tasks offloaded to cloud (Edge→Cloud + Fog→Cloud)' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {cards.map((card, i) => (
        <KpiCard key={i} {...card} />
      ))}
    </div>
  );
}
