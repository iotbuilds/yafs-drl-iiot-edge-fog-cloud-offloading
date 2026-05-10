import React from 'react';
import OverviewKpis from '../components/overview/OverviewKpis';
import { LatencyEnergyChart, CongestionCpuChart, OffloadingPieChart, NodeStatusChart } from '../components/overview/OverviewCharts';
import { getKpiSummary, getTimeSeriesMetrics } from '../services/yafsApi';
import { Skeleton } from '@/components/ui/skeleton';
import { useYafsRealtime } from '@/hooks/useYafsRealtime';

export default function Overview() {
  const { data, loading } = useYafsRealtime(
    () => Promise.all([getKpiSummary(), getTimeSeriesMetrics()]),
    [null, []]
  );
  const [kpis, timeSeries] = data;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array(12).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Multi-objective DQN task offloading, real-time monitoring
        </p>
      </div>

      <OverviewKpis kpis={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LatencyEnergyChart data={timeSeries} />
        <CongestionCpuChart data={timeSeries} />
        <OffloadingPieChart kpis={kpis} />
        <NodeStatusChart kpis={kpis} />
      </div>
    </div>
  );
}
