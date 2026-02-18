"use client";

// ============================================================================
// WorkflowProgress Component
// ============================================================================
// Visualizes the Workflow Engine's step-by-step execution.
// Shows: Plan → Steps (with tool calls) → Reflections → Final Answer
// ============================================================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ClipboardList,
  Lightbulb,
  Wrench,
  RefreshCw,
  AlertCircle,
  SkipForward,
  Clock,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownRenderer } from './MarkdownRenderer';
import type {
  WorkflowRunState,
} from '@/hooks/useWorkflowChat';
import type {
  WorkflowStep,
  WorkflowPlan,
  WorkflowStepStatus,
  WorkflowStatus,
} from '@/lib/agents/workflowTypes';

// ---------------------------------------------------------------------------
// Tool Emoji Map
// ---------------------------------------------------------------------------

const TOOL_EMOJI: Record<string, string> = {
  web_search: '🌐',
  search_documents: '📚',
  read_file: '📄',
  write_file: '✍️',
  edit_file: '✏️',
  create_note: '📝',
  save_memory: '💾',
  recall_memory: '🧠',
  run_command: '⚡',
  run_code: '💻',
  generate_image: '🎨',
};

function getToolEmoji(toolName: string): string {
  return TOOL_EMOJI[toolName] ?? '🔧';
}

// ---------------------------------------------------------------------------
// Status Icon Component
// ---------------------------------------------------------------------------

function StatusIcon({
  status,
  size = 14,
}: {
  status: WorkflowStepStatus | WorkflowStatus | 'running_tool';
  size?: number;
}) {
  const s = size;

  switch (status) {
    case 'success':
    case 'done':
      return <CheckCircle2 width={s} height={s} className="text-emerald-400 shrink-0" />;
    case 'failed':
    case 'error':
      return <XCircle width={s} height={s} className="text-red-400 shrink-0" />;
    case 'running':
    case 'executing':
    case 'running_tool':
      return <Loader2 width={s} height={s} className="text-blue-400 animate-spin shrink-0" />;
    case 'reflecting':
      return <RefreshCw width={s} height={s} className="text-amber-400 animate-spin shrink-0" />;
    case 'planning':
      return <Loader2 width={s} height={s} className="text-purple-400 animate-spin shrink-0" />;
    case 'skipped':
      return <SkipForward width={s} height={s} className="text-muted-foreground shrink-0" />;
    case 'cancelled':
      return <AlertCircle width={s} height={s} className="text-orange-400 shrink-0" />;
    case 'timeout':
      return <Clock width={s} height={s} className="text-orange-400 shrink-0" />;
    default:
      return <div style={{ width: s, height: s }} className="rounded-full bg-muted-foreground/30 shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// Workflow Plan Display
// ---------------------------------------------------------------------------

function WorkflowPlanDisplay({ plan, isAdjusted }: { plan: WorkflowPlan; isAdjusted: boolean }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <motion.div
      className="mb-3 rounded-lg border border-purple-500/20 bg-purple-500/5"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="flex items-center gap-2 w-full p-2.5 text-left"
      >
        <ClipboardList className="h-3.5 w-3.5 text-purple-400 shrink-0" />
        <span className="text-xs font-semibold text-purple-300 flex-1">
          {isAdjusted ? '🔄 Plan angepasst' : '📋 Ausführungsplan'}
          <span className="ml-2 text-[10px] text-purple-300/60 font-normal">
            v{plan.version} · {plan.steps.length} Schritte
          </span>
        </span>
        <motion.span animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.15 }}>
          <ChevronDown className="h-3 w-3 text-purple-400/60" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5">
              {/* Goal */}
              <div className="flex items-start gap-1.5 mb-2 text-xs text-purple-200/70">
                <Target className="h-3 w-3 shrink-0 mt-0.5 text-purple-400" />
                <span>{plan.goal}</span>
              </div>

              {/* Steps */}
              <ol className="space-y-1">
                {plan.steps.map((step, i) => (
                  <li key={step.id} className="flex items-start gap-2 text-xs text-foreground/70">
                    <span className="text-[10px] font-mono text-purple-400/70 w-4 shrink-0 mt-0.5">
                      {i + 1}.
                    </span>
                    <span className="flex-1">{step.description}</span>
                    {step.expectedTools.length > 0 && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {step.expectedTools.map((t) => getToolEmoji(t)).join(' ')}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Single Step Display
// ---------------------------------------------------------------------------

function WorkflowStepDisplay({
  step,
  index,
  isLast,
  isCurrentlyRunning,
}: {
  step: WorkflowStep;
  index: number;
  isLast: boolean;
  isCurrentlyRunning: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(isLast);

  const duration =
    step.durationMs !== undefined
      ? step.durationMs < 1000
        ? `${step.durationMs}ms`
        : `${(step.durationMs / 1000).toFixed(1)}s`
      : null;

  const hasReflection = !!step.reflection;
  const toolsUsed = [...new Set(step.toolCalls.map((c) => c.name))];

  return (
    <motion.div
      className="mb-1.5"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Step Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((p) => !p)}
        className={cn(
          'flex items-center gap-1.5 w-full text-left py-1 px-1.5 rounded-md transition-colors text-xs',
          'hover:bg-muted/40',
          isExpanded && 'bg-muted/30',
          isCurrentlyRunning && 'bg-blue-500/5',
        )}
      >
        <motion.span animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.15 }}>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </motion.span>

        <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">
          {index + 1}.
        </span>

        <StatusIcon status={step.status} size={12} />

        <span className="flex-1 truncate text-foreground/80">{step.description}</span>

        {toolsUsed.length > 0 && (
          <span className="text-[11px] shrink-0">
            {toolsUsed.map((t) => getToolEmoji(t)).join(' ')}
          </span>
        )}

        {duration && (
          <span className="text-[10px] text-muted-foreground shrink-0">{duration}</span>
        )}
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-6"
          >
            {/* Tool Calls & Results */}
            {step.toolCalls.map((call) => {
              const result = step.toolResults.find((r) => r.callId === call.id);
              return (
                <ToolCallRow key={call.id} call={call} result={result} />
              );
            })}

            {/* Running indicator when no calls yet */}
            {step.status === 'running' && step.toolCalls.length === 0 && (
              <div className="flex items-center gap-1.5 py-1.5 text-xs text-blue-400/80">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Tool wird ausgewählt…</span>
              </div>
            )}

            {/* Reflection */}
            {hasReflection && step.reflection && (
              <ReflectionBadge reflection={step.reflection} />
            )}

            {/* Error */}
            {step.error && (
              <div className="mt-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                ⚠️ {step.error}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tool Call Row
// ---------------------------------------------------------------------------

function ToolCallRow({
  call,
  result,
}: {
  call: { id: string; name: string; arguments: Record<string, unknown> };
  result?: { success: boolean; content: string; error?: string };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const emoji = getToolEmoji(call.name);
  const isPending = !result;
  const hasError = result && !result.success;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="flex items-center gap-1.5 w-full text-left py-0.5 px-1 rounded text-xs hover:bg-muted/20 transition-colors"
      >
        <span>{emoji}</span>
        <span className="font-mono text-[11px] text-foreground/70">{call.name}</span>

        {isPending ? (
          <Loader2 className="h-3 w-3 text-blue-400 animate-spin ml-auto shrink-0" />
        ) : hasError ? (
          <XCircle className="h-3 w-3 text-red-400 ml-auto shrink-0" />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-auto shrink-0" />
        )}

        <motion.span animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.15 }}>
          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/50" />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden pl-4"
          >
            {/* Arguments */}
            <div className="mt-1 rounded bg-muted/20 border border-border/30 p-1.5">
              <div className="text-[10px] text-muted-foreground mb-0.5 font-semibold">
                Argumente:
              </div>
              <pre className="text-[10px] text-foreground/70 whitespace-pre-wrap break-all overflow-hidden">
                {JSON.stringify(call.arguments, null, 2)}
              </pre>
            </div>

            {/* Result */}
            {result && (
              <div
                className={cn(
                  'mt-1 rounded border p-1.5',
                  result.success
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-red-500/5 border-red-500/20',
                )}
              >
                <div className="text-[10px] text-muted-foreground mb-0.5 font-semibold">
                  Ergebnis:
                </div>
                <div className="text-[10px] text-foreground/70 whitespace-pre-wrap break-all overflow-hidden max-h-32">
                  {result.success ? result.content.slice(0, 500) : result.error}
                  {result.success && result.content.length > 500 && (
                    <span className="text-muted-foreground"> …(abgeschnitten)</span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reflection Badge
// ---------------------------------------------------------------------------

function ReflectionBadge({
  reflection,
}: {
  reflection: {
    assessment: 'success' | 'partial' | 'failure';
    nextAction: 'continue' | 'adjust_plan' | 'complete' | 'abort';
    comment?: string;
  };
}) {
  const assessmentColors = {
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    partial: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    failure: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  const actionLabels: Record<string, string> = {
    continue: '→ Weiter',
    adjust_plan: '🔄 Plan anpassen',
    complete: '✅ Abschließen',
    abort: '🛑 Abbrechen',
  };

  return (
    <motion.div
      className={cn(
        'flex items-start gap-1.5 mt-1.5 rounded border p-1.5 text-[10px]',
        assessmentColors[reflection.assessment],
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold mr-1">
          Reflection:
        </span>
        <span className="mr-1">{reflection.assessment}</span>
        <span className="opacity-70">{actionLabels[reflection.nextAction] ?? reflection.nextAction}</span>
        {reflection.comment && (
          <div className="mt-0.5 opacity-80">{reflection.comment}</div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

function WorkflowProgressBar({
  current,
  total,
  status,
}: {
  current: number;
  total: number | null;
  status: WorkflowStatus;
}) {
  const isRunning = ['planning', 'executing', 'reflecting'].includes(status);
  const totalSteps = total ?? Math.max(current + 2, 3);
  const pct = Math.min((current + 1) / totalSteps, 1) * 100;

  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            status === 'done'
              ? 'bg-emerald-500'
              : status === 'error' || status === 'cancelled'
              ? 'bg-red-500'
              : 'bg-primary',
          )}
          initial={{ width: 0 }}
          animate={{ width: status === 'done' ? '100%' : `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono">
        {isRunning
          ? `${current + 1}${total ? `/${total}` : ''}` + ' Schritte'
          : status === 'done'
          ? '✓ Fertig'
          : status === 'cancelled'
          ? '⊘ Abgebrochen'
          : status === 'error'
          ? '✗ Fehler'
          : status}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main WorkflowProgress Component
// ---------------------------------------------------------------------------

interface WorkflowProgressProps {
  /** Current workflow run state from useWorkflowChat */
  workflowState: WorkflowRunState;
  /** Whether the workflow is currently running */
  isRunning: boolean;
  /** Final answer content (streaming or complete) */
  content: string;
  /** Model name for display */
  modelName?: string;
  /** Whether reflection is enabled */
  enableReflection: boolean;
}

export function WorkflowProgress({
  workflowState,
  isRunning,
  content,
  modelName,
  enableReflection,
}: WorkflowProgressProps) {
  const {
    status,
    plan,
    steps,
    currentStepIndex,
    totalSteps,
    error,
    isPlanAdjusted,
  } = workflowState;

  const hasSteps = steps.length > 0;
  const hasContent = content.length > 0;
  const isTerminal = ['done', 'cancelled', 'error', 'timeout'].includes(status);

  return (
    <div className="w-full">
      {/* Status badge */}
      <div className="flex items-center gap-2 mb-2">
        <StatusIcon status={status} size={14} />
        <span className="text-xs text-muted-foreground">
          {status === 'planning' && 'Plant Ausführung…'}
          {status === 'executing' && `Führt Schritt ${currentStepIndex + 1} aus…`}
          {status === 'reflecting' && 'Bewertet Ergebnis…'}
          {status === 'done' && 'Abgeschlossen'}
          {status === 'cancelled' && 'Abgebrochen'}
          {status === 'error' && 'Fehler aufgetreten'}
          {status === 'timeout' && 'Timeout'}
          {status === 'idle' && 'Warte…'}
        </span>
        {modelName && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground ml-auto">
            {modelName}
          </span>
        )}
        {enableReflection && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 flex items-center gap-0.5">
            <Lightbulb className="h-2.5 w-2.5" />
            Reflection
          </span>
        )}
      </div>

      {/* Progress bar */}
      {(hasSteps || isRunning) && (
        <WorkflowProgressBar
          current={currentStepIndex}
          total={totalSteps}
          status={status}
        />
      )}

      {/* Plan display */}
      {plan && (
        <WorkflowPlanDisplay plan={plan} isAdjusted={isPlanAdjusted} />
      )}

      {/* Steps timeline */}
      {hasSteps && (
        <div className="mb-2">
          {steps.map((step, idx) => (
            <WorkflowStepDisplay
              key={`${step.planStepId}-${idx}`}
              step={step}
              index={idx}
              isLast={idx === steps.length - 1}
              isCurrentlyRunning={isRunning && idx === currentStepIndex}
            />
          ))}

          {/* "Generating answer" indicator */}
          {isRunning && !hasContent && isTerminal === false && steps.every((s) => s.status !== 'running') && (
            <motion.div
              className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Erstelle Antwort…</span>
            </motion.div>
          )}
        </div>
      )}

      {/* Planning indicator (before any steps) */}
      {isRunning && !hasSteps && status === 'planning' && (
        <motion.div
          className="flex items-center gap-2 py-2 text-xs text-purple-400/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Erstelle Ausführungsplan…</span>
        </motion.div>
      )}

      {/* Initial loading */}
      {isRunning && !hasSteps && status === 'idle' && (
        <motion.div
          className="flex items-center gap-2 py-2 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Workflow startet…</span>
        </motion.div>
      )}

      {/* Final answer */}
      {hasContent && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="max-w-[95%] bg-muted/50 text-foreground mt-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                <Wrench className="h-3 w-3" />
                <span>Antwort</span>
              </div>
              <MarkdownRenderer
                content={content}
                className=""
                style={{ fontSize: 'var(--font-size-chat)' }}
              />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Error display */}
      {error && (
        <motion.div
          className="mt-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          ⚠️ {error}
        </motion.div>
      )}
    </div>
  );
}
