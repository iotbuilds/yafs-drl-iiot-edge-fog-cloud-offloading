import React from 'react';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function KpiCard({ title, value, icon: Icon, color, trend, tooltip, suffix }) {
  const trendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const TrendIcon = trendIcon;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-muted-foreground';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="relative overflow-hidden p-4 hover:shadow-lg transition-shadow duration-300 cursor-default group">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                <p className="text-2xl font-bold tracking-tight">
                  {value}{suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
                </p>
              </div>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                color || "bg-primary/10"
              )}>
                {Icon && <Icon className="w-5 h-5 text-primary" />}
              </div>
            </div>
            {trend && (
              <div className={cn("flex items-center gap-1 mt-2", trendColor)}>
                <TrendIcon className="w-3 h-3" />
                <span className="text-xs font-medium">{trend === 'up' ? 'Increasing' : trend === 'down' ? 'Decreasing' : 'Stable'}</span>
              </div>
            )}
            <div className={cn(
              "absolute top-0 right-0 w-20 h-20 rounded-full opacity-5 -translate-y-6 translate-x-6",
              color || "bg-primary"
            )} />
          </Card>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="bottom">
            <p className="text-xs max-w-[200px]">{tooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}