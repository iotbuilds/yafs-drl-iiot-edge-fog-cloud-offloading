import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getNodes } from '../services/yafsApi';
import { FACTOR_THRESHOLDS } from '../data/constants';
import { useDashboard } from '../components/layout/DashboardLayout';
import { useYafsRealtime } from '@/hooks/useYafsRealtime';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';

const FACTOR_KEYS = Object.keys(FACTOR_THRESHOLDS);
const COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Factors7F() {
  const { selectNode } = useDashboard();
  const { data: nodes } = useYafsRealtime(getNodes, []);
  const [selectedId, setSelectedId] = useState('');
  const [compareId, setCompareId] = useState('');
  const [sortBy, setSortBy] = useState('latency');
  const [page, setPage] = useState(0);
  const perPage = 20;

  useEffect(() => {
    if (!selectedId && nodes.length > 0) setSelectedId(nodes[0].id);
  }, [nodes, selectedId]);

  const sorted = [...nodes].sort((a, b) => (b.factors[sortBy].value ?? -Infinity) - (a.factors[sortBy].value ?? -Infinity));
  const paged = sorted.slice(page * perPage, (page + 1) * perPage);

  const selectedNode = nodes.find(n => n.id === selectedId);
  const compareNode = nodes.find(n => n.id === compareId);

  const radarData = FACTOR_KEYS.map(key => {
    const t = FACTOR_THRESHOLDS[key];
    const maxVal = t.warningMax * 1.5 || 10;
    const entry = { factor: t.label.split(' ')[0] };
    if (selectedNode && selectedNode.factors[key].value !== null) entry.selected = (selectedNode.factors[key].value / maxVal) * 100;
    if (compareNode && compareNode.factors[key].value !== null) entry.compare = (compareNode.factors[key].value / maxVal) * 100;
    return entry;
  });

  // Average factor bar chart
  const avgData = FACTOR_KEYS.map((key, i) => ({
    name: FACTOR_THRESHOLDS[key].label.split(' ')[0],
    value: averageFactor(nodes, key),
    fill: COLORS[i],
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">7F Decision Factors</h1>
        <p className="text-sm text-muted-foreground">Seven factors driving DRL offloading decisions</p>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <CardTitle className="text-sm font-semibold">Factor Radar</CardTitle>
              <div className="flex gap-2 ml-auto">
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Node" /></SelectTrigger>
                  <SelectContent>
                    {nodes.slice(0, 50).map(n => <SelectItem key={n.id} value={n.id}>{n.id}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={compareId} onValueChange={setCompareId}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Compare" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {nodes.slice(0, 50).map(n => <SelectItem key={n.id} value={n.id}>{n.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="factor" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                <Radar name={selectedId} dataKey="selected" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                {compareNode && (
                  <Radar name={compareId} dataKey="compare" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} />
                )}
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average bars */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Average Factor Values</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={avgData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" name="Average" radius={[4, 4, 0, 0]}>
                  {avgData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">All Nodes — 7F Values</CardTitle>
            <Select value={sortBy} onValueChange={v => { setSortBy(v); setPage(0); }}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FACTOR_KEYS.map(k => <SelectItem key={k} value={k}>Sort: {FACTOR_THRESHOLDS[k].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Node</th>
                {FACTOR_KEYS.map(k => (
                  <th key={k} className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {FACTOR_THRESHOLDS[k].label.split(' ')[0]}
                  </th>
                ))}
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(node => (
                <tr key={node.id} onClick={() => selectNode(node.id)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="p-3 font-mono text-primary font-medium">{node.id}</td>
                  {FACTOR_KEYS.map(k => (
                    <td key={k} className="p-3">
                      <span className="font-mono text-xs">{formatFactorValue(node.factors[k].value, FACTOR_THRESHOLDS[k].unit)}</span>
                    </td>
                  ))}
                  <td className="p-3 text-xs">{node.decision.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Page {page + 1} of {Math.ceil(nodes.length / perPage)}</p>
        <div className="flex gap-1">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs rounded-md bg-secondary disabled:opacity-40">Prev</button>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * perPage >= nodes.length} className="px-3 py-1.5 text-xs rounded-md bg-secondary disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

function averageFactor(nodes, key) {
  const values = nodes.map(node => node.factors[key].value).filter(value => value !== null && value !== undefined);
  return +(values.reduce((sum, value) => sum + value, 0) / (values.length || 1)).toFixed(1);
}

function formatFactorValue(value, unit) {
  return value === null || value === undefined ? 'N/A' : `${value}${unit}`;
}
