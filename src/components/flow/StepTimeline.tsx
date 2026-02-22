"use client";

import React, { useState } from 'react';
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
  if (!data || data.entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Keine Timeline-Daten vorhanden. Starte einen Workflow.
      </div>
    );
  }

  const laneHeight = 32;
  const chartHeight = (data.maxLane + 1) * laneHeight + 8;

  return (
    <div className="h-full overflow-auto px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground/70">
        <span>{data.entries.length} Steps</span>
        <span className="text-muted-foreground/30">|</span>
        <span>{formatMs(data.totalDurationMs)} total</span>
      </div>
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
