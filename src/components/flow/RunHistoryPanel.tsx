"use client";

import React from 'react';
import { AlertCircle, CheckCircle2, Clock3, Timer } from 'lucide-react';
import type { WorkflowRunSummary } from '@/lib/flow/types';
import { cn } from '@/lib/utils';

interface RunHistoryPanelProps {
  runs: WorkflowRunSummary[];
  selectedRunId: string | null;
  onSelectRun: (run: WorkflowRunSummary) => void;
}

function statusBadgeClass(status: WorkflowRunSummary['status']): string {
  switch (status) {
    case 'done':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    case 'error':
    case 'timeout':
      return 'border-red-500/40 bg-red-500/10 text-red-300';
    case 'cancelled':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
    default:
      return 'border-border/60 bg-muted/30 text-muted-foreground';
  }
}

function formatDate(dateIso: string): string {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return dateIso;
  }
  return parsed.toLocaleString();
}

export function RunHistoryPanel({ runs, selectedRunId, onSelectRun }: RunHistoryPanelProps) {
  return (
    <section className="border-t border-border/60 bg-zinc-900/40">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <div className="text-xs font-semibold tracking-wide">Run History</div>
        <div className="text-[11px] text-muted-foreground">Letzte {runs.length} Runs</div>
      </div>

      {runs.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          Noch keine Runs vorhanden.
        </div>
      ) : (
        <div className="max-h-44 overflow-y-auto p-2">
          <div className="space-y-2">
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                className={cn(
                  'w-full rounded-md border border-border/60 bg-card/30 p-2 text-left',
                  'transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none',
                  selectedRunId === run.id && 'border-primary/50 bg-primary/10',
                )}
                onClick={() => onSelectRun(run)}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={cn('rounded border px-2 py-0.5 text-[10px] font-medium uppercase', statusBadgeClass(run.status))}>
                    {run.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{formatDate(run.startedAt)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {run.durationMs ?? 0} ms
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    Steps: {run.totalSteps ?? 0}
                  </span>
                  {run.error ? (
                    <span className="inline-flex items-center gap-1 text-red-300">
                      <AlertCircle className="h-3 w-3" />
                      Fehler
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      OK
                    </span>
                  )}
                </div>

                {run.error && (
                  <div className="mt-1 truncate text-[11px] text-red-300/90">{run.error}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default RunHistoryPanel;
