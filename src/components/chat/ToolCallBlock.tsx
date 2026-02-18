"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { ToolCall, ToolResult } from '@/lib/agents/types';
import { cn } from '@/lib/utils';

// ── Tool display labels (German) ──────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  search_documents: 'Suche Dokumente',
  web_search:       'Web-Suche',
  read_file:        'Datei lesen',
  write_file:       'Datei schreiben',
  edit_file:        'Datei bearbeiten',
  create_note:      'Notiz erstellen',
  save_memory:      'Merken',
  recall_memory:    'Erinnern',
  run_command:      'Befehl ausführen',
  run_code:         'Code ausführen',
  generate_image:   'Bild generieren',
};

function getToolLabel(name: string): string {
  return TOOL_LABELS[name] || name;
}

// ── Tool emoji map ────────────────────────────────────────────────

const TOOL_EMOJI: Record<string, string> = {
  search_documents: '📄',
  web_search:       '🌐',
  read_file:        '📖',
  write_file:       '✍️',
  edit_file:        '✏️',
  create_note:      '📝',
  save_memory:      '🧠',
  recall_memory:    '💭',
  run_command:      '⚡',
  run_code:         '🔬',
  generate_image:   '🎨',
};

function getToolEmoji(name: string): string {
  return TOOL_EMOJI[name] ?? '🔧';
}

// ── Status helpers ────────────────────────────────────────────────

type ToolCallStatus = 'running' | 'success' | 'error';

function getStatus(call: ToolCall, result?: ToolResult): ToolCallStatus {
  if (!result) return 'running';
  return result.success ? 'success' : 'error';
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return '';
  if (entries.length === 1) {
    const val = entries[0][1];
    if (typeof val === 'string') return `"${val}"`;
    return JSON.stringify(val);
  }
  return JSON.stringify(args, null, 2);
}

function formatDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return '';
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Status Icon ───────────────────────────────────────────────────

function StatusIcon({ status }: { status: ToolCallStatus }) {
  if (status === 'running') {
    return (
      <motion.span
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-400/50 flex items-center justify-center shrink-0"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      </motion.span>
    );
  }
  if (status === 'success') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  }
  return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
}

// ── Component ─────────────────────────────────────────────────────

interface ToolCallBlockProps {
  call: ToolCall;
  result?: ToolResult;
  turnStartedAt: string;
  turnCompletedAt?: string;
}

export function ToolCallBlock({ call, result, turnStartedAt, turnCompletedAt }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = getStatus(call, result);
  const argsPreview = formatArgs(call.arguments);
  const duration = formatDuration(turnStartedAt, turnCompletedAt);

  return (
    <motion.div
      className={cn(
        'rounded-lg border text-sm my-1.5 overflow-hidden',
        status === 'running' && [
          'border-blue-500/30 bg-blue-950/10',
          'shadow-[0_0_0_1px_rgba(59,130,246,0.08),0_0_12px_rgba(59,130,246,0.04)]',
        ],
        status === 'success' && 'border-emerald-500/20 bg-card/60',
        status === 'error'   && [
          'border-red-500/30 bg-red-950/10',
          'shadow-[0_0_0_1px_rgba(239,68,68,0.08)]',
        ],
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2.5 text-left',
          'hover:bg-muted/30 transition-colors duration-100',
          isExpanded ? 'rounded-t-lg' : 'rounded-lg',
        )}
      >
        {/* Animated chevron */}
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className="text-muted-foreground/60 shrink-0"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </motion.span>

        {/* Status dot */}
        <StatusIcon status={status} />

        {/* Emoji + label + args preview */}
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-xs leading-none">{getToolEmoji(call.name)}</span>
          <span className="text-[13px] font-semibold text-foreground/90 truncate">
            {getToolLabel(call.name)}
          </span>
          {argsPreview && (
            <span className="font-mono text-[11px] text-muted-foreground/60 truncate hidden sm:block">
              {argsPreview.length > 50 ? argsPreview.slice(0, 50) + '…' : argsPreview}
            </span>
          )}
        </span>

        {/* Duration / running indicator */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {status === 'running' ? (
            <span className="flex items-center gap-1 text-[11px] text-blue-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>läuft…</span>
            </span>
          ) : duration ? (
            <span className="text-[11px] font-mono text-muted-foreground/60">{duration}</span>
          ) : null}
        </div>
      </button>

      {/* ── Collapsible detail ───────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-border/40">
              {/* Parameters */}
              {Object.keys(call.arguments).length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Parameter</p>
                  <pre className="text-xs font-mono bg-background/80 rounded p-2 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                    {JSON.stringify(call.arguments, null, 2)}
                  </pre>
                </div>
              )}

              {/* Result */}
              {result && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {result.success ? 'Ergebnis' : 'Fehler'}
                  </p>
                  <pre
                    className={cn(
                      'text-xs font-mono rounded p-2 overflow-x-auto max-h-60 whitespace-pre-wrap break-all',
                      result.success ? 'bg-background/80' : 'bg-red-500/10 text-red-300',
                    )}
                  >
                    {result.error || result.content}
                  </pre>
                </div>
              )}

              {/* Still running hint */}
              {!result && (
                <div className="flex items-center gap-2 mt-2 text-xs text-blue-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Wird ausgeführt…</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
