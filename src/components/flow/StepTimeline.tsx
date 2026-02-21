"use client";

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import type { TimelineData, TimelineEntry } from '@/lib/flow/timeline';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<TimelineEntry['status'], string> = {
  running: 'bg-cyan-500/80',
  success: 'bg-emerald-500/80',
  error: 'bg-red-500/80',
  skipped: 'bg-zinc-500/50',
};

const STATUS_BORDER_COLORS: Record<TimelineEntry['status'], string> = {
  running: 'border-cyan-400/60',
  success: 'border-emerald-400/60',
  error: 'border-red-400/60',
  skipped: 'border-zinc-400/40',
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface StepTimelineProps {
  data: TimelineData | null;
}

export function StepTimeline({ data }: StepTimelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (!data || data.entries.length === 0) {
    return null;
  }

  const laneHeight = 32;
  const chartHeight = (data.maxLane + 1) * laneHeight + 8;

  return (
    <div className="border-t border-border/60 bg-card/30">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-accent/20"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        <Clock className="h-3.5 w-3.5" />
        <span className="font-medium">Timeline</span>
        <span className="text-muted-foreground/70">
          {data.entries.length} Steps | {formatMs(data.totalDurationMs)}
        </span>
      </button>

      {!isCollapsed && (
        <div className="overflow-x-auto px-4 pb-3">
          <div className="relative min-w-[400px]" style={{ height: chartHeight }}>
            {data.entries.map((entry) => (
              <TimelineBar
                key={entry.stepId}
                entry={entry}
                totalDurationMs={data.totalDurationMs}
                laneHeight={laneHeight}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineBar({
  entry,
  totalDurationMs,
  laneHeight,
}: {
  entry: TimelineEntry;
  totalDurationMs: number;
  laneHeight: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const leftPct = totalDurationMs > 0 ? (entry.startMs / totalDurationMs) * 100 : 0;
  const widthPct = totalDurationMs > 0 ? Math.max((entry.durationMs / totalDurationMs) * 100, 1) : 100;
  const top = entry.lane * laneHeight + 4;

  return (
    <div
      className={cn(
        'absolute flex items-center overflow-hidden rounded border text-[10px]',
        STATUS_COLORS[entry.status],
        STATUS_BORDER_COLORS[entry.status],
      )}
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top,
        height: laneHeight - 6,
        minWidth: 40,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="truncate px-1.5 font-medium text-white/90">
        {entry.label}
      </span>
      <span className="ml-auto shrink-0 px-1.5 text-white/60">
        {formatMs(entry.durationMs)}
      </span>

      {isHovered && (
        <div className="absolute -top-8 left-0 z-10 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] text-white shadow-lg">
          {entry.label} | {entry.status} | {formatMs(entry.durationMs)}
        </div>
      )}
    </div>
  );
}

export default StepTimeline;
