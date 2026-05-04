import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, MapPin, Clock, Wifi, ArrowRight } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { getNodeById } from '../../services/yafsApi';
import { SENSOR_THRESHOLDS, FACTOR_THRESHOLDS } from '../../data/constants';
import { format } from 'date-fns';
import { useYafsRealtime } from '@/hooks/useYafsRealtime';

function SensorRow({ sensorKey, data }) {
  const t = SENSOR_THRESHOLDS[sensorKey];
  const value = data?.value === null || data?.value === undefined ? 'N/A' : `${data.value}${t.unit}`;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
      <div>
        <p className="text-sm font-medium">{t.label}</p>
        <p className="text-xs text-muted-foreground">{t.normalMax ? `Normal: <${t.normalMax}${t.unit}` : ''}</p>
      </div>
      <div className="text-right flex items-center gap-2">
        <span className="text-sm font-mono font-semibold">{value}</span>
        <StatusBadge status={data?.status || 'unknown'} />
      </div>
    </div>
  );
}

function FactorRow({ factorKey, data }) {
  const t = FACTOR_THRESHOLDS[factorKey];
  const value = data?.value === null || data?.value === undefined ? 'N/A' : `${data.value}${t.unit}`;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
      <div>
        <p className="text-sm font-medium">{t.label}</p>
        <p className="text-xs text-muted-foreground">Weight: {data?.weight ?? 'N/A'}</p>
      </div>
      <div className="text-right flex items-center gap-2">
        <span className="text-sm font-mono font-semibold">{value}</span>
        <StatusBadge status={data?.status || 'unknown'} />
      </div>
    </div>
  );
}

export default function NodeDetailDrawer({ nodeId, open, onClose, viewMode }) {
  const { data: node } = useYafsRealtime(
    () => (nodeId ? getNodeById(nodeId) : Promise.resolve(null)),
    null,
    [nodeId]
  );

  if (!nodeId || !node) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-lg">{node.id}</SheetTitle>
              <SheetDescription className="sr-only">Node detail information</SheetDescription>
              <StatusBadge status={node.status || 'unknown'} />
            </div>
          </div>
        </SheetHeader>

        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <InfoItem icon={MapPin} label="Zone" value={`Zone ${node.zone}`} />
          <InfoItem icon={Server} label="Equipment" value={node.equipment} />
          <InfoItem icon={Wifi} label="Edge Server" value={node.edgeServer} />
          <InfoItem icon={Clock} label="Last Update" value={formatTime(node.lastUpdate)} />
          <InfoItem icon={MapPin} label="Position" value={formatPosition(node)} />
          <InfoItem icon={Server} label="Type" value={node.type} />
        </div>

        <Separator className="my-4" />

        {/* Offloading Decision */}
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" /> Offloading Decision
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Action</span>
              <Badge variant="secondary" className="text-xs">{node.decision.type || 'N/A'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <span className="text-sm font-mono">{formatMetric(node.decision.confidence, '%')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Reward</span>
              <span className="text-sm font-mono">{formatMetric(node.decision.reward)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Q-Value</span>
              <span className="text-sm font-mono">{formatMetric(node.decision.qValue)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">"{node.decision.reason}"</p>
          </div>
        </div>

        {/* Tabs for Sensors and Factors */}
        <Tabs defaultValue={viewMode === '7f' ? 'factors' : 'sensors'}>
          <TabsList className="w-full">
            <TabsTrigger value="sensors" className="flex-1">7S Sensors</TabsTrigger>
            <TabsTrigger value="factors" className="flex-1">7F Factors</TabsTrigger>
          </TabsList>
          <TabsContent value="sensors" className="space-y-1 mt-3">
            {Object.keys(SENSOR_THRESHOLDS).map(key => (
              <SensorRow key={key} sensorKey={key} data={node.sensors[key]} />
            ))}
          </TabsContent>
          <TabsContent value="factors" className="space-y-1 mt-3">
            {Object.keys(FACTOR_THRESHOLDS).map(key => (
              <FactorRow key={key} factorKey={key} data={node.factors[key]} />
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-medium">{value}</p>
      </div>
    </div>
  );
}

function formatMetric(value, suffix = '') {
  return value === null || value === undefined ? 'N/A' : `${value}${suffix}`;
}

function formatPosition(node) {
  return node.posX === null || node.posX === undefined || node.posY === null || node.posY === undefined
    ? 'N/A'
    : `(${node.posX}, ${node.posY})`;
}

function formatTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : format(date, 'HH:mm:ss');
}
