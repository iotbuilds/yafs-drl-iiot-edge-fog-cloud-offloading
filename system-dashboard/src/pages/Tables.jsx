import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Download } from 'lucide-react';
import { getNodes, getOffloadingLogs } from '../services/yafsApi';
import { SENSOR_THRESHOLDS, FACTOR_THRESHOLDS } from '../data/constants';
import { useDashboard } from '../components/layout/DashboardLayout';
import StatusBadge from '../components/shared/StatusBadge';
import { format } from 'date-fns';
import { useYafsRealtime } from '@/hooks/useYafsRealtime';

function exportToCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PaginatedTable({ headers, rows, renderRow, search, setSearch, onExport, exportFilename }) {
  const [page, setPage] = useState(0);
  const perPage = 20;

  const filtered = search
    ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
    : rows;

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9 text-sm" />
        </div>
        <Button variant="outline" size="sm" onClick={() => onExport(filtered, exportFilename)} className="h-9 gap-1">
          <Download className="w-3.5 h-3.5" /> CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map(h => (
                <th key={h} className="p-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{paged.map(renderRow)}</tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Showing {filtered.length === 0 ? 0 : page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length}</p>
        <div className="flex gap-1">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs rounded-md bg-secondary disabled:opacity-40">Prev</button>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * perPage >= filtered.length} className="px-3 py-1.5 text-xs rounded-md bg-secondary disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

export default function Tables() {
  const { selectNode } = useDashboard();
  const { data } = useYafsRealtime(
    () => Promise.all([getNodes(), getOffloadingLogs()]),
    [[], []]
  );
  const [nodes, logs] = data;
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [searchC, setSearchC] = useState('');
  const [searchD, setSearchD] = useState('');

  const SENSOR_KEYS = Object.keys(SENSOR_THRESHOLDS);
  const FACTOR_KEYS = Object.keys(FACTOR_THRESHOLDS);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Tables & Logs</h1>

      <Tabs defaultValue="inventory">
        <TabsList className="flex-wrap">
          <TabsTrigger value="inventory">Node Inventory</TabsTrigger>
          <TabsTrigger value="sensors">Sensor Readings</TabsTrigger>
          <TabsTrigger value="factors">7F Factors</TabsTrigger>
          <TabsTrigger value="offloading">Offloading Log</TabsTrigger>
        </TabsList>

        {/* A: Node Inventory */}
        <TabsContent value="inventory" className="mt-4">
          <PaginatedTable
            search={searchA} setSearch={setSearchA}
            onExport={exportToCSV} exportFilename="node_inventory.csv"
            headers={['Node ID', 'Type', 'Zone', 'Equipment', 'Status', 'Edge', 'X', 'Y', 'Last Update']}
            rows={nodes}
            renderRow={n => (
              <tr key={n.id} onClick={() => selectNode(n.id)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer">
                <td className="p-2.5 font-mono text-xs text-primary">{n.id}</td>
                <td className="p-2.5 text-xs">{n.type}</td>
                <td className="p-2.5 text-xs">Zone {n.zone}</td>
                <td className="p-2.5 text-xs">{n.equipment}</td>
                <td className="p-2.5"><StatusBadge status={n.status} /></td>
                <td className="p-2.5 font-mono text-xs">{n.edgeServer}</td>
                <td className="p-2.5 font-mono text-xs">{n.posX}</td>
                <td className="p-2.5 font-mono text-xs">{n.posY}</td>
                <td className="p-2.5 text-xs text-muted-foreground">{format(new Date(n.lastUpdate), 'HH:mm:ss')}</td>
              </tr>
            )}
          />
        </TabsContent>

        {/* B: Sensor Readings */}
        <TabsContent value="sensors" className="mt-4">
          <PaginatedTable
            search={searchB} setSearch={setSearchB}
            onExport={exportToCSV} exportFilename="sensor_readings.csv"
            headers={['Node', ...SENSOR_KEYS.map(k => SENSOR_THRESHOLDS[k].label.split(' ')[0]), 'Status']}
            rows={nodes}
            renderRow={n => (
              <tr key={n.id} onClick={() => selectNode(n.id)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer">
                <td className="p-2.5 font-mono text-xs text-primary">{n.id}</td>
                {SENSOR_KEYS.map(k => (
                  <td key={k} className="p-2.5 font-mono text-xs">{n.sensors[k].value}{SENSOR_THRESHOLDS[k].unit}</td>
                ))}
                <td className="p-2.5"><StatusBadge status={n.status} /></td>
              </tr>
            )}
          />
        </TabsContent>

        {/* C: 7F Factors */}
        <TabsContent value="factors" className="mt-4">
          <PaginatedTable
            search={searchC} setSearch={setSearchC}
            onExport={exportToCSV} exportFilename="7f_factors.csv"
            headers={['Node', ...FACTOR_KEYS.map(k => FACTOR_THRESHOLDS[k].label.split(' ')[0]), 'Decision']}
            rows={nodes}
            renderRow={n => (
              <tr key={n.id} onClick={() => selectNode(n.id)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer">
                <td className="p-2.5 font-mono text-xs text-primary">{n.id}</td>
                {FACTOR_KEYS.map(k => (
                  <td key={k} className="p-2.5 font-mono text-xs">{n.factors[k].value}{FACTOR_THRESHOLDS[k].unit}</td>
                ))}
                <td className="p-2.5 text-xs">{n.decision.type}</td>
              </tr>
            )}
          />
        </TabsContent>

        {/* D: Offloading Log */}
        <TabsContent value="offloading" className="mt-4">
          <PaginatedTable
            search={searchD} setSearch={setSearchD}
            onExport={exportToCSV} exportFilename="offloading_log.csv"
            headers={['Task', 'Source', 'Dest', 'Type', 'Trigger', 'Latency', 'Energy', 'Reward', 'Conf.', 'Time']}
            rows={logs}
            renderRow={l => (
              <tr key={l.taskId} onClick={() => selectNode(l.source)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer">
                <td className="p-2.5 font-mono text-xs">{l.taskId}</td>
                <td className="p-2.5 font-mono text-xs text-primary">{l.source}</td>
                <td className="p-2.5 font-mono text-xs">{l.destination}</td>
                <td className="p-2.5 text-xs">{l.decisionType}</td>
                <td className="p-2.5 text-xs">{l.triggeringFactor}</td>
                <td className="p-2.5 font-mono text-xs">{l.latency}ms</td>
                <td className="p-2.5 font-mono text-xs">{l.energy}J</td>
                <td className="p-2.5 font-mono text-xs">{l.reward}</td>
                <td className="p-2.5 font-mono text-xs">{l.confidence}%</td>
                <td className="p-2.5 text-xs text-muted-foreground">{format(new Date(l.timestamp), 'HH:mm:ss')}</td>
              </tr>
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
