import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getEdgeServers, getFogServers, getCloud, getTimeSeriesMetrics } from '../services/yafsApi';
import KpiCard from '../components/shared/KpiCard';
import { Cpu, Zap, Wifi, Server, Cloud, ArrowUpRight, ArrowDown, Database } from 'lucide-react';
import { useYafsRealtime } from '@/hooks/useYafsRealtime';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function Analytics() {
  const { data } = useYafsRealtime(
    () => Promise.all([getEdgeServers(), getFogServers(), getCloud(), getTimeSeriesMetrics()]),
    [[], [], null, []]
  );
  const [edges, fogs, cloud, timeSeries] = data;

  const edgeChartData = edges.map(e => ({
    name: e.id.replace('EDGE-', 'E'),
    cpu: e.cpu,
    memory: e.memory,
    load: e.load,
  }));

  const fogChartData = fogs.map(f => ({
    name: f.id.replace('FOG-', 'F'),
    cpu: f.cpu,
    memory: f.memory,
    load: f.load,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Edge / Fog / Cloud Analytics</h1>

      <Tabs defaultValue="edge">
        <TabsList>
          <TabsTrigger value="edge">Edge Layer</TabsTrigger>
          <TabsTrigger value="fog">Fog Layer</TabsTrigger>
          <TabsTrigger value="cloud">Cloud Layer</TabsTrigger>
        </TabsList>

        {/* Edge */}
        <TabsContent value="edge" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Edge Servers" value={edges.length} icon={Server} color="bg-blue-500/10" tooltip="Total active edge servers" />
            <KpiCard title="Total Connected" value={edges.reduce((s, e) => s + e.connectedNodes, 0)} icon={Wifi} color="bg-cyan-500/10" tooltip="IIoT nodes connected to edges" />
            <KpiCard title="Tasks Processed" value={edges.reduce((s, e) => s + e.tasksProcessed, 0)} icon={Cpu} color="bg-emerald-500/10" tooltip="Tasks processed locally at edge" />
            <KpiCard title="Energy Saved" value={`${edges.reduce((s, e) => s + e.energySaved, 0).toFixed(0)}`} suffix="J" icon={Zap} color="bg-yellow-500/10" tooltip="Energy saved vs cloud offloading" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Edge Server Load</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={edgeChartData} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="cpu" fill="#3B82F6" name="Computational Load %" radius={[3,3,0,0]} />
                    <Bar dataKey="memory" fill="#8B5CF6" name="Memory %" radius={[3,3,0,0]} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Edge Server Details</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    {['Server', 'Load', 'Comp. Load', 'Mem', 'Nodes', 'Tasks', 'Fwd→Fog'].map(h => (
                      <th key={h} className="p-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {edges.map(e => (
                      <tr key={e.id} className="border-b border-border/50">
                        <td className="p-2 font-mono text-xs text-primary">{e.id}</td>
                        <td className="p-2 font-mono text-xs">{e.load}%</td>
                        <td className="p-2 font-mono text-xs">{e.cpu}%</td>
                        <td className="p-2 font-mono text-xs">{e.memory}%</td>
                        <td className="p-2 font-mono text-xs">{e.connectedNodes}</td>
                        <td className="p-2 font-mono text-xs">{e.tasksProcessed}</td>
                        <td className="p-2 font-mono text-xs">{e.tasksForwardedFog}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Fog */}
        <TabsContent value="fog" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Fog Servers" value={fogs.length} icon={Cloud} color="bg-purple-500/10" />
            <KpiCard title="Tasks from Edge" value={fogs.reduce((s, f) => s + f.tasksFromEdge, 0)} icon={ArrowDown} color="bg-cyan-500/10" />
            <KpiCard title="Fog-to-Fog" value={fogs.reduce((s, f) => s + f.fogToFogTransfers, 0)} icon={ArrowUpRight} color="bg-amber-500/10" />
            <KpiCard title="To Cloud" value={fogs.reduce((s, f) => s + f.tasksToCloud, 0)} icon={ArrowUpRight} color="bg-gray-500/10" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Fog Server Load</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={fogChartData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="cpu" fill="#8B5CF6" name="Computational Load %" radius={[3,3,0,0]} />
                    <Bar dataKey="memory" fill="#EC4899" name="Memory %" radius={[3,3,0,0]} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Fog Server Details</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    {['Server', 'Load', 'Comp. Load', 'Mem', 'From Edge', 'F→F', 'To Cloud', 'Delay'].map(h => (
                      <th key={h} className="p-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {fogs.map(f => (
                      <tr key={f.id} className="border-b border-border/50">
                        <td className="p-2 font-mono text-xs text-purple-400">{f.id}</td>
                        <td className="p-2 font-mono text-xs">{f.load}%</td>
                        <td className="p-2 font-mono text-xs">{f.cpu}%</td>
                        <td className="p-2 font-mono text-xs">{f.memory}%</td>
                        <td className="p-2 font-mono text-xs">{f.tasksFromEdge}</td>
                        <td className="p-2 font-mono text-xs">{f.fogToFogTransfers}</td>
                        <td className="p-2 font-mono text-xs">{f.tasksToCloud}</td>
                        <td className="p-2 font-mono text-xs">{f.avgDelay}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cloud */}
        <TabsContent value="cloud" className="space-y-4 mt-4">
          {cloud && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard title="Cloud Records" value={cloud.dataReceived} icon={Database} color="bg-gray-500/10" />
                <KpiCard title="Historical Records" value={(cloud.historicalRecords / 1000).toFixed(0) + 'K'} icon={Database} color="bg-blue-500/10" />
                <KpiCard title="Warning/Critical Updates" value={cloud.anomaliesReported} icon={ArrowUpRight} color="bg-red-500/10" />
                <KpiCard title="Status" value="Connected" icon={Cloud} color="bg-emerald-500/10" />
              </div>

              {/* Data flow explanation */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Confirmed 3L Cloud Transmission Policy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Normal Raw Readings Kept at Edge', value: `${cloud.rawAtEdge}%`, color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
                      { label: 'Critical Updates to Cloud', value: `${cloud.criticalUpdates} / 1 min`, color: 'bg-red-500/10 border-red-500/20 text-red-400' },
                      { label: 'Warning Updates to Cloud', value: `${cloud.warningUpdates} / 3 min`, color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
                      { label: 'Normal Summaries to Cloud', value: `${cloud.normalSummaries} / 5 min`, color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
                    ].map(item => (
                      <div key={item.label} className={`p-4 rounded-xl border ${item.color}`}>
                        <p className="text-xs font-medium opacity-80 mb-1">{item.label}</p>
                        <p className="text-xl font-bold">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Cloud data volume over time */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Cloud Transmission Records Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="cloudDataVolume" stroke="#6B7280" strokeWidth={2} dot={false} name="Cloud records" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
