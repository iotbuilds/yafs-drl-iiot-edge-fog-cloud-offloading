import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileText, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { getReportData } from '../services/yafsApi';

const formatMetric = (value, suffix) => (
  value === null || value === undefined ? 'N/A' : `${value}${suffix}`
);

const RANGE_LABELS = {
  '5m': 'Last 5 Minutes',
  '15m': 'Last 15 Minutes',
  full: 'Full Simulation',
};

export default function Reports() {
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeTables, setIncludeTables] = useState(true);
  const [includePlant, setIncludePlant] = useState(true);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [range, setRange] = useState('full');
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    const data = await getReportData();
    const doc = new jsPDF('p', 'mm', 'a4');
    const w = doc.internal.pageSize.getWidth();
    let y = 15;

    const addTitle = (text, size = 14) => {
      doc.setFontSize(size);
      doc.setTextColor(30, 41, 59);
      doc.text(text, 14, y);
      y += size * 0.6;
    };

    const addText = (text, size = 9) => {
      doc.setFontSize(size);
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(text, w - 28);
      doc.text(lines, 14, y);
      y += lines.length * size * 0.45 + 2;
    };

    const addLine = () => {
      doc.setDrawColor(200, 200, 200);
      doc.line(14, y, w - 14, y);
      y += 4;
    };

    const checkPage = (needed = 20) => {
      if (y + needed > 280) { doc.addPage(); y = 15; }
    };

    // Title
    addTitle('IIoT DRL Task Offloading Dashboard Report', 16);
    y += 2;
    addText(`Generated: ${new Date().toLocaleString()} | Range: ${RANGE_LABELS[range] || 'Full Simulation'}`);
    addLine();

    // 1. Executive Summary
    addTitle('1. Executive Summary');
    addText(`This report summarizes the status of ${data.kpis.totalNodes} IIoT nodes deployed across the industrial plant. ` +
      `${data.kpis.activeNodes} nodes are operating normally, ${data.kpis.warningNodes} are in warning state, ` +
      `and ${data.kpis.criticalNodes} require immediate attention.`);
    y += 3;

    // 2. System Overview
    checkPage(30);
    addTitle('2. System Overview');
    const kpiLines = [
      `Total Nodes: ${data.kpis.totalNodes}  |  Edge Servers: ${data.kpis.edgeServers}  |  Fog Servers: ${data.kpis.fogServers}`,
      `Avg Latency: ${data.kpis.avgLatency} ms  |  Avg Energy: ${data.kpis.avgEnergy} J  |  Avg Congestion: ${data.kpis.avgCongestion}%`,
      `Cloud Status: ${data.kpis.cloudStatus}  |  Total Offloaded Tasks: ${data.kpis.totalOffloaded}`,
    ];
    kpiLines.forEach(l => addText(l));
    y += 3;

    // 3. Cloud Transmission Policy
    checkPage(36);
    addTitle('3. Cloud Transmission Policy');
    addText('Critical: transmit/update to cloud every 1 minute.');
    addText('Warning: transmit/update to cloud every 3 minutes. repeated_warning remains a flag under warning, not a fourth status.');
    addText('Normal: raw normal readings are aggregated at the edge. Cloud receives one normal summary per sensor/node for each 5-minute window that stayed normal.');
    if (data.cloud) {
      addText(`Current cloud records: ${data.cloud.dataReceived} | Critical updates: ${data.cloud.criticalUpdates} | Warning updates: ${data.cloud.warningUpdates} | Normal summaries: ${data.cloud.normalSummaries}`);
    }
    y += 3;

    // 4. Node Status
    checkPage(30);
    addTitle('4. Node Status Summary');
    addText(`Normal: ${data.kpis.activeNodes} (${(data.kpis.activeNodes / 10).toFixed(1)}%)`);
    addText(`Warning: ${data.kpis.warningNodes} (${(data.kpis.warningNodes / 10).toFixed(1)}%)`);
    addText(`Critical: ${data.kpis.criticalNodes} (${(data.kpis.criticalNodes / 10).toFixed(1)}%)`);
    y += 3;

    // 5. Offloading Summary
    checkPage(30);
    addTitle('5. Offloading Decision Summary');
    addText(`Local Processing: ${data.kpis.localPct}%`);
    addText(`Edge-to-Edge: ${data.kpis.edgeToEdgePct}%  |  Edge-to-Fog: ${data.kpis.edgeToFogPct}%`);
    addText(`Fog-to-Fog: ${data.kpis.fogToFogPct}%  |  Cloud: ${data.kpis.cloudPct}%`);
    y += 3;

    // 6. Critical Nodes
    if (data.criticalNodes.length > 0) {
      checkPage(40);
      addTitle('6. Critical Nodes');
      data.criticalNodes.slice(0, 10).forEach(n => {
        checkPage(8);
        addText(`${n.id} | Zone ${n.zone} | ${n.equipment} | Decision: ${n.decision.type}`, 8);
      });
      y += 3;
    }

    // 7. Congested Links
    if (data.congestedLinks.length > 0) {
      checkPage(30);
      addTitle('7. Congested Network Links');
      data.congestedLinks.forEach(l => {
        checkPage(8);
        addText(`${l.source} → ${l.target} | Congestion: ${formatMetric(l.congestion, '%')} | Latency: ${formatMetric(l.latency, 'ms')}`, 8);
      });
      y += 3;
    }

    // 8. Recent Offloading Logs
    if (includeTables) {
      checkPage(40);
      addTitle('8. Recent Offloading Decisions (Top 20)');
      data.logs.slice(0, 20).forEach(l => {
        checkPage(8);
        addText(`${l.taskId} | ${l.source}→${l.destination} | ${l.decisionType} | ${l.latency}ms | ${l.energy}J`, 8);
      });
    }

    // 9. Recommendations
    checkPage(30);
    addTitle('9. Recommended Actions');
    const recs = [
      'Investigate critical sensor readings on flagged nodes immediately.',
      'Confirm critical cloud updates are visible in the 1-minute cloud transmission stream.',
      'Review warning updates in 3-minute windows; repeated_warning is a flag inside warning.',
      'Use 5-minute normal summaries for cloud review instead of sending all normal raw readings.',
      'Consider load balancing for congested edge servers.',
      'Review fog-to-cloud offloading patterns for optimization.',
      'Monitor DRL reward trends for model convergence.',
    ];
    recs.forEach(r => { checkPage(8); addText(`- ${r}`); });

    doc.save(`IIoT_DRL_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Generation</h1>
        <p className="text-sm text-muted-foreground">Generate and download PDF reports from simulation data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" /> Report Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Include Sections</Label>
              <div className="space-y-2">
                {[
                  { id: 'charts', label: 'Charts & Visualizations', checked: includeCharts, onChange: setIncludeCharts },
                  { id: 'tables', label: 'Tables & Decision Logs', checked: includeTables, onChange: setIncludeTables },
                  { id: 'plant', label: 'Plant View Snapshot', checked: includePlant, onChange: setIncludePlant },
                  { id: 'critical', label: 'Critical Nodes Only', checked: criticalOnly, onChange: setCriticalOnly },
                ].map(opt => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <Checkbox id={opt.id} checked={opt.checked} onCheckedChange={opt.onChange} />
                    <Label htmlFor={opt.id} className="text-sm cursor-pointer">{opt.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report Range</Label>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5m">Last 5 Minutes</SelectItem>
                  <SelectItem value="15m">Last 15 Minutes</SelectItem>
                  <SelectItem value="full">Full Simulation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generatePDF} disabled={generating} className="w-full gap-2" size="lg">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Download PDF Report'}
            </Button>
          </CardContent>
        </Card>

        {/* Report Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Report Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-xl p-6 space-y-4 border border-border/50">
              <div className="text-center">
                <h3 className="font-bold text-lg">IIoT DRL Task Offloading</h3>
                <h4 className="font-semibold text-sm">Dashboard Report</h4>
                <p className="text-xs text-muted-foreground mt-1">Range: {RANGE_LABELS[range] || 'Full Simulation'}</p>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Report Sections:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Executive Summary</li>
                  <li>System Overview</li>
                  <li>Cloud Transmission Policy</li>
                  <li>Node Status Summary</li>
                  <li>Offloading Decision Summary</li>
                  <li>Critical Nodes</li>
                  <li>Congested Network Links</li>
                  {includeTables && <li>Recent Offloading Decisions</li>}
                  <li>Recommended Actions</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
