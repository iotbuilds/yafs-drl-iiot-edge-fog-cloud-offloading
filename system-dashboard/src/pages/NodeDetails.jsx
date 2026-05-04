import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { getNodes } from '../services/yafsApi';
import { useDashboard } from '../components/layout/DashboardLayout';
import StatusBadge from '../components/shared/StatusBadge';
import { format } from 'date-fns';
import { useYafsRealtime } from '@/hooks/useYafsRealtime';

export default function NodeDetails() {
  const { selectNode, searchQuery } = useDashboard();
  const { data: nodes } = useYafsRealtime(getNodes, []);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const perPage = 25;

  const query = search || searchQuery || '';
  const filtered = nodes.filter(n =>
    n.id.toLowerCase().includes(query.toLowerCase()) ||
    n.equipment.toLowerCase().includes(query.toLowerCase()) ||
    n.zone.toLowerCase().includes(query.toLowerCase())
  );

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Node Details</h1>
          <p className="text-sm text-muted-foreground">Click any node to view full details</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, equipment, zone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Node ID</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Zone</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Equipment</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Edge</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Decision</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Last Update</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(node => (
                <tr
                  key={node.id}
                  onClick={() => selectNode(node.id)}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-mono font-medium text-primary">{node.id}</td>
                  <td className="p-3">Zone {node.zone}</td>
                  <td className="p-3">{node.equipment}</td>
                  <td className="p-3"><StatusBadge status={node.status} /></td>
                  <td className="p-3 font-mono text-xs">{node.edgeServer}</td>
                  <td className="p-3 text-xs">{node.decision.type}</td>
                  <td className="p-3 text-xs text-muted-foreground">{formatTime(node.lastUpdate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length}
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 disabled:opacity-40 transition-colors"
          >
            Prev
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : format(date, 'HH:mm:ss');
}
