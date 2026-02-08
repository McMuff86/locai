"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Loader2, CheckCircle2, XCircle, Wrench } from 'lucide-react';
import { ToolCall, ToolResult } from '@/lib/agents/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tool display name mapping (German labels)
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  search_documents: 'Suche Dokumente',
  web_search: 'Web-Suche',
  read_file: 'Datei lesen',
  create_note: 'Notiz erstellen',
  save_memory: 'Merken',
  recall_memory: 'Erinnern',
};

function getToolLabel(name: string): string {
  return TOOL_LABELS[name] || name;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

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
  if (!completedAt) return '...';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
        'rounded-lg border text-sm my-1.5 overflow-hidden transition-colors',
        status === 'running' && 'border-blue-500/40 bg-blue-500/5',
        status === 'success' && 'border-emerald-500/30 bg-muted/60',
        status === 'error' && 'border-red-500/40 bg-red-500/5',
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header row */}
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        {/* Expand icon */}
        <span className="text-muted-foreground shrink-0">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>

        {/* Status icon */}
        <span className="shrink-0">
          {status === 'running' && (
            <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          )}
          {status === 'error' && (
            <XCircle className="h-4 w-4 text-red-400" />
          )}
        </span>

        {/* Tool name + args preview */}
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground truncate">
            {getToolLabel(call.name)}
          </span>
          {argsPreview && (
            <span className="font-mono text-xs text-muted-foreground truncate">
              ({argsPreview.length > 50 ? argsPreview.slice(0, 50) + '…' : argsPreview})
            </span>
          )}
        </span>

        {/* Duration badge */}
        <span className="text-xs text-muted-foreground shrink-0 ml-auto">
          {duration}
        </span>
      </button>

      {/* Collapsible detail area */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
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
                      result.success
                        ? 'bg-background/80'
                        : 'bg-red-500/10 text-red-300',
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
