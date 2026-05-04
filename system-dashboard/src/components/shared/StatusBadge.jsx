import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  normal: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
  critical: 'bg-red-500/15 text-red-500 border-red-500/20',
  connected: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  congested: 'bg-red-500/15 text-red-500 border-red-500/20',
  healthy: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
};

export default function StatusBadge({ status, className }) {
  return (
    <Badge variant="outline" className={cn(
      "text-[10px] font-semibold uppercase tracking-wider border",
      STATUS_STYLES[status] || 'bg-muted text-muted-foreground border-border',
      className
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full mr-1.5 inline-block",
        status === 'normal' || status === 'connected' || status === 'healthy' ? 'bg-emerald-500' :
        status === 'warning' ? 'bg-amber-500' :
        status === 'critical' || status === 'congested' ? 'bg-red-500' : 'bg-muted-foreground'
      )} />
      {status}
    </Badge>
  );
}