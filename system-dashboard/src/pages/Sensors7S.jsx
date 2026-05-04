import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { getNodes } from '../services/yafsApi';
import { SENSOR_THRESHOLDS, PLANT_ZONES } from '../data/constants';
import { useDashboard } from '../components/layout/DashboardLayout';
import StatusBadge from '../components/shared/StatusBadge';
import { useYafsRealtime } from '@/hooks/useYafsRealtime';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const SENSOR_KEYS = Object.keys(SENSOR_THRESHOLDS);
const COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Sensors7S() {
  const { selectNode } = useDashboard();
  const { data: nodes } = useYafsRealtime(getNodes, []);
  const [selectedSensor, setSelectedSensor] = useState('temperature');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const perPage = 20;

  const filtered = nodes.filter(n => {
    if (zoneFilter !== 'all' && n.zone !== zoneFilter) return false;
    if (statusFilter !== 'all' && n.sensors[selectedSensor]?.status !== statusFilter) return false;
    if (search && !n.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  // Sensor status distribution
  const statusDist = SENSOR_KEYS.map(key => {
    const normal = nodes.filter(n => n.sensors[key].status === 'normal').length;
    const warning = nodes.filter(n => n.sensors[key].status === 'warning').length;
    const critical = nodes.filter(n => n.sensors[key].status === 'critical').length;
    return { name: SENSOR_THRESHOLDS[key].label.split(' ')[0], normal, warning, critical };
  });

  // Critical alerts
  const criticalAlerts = nodes.filter(n =>
    Object.values(n.sensors).some(s => s.status === 'critical')
  ).slice(0, 10);

  // Multi-sensor chart for selected node (first 50 nodes as time proxy)
  const sensorTimeData = nodes.slice(0, 24).map((n, i) => ({
    time: `T-${24 - i}h`,
    value: n.sensors[selectedSensor].value,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">7S Sensor Readings</h1>
          <p className="text-sm text-muted-foreground">Seven sensors per node — threshold monitoring</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedSensor} onValueChange={v => { setSelectedSensor(v); setPage(0); }}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SENSOR_KEYS.map(k => <SelectItem key={k} value={k}>{SENSOR_THRESHOLDS[k].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={zoneFilter} onValueChange={v => { setZoneFilter(v); setPage(0); }}>
            <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {PLANT_ZONES.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sensor trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{SENSOR_THRESHOLDS[selectedSensor].label} Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={sensorTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={{ r: 2 }} name={`${SENSOR_THRESHOLDS[selectedSensor].label} (${SENSOR_THRESHOLDS[selectedSensor].unit})`} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status distribution stacked bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sensor Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusDist} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="normal" stackId="a" fill="#10B981" name="Normal" radius={[0,0,0,0]} />
                <Bar dataKey="warning" stackId="a" fill="#F59E0B" name="Warning" />
                <Bar dataKey="critical" stackId="a" fill="#EF4444" name="Critical" radius={[4,4,0,0]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Critical alerts */}
      {criticalAlerts.length > 0 && (
        <Card className="border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Critical Sensor Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criticalAlerts.map(n => {
                const critSensors = Object.entries(n.sensors).filter(([, v]) => v.status === 'critical');
                return (
                  <div key={n.id} onClick={() => selectNode(n.id)}
                    className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/10 cursor-pointer hover:bg-red-500/10 transition-colors">
                    <div>
                      <span className="font-mono text-sm font-medium text-red-500">{n.id}</span>
                      <span className="text-xs text-muted-foreground ml-2">Zone {n.zone}</span>
                    </div>
                    <div className="flex gap-1">
                      {critSensors.map(([key, data]) => (
                        <span key={key} className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">
                          {SENSOR_THRESHOLDS[key].label}: {formatSensorValue(data.value, SENSOR_THRESHOLDS[key].unit)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Node</th>
                {SENSOR_KEYS.map(k => (
                  <th key={k} className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {SENSOR_THRESHOLDS[k].label.split(' ')[0]}
                  </th>
                ))}
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(node => (
                <tr key={node.id} onClick={() => selectNode(node.id)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="p-3 font-mono text-primary font-medium">{node.id}</td>
                  {SENSOR_KEYS.map(k => (
                    <td key={k} className="p-3">
                      <span className="font-mono text-xs">{formatSensorValue(node.sensors[k].value, SENSOR_THRESHOLDS[k].unit)}</span>
                    </td>
                  ))}
                  <td className="p-3"><StatusBadge status={node.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length}</p>
        <div className="flex gap-1">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs rounded-md bg-secondary disabled:opacity-40">Prev</button>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * perPage >= filtered.length} className="px-3 py-1.5 text-xs rounded-md bg-secondary disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

function formatSensorValue(value, unit) {
  return value === null || value === undefined ? 'N/A' : `${value}${unit}`;
}
