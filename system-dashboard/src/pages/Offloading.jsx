import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getOffloadingLogs, getTimeSeriesMetrics } from '../services/yafsApi';
import { useDashboard } from '../components/layout/DashboardLayout';
import { format } from 'date-fns';
import { useYafsRealtime } from '@/hooks/useYafsRealtime';
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const DECISION_COLORS = {
  'Local Processing': '#10B981',
  'Edge-to-Edge': '#3B82F6',
  'Edge-to-Fog': '#06B6D4',
  'Fog-to-Fog': '#8B5CF6',
  'Edge-to-Cloud': '#F59E0B',
  'Fog-to-Cloud': '#EF4444',
};

export default function Offloading() {
  const { selectNode } = useDashboard();
  const { data } = useYafsRealtime(
    () => Promise.all([getOffloadingLogs(), getTimeSeriesMetrics()]),
    [[], []]
  );
  const [logs, timeSeries] = data;
  const [page, setPage] = useState(0);
  const perPage = 15;

  // Distribution pie
  const distMap = {};
  logs.forEach(l => { distMap[l.decisionType] = (distMap[l.decisionType] || 0) + 1; });
  const pieData = Object.entries(distMap).map(([name, value]) => ({ name, value }));

  // Latency/energy comparison
  const comparisonData = Object.keys(DECISION_COLORS).map(type => {
    const items = logs.filter(l => l.decisionType === type);
    if (items.length === 0) return null;
    return {
      name: type.replace('Processing', 'Proc.'),
      avgLatency: +(items.reduce((s, l) => s + l.latency, 0) / items.length).toFixed(1),
      avgEnergy: +(items.reduce((s, l) => s + l.energy, 0) / items.length).toFixed(1),
    };
  }).filter(Boolean);

  const paged = logs.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Offloading Decisions</h1>
        <p className="text-sm text-muted-foreground">DRL task offloading decision analysis — {logs.length} decisions logged</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Decision Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((d, i) => <Cell key={i} fill={DECISION_COLORS[d.name] || '#6B7280'} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Latency/Energy comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Avg Latency & Energy by Decision</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={comparisonData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="avgLatency" fill="#3B82F6" name="Latency (ms)" radius={[3,3,0,0]} />
                <Bar dataKey="avgEnergy" fill="#F59E0B" name="Energy (J)" radius={[3,3,0,0]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* DRL Reward trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">DRL Reward Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="drlReward" stroke="#10B981" strokeWidth={2} dot={false} name="Reward" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Decision log table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Offloading Decisions</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {['Task', 'Source', 'Destination', 'Type', 'Trigger', 'Latency', 'Energy', 'Reward', 'Confidence', 'Time'].map(h => (
                  <th key={h} className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(log => (
                <tr key={log.taskId} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => selectNode(log.source)}>
                  <td className="p-3 font-mono text-xs">{log.taskId}</td>
                  <td className="p-3 font-mono text-xs text-primary">{log.source}</td>
                  <td className="p-3 font-mono text-xs">{log.destination}</td>
                  <td className="p-3 text-xs">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: (DECISION_COLORS[log.decisionType] || '#6B7280') + '20', color: DECISION_COLORS[log.decisionType] }}>
                      {log.decisionType}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{log.triggeringFactor}</td>
                  <td className="p-3 font-mono text-xs">{log.latency}ms</td>
                  <td className="p-3 font-mono text-xs">{log.energy}J</td>
                  <td className="p-3 font-mono text-xs">{log.reward}</td>
                  <td className="p-3 font-mono text-xs">{log.confidence}%</td>
                  <td className="p-3 text-xs text-muted-foreground">{format(new Date(log.timestamp), 'HH:mm:ss')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Page {page + 1} of {Math.ceil(logs.length / perPage)}</p>
        <div className="flex gap-1">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs rounded-md bg-secondary disabled:opacity-40">Prev</button>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * perPage >= logs.length} className="px-3 py-1.5 text-xs rounded-md bg-secondary disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
