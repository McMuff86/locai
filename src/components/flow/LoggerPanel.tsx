"use client";

import React, { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  stepId?: string;
  durationMs?: number;
}

interface LoggerPanelProps {
  logs: LogEntry[];
  onClear?: () => void;
}

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  info: 'text-cyan-300',
  warn: 'text-amber-300',
  error: 'text-red-300',
};

const LEVEL_BG: Record<LogEntry['level'], string> = {
  info: '',
  warn: 'bg-amber-500/5',
  error: 'bg-red-500/5',
};

const LEVEL_LABELS: Record<LogEntry['level'], string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERR ',
};

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  } catch {
    return isoString;
  }
}

export function LoggerPanel({ logs, onClear }: LoggerPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isAutoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    isAutoScrollRef.current = atBottom;
  };

  if (logs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Keine Log-Einträge vorhanden. Starte einen Workflow um Logs zu sehen.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-1">
        <span className="text-[11px] text-muted-foreground">
          {logs.length} Einträge
        </span>
        {onClear && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            onClick={onClear}
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed"
      >
        {logs.map((log, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-2 border-b border-border/20 px-3 py-0.5',
              LEVEL_BG[log.level],
            )}
          >
            <span className="shrink-0 text-muted-foreground/60">
              {formatTime(log.timestamp)}
            </span>
            <span className={cn('shrink-0 font-semibold', LEVEL_COLORS[log.level])}>
              {LEVEL_LABELS[log.level]}
            </span>
            {log.stepId && (
              <span className="shrink-0 text-muted-foreground/50">
                [{log.stepId}]
              </span>
            )}
            <span className={cn('min-w-0', LEVEL_COLORS[log.level])}>
              {log.message}
            </span>
            {log.durationMs !== undefined && (
              <span className="ml-auto shrink-0 text-muted-foreground/50">
                {log.durationMs < 1000 ? `${log.durationMs}ms` : `${(log.durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LoggerPanel;
