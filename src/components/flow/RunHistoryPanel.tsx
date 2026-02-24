"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Copy, GitCompareArrows, Play, Timer, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { WorkflowRunSummary } from '@/lib/flow/types';
import { cn } from '@/lib/utils';

interface RunHistoryPanelProps {
  runs: WorkflowRunSummary[];
  selectedRunId: string | null;
  onSelectRun: (run: WorkflowRunSummary) => void;
  onRerun?: (run: WorkflowRunSummary) => void;
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
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return parsed.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ---------- Comparison Modal ---------- */

function ComparisonView({
  runA,
  runB,
  onClose,
}: {
  runA: WorkflowRunSummary;
  runB: WorkflowRunSummary;
  onClose: () => void;
}) {
  const durationDiff = (runA.durationMs ?? 0) - (runB.durationMs ?? 0);
  const tokenDiff = (runA.tokenCount ?? 0) - (runB.tokenCount ?? 0);

  const renderSide = (run: WorkflowRunSummary, label: string) => (
    <div className="flex-1 min-w-0 space-y-2">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className={cn('rounded border px-2 py-0.5 text-[10px] font-medium uppercase inline-block', statusBadgeClass(run.status))}>
        {run.status}
      </div>
      <div className="space-y-1 text-[11px]">
        <div><span className="text-muted-foreground">Started:</span> {formatDate(run.startedAt)}</div>
        <div><span className="text-muted-foreground">Duration:</span> {formatDuration(run.durationMs ?? 0)}</div>
        <div><span className="text-muted-foreground">Steps:</span> {run.totalSteps ?? 0}</div>
        {run.modelInfo && <div><span className="text-muted-foreground">Model:</span> {run.modelInfo}</div>}
        {run.tokenCount != null && <div><span className="text-muted-foreground">Tokens:</span> {run.tokenCount}</div>}
      </div>
      {run.inputs && Object.keys(run.inputs).length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground">Inputs</div>
          {Object.entries(run.inputs).map(([nodeId, text]) => (
            <div key={nodeId} className="rounded bg-muted/20 px-2 py-1 text-[11px] break-all">
              {text || <span className="italic text-muted-foreground">leer</span>}
            </div>
          ))}
        </div>
      )}
      {run.outputResult && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground">Output</div>
          <div className="rounded bg-muted/20 px-2 py-1 text-[11px] max-h-32 overflow-y-auto break-all">
            {run.outputResult.slice(0, 500)}
            {run.outputResult.length > 500 && '…'}
          </div>
        </div>
      )}
      {run.error && (
        <div className="rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-300">{run.error}</div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="absolute inset-0 z-10 flex flex-col bg-background/95 backdrop-blur-sm rounded-md border border-border/60 overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          <GitCompareArrows className="h-3.5 w-3.5" />
          Run-Vergleich
        </span>
        <button type="button" onClick={onClose} className="rounded p-0.5 hover:bg-muted/50 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Diff indicators */}
      {(durationDiff !== 0 || tokenDiff !== 0) && (
        <div className="flex gap-3 px-3 py-1.5 border-b border-border/20 text-[10px]">
          {durationDiff !== 0 && (
            <span className={cn('font-medium', durationDiff > 0 ? 'text-red-400' : 'text-emerald-400')}>
              Duration: {durationDiff > 0 ? '+' : ''}{formatDuration(durationDiff)}
            </span>
          )}
          {tokenDiff !== 0 && (
            <span className={cn('font-medium', tokenDiff > 0 ? 'text-red-400' : 'text-emerald-400')}>
              Tokens: {tokenDiff > 0 ? '+' : ''}{tokenDiff}
            </span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 flex gap-3">
        {renderSide(runA, 'Run A')}
        <div className="w-px bg-border/40 shrink-0" />
        {renderSide(runB, 'Run B')}
      </div>
    </motion.div>
  );
}

/* ---------- Main Panel ---------- */

export function RunHistoryPanel({ runs, selectedRunId, onSelectRun, onRerun }: RunHistoryPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  const handleCopyError = useCallback((e: React.MouseEvent, run: WorkflowRunSummary) => {
    e.stopPropagation();
    if (!run.error) return;
    navigator.clipboard.writeText(run.error);
    setCopiedId(run.id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const handleToggleSelect = useCallback((e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        // Max 2 selections for comparison
        if (next.size >= 2) return prev;
        next.add(runId);
      }
      return next;
    });
    setShowComparison(false);
  }, []);

  const handleRerun = useCallback((e: React.MouseEvent, run: WorkflowRunSummary) => {
    e.stopPropagation();
    onRerun?.(run);
  }, [onRerun]);

  const comparisonRuns = useMemo(() => {
    if (selectedIds.size !== 2) return null;
    const ids = Array.from(selectedIds);
    const a = runs.find((r) => r.id === ids[0]);
    const b = runs.find((r) => r.id === ids[1]);
    if (!a || !b) return null;
    return [a, b] as const;
  }, [selectedIds, runs]);

  if (runs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Noch keine Runs vorhanden.
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto p-2">
      {/* Compare button */}
      {comparisonRuns && !showComparison && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 flex items-center justify-between"
        >
          <button
            type="button"
            onClick={() => setShowComparison(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            Vergleichen
          </button>
          <button
            type="button"
            onClick={() => { setSelectedIds(new Set()); setShowComparison(false); }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Auswahl aufheben
          </button>
        </motion.div>
      )}

      <div className="space-y-2">
        {runs.map((run) => (
          <button
            key={run.id}
            type="button"
            className={cn(
              'w-full rounded-md border border-border/60 bg-card/30 p-2 text-left',
              'transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none',
              selectedRunId === run.id && 'border-primary/50 bg-primary/10',
              selectedIds.has(run.id) && 'ring-1 ring-primary/60',
            )}
            onClick={() => onSelectRun(run)}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Multi-select checkbox */}
                <div
                  role="checkbox"
                  aria-checked={selectedIds.has(run.id)}
                  tabIndex={0}
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 rounded border transition-colors cursor-pointer',
                    selectedIds.has(run.id)
                      ? 'border-primary bg-primary/30'
                      : 'border-border/60 hover:border-muted-foreground',
                  )}
                  onClick={(e) => handleToggleSelect(e, run.id)}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') handleToggleSelect(e as unknown as React.MouseEvent, run.id); }}
                >
                  {selectedIds.has(run.id) && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <span className={cn('rounded border px-2 py-0.5 text-[10px] font-medium uppercase', statusBadgeClass(run.status))}>
                  {run.status}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Re-Run button */}
                {onRerun && (
                  <div
                    role="button"
                    tabIndex={0}
                    title="Re-Run"
                    className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground/60 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                    onClick={(e) => handleRerun(e, run)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRerun(e as unknown as React.MouseEvent, run); }}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </div>
                )}
                <span className="text-[11px] text-muted-foreground">{formatDate(run.startedAt)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {formatDuration(run.durationMs ?? 0)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3 w-3" />
                Steps: {run.totalSteps ?? 0}
              </span>
              {run.modelInfo && (
                <span className="text-[10px] text-muted-foreground/70">{run.modelInfo}</span>
              )}
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
              <div className="mt-1.5 flex items-start gap-1.5">
                <div className="min-w-0 flex-1 rounded bg-red-500/5 px-2 py-1 text-[11px] text-red-300/90">
                  {run.error}
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground"
                  title="Error kopieren"
                  onClick={(e) => handleCopyError(e, run)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCopyError(e as unknown as React.MouseEvent, run); }}
                >
                  {copiedId === run.id ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Comparison overlay */}
      <AnimatePresence>
        {showComparison && comparisonRuns && (
          <ComparisonView
            runA={comparisonRuns[0]}
            runB={comparisonRuns[1]}
            onClose={() => setShowComparison(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default RunHistoryPanel;
