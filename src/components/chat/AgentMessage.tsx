"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Bot, ChevronDown, ChevronRight, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';
import { AgentTurn } from '@/lib/agents/types';
import { ToolCallBlock } from './ToolCallBlock';
import { ChatAvatar } from './ChatAvatar';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownRenderer } from './MarkdownRenderer';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentMessageProps {
  /** The agent turns that happened during this response */
  turns: AgentTurn[];
  /** The final (or streaming) assistant message content */
  content: string;
  /** Whether the agent is still running */
  isLoading: boolean;
  /** Whether a tool is currently being executed */
  isExecutingTool: boolean;
  /** Current turn index (reserved for future progress display) */
  currentTurnIndex?: number;
  /** Total estimated turns */
  totalTurnsEstimate: number | null;
  /** Model name for display */
  modelName?: string;
  /** Error message */
  error?: string | null;
  /** Plan content from planning step */
  plan?: string | null;
}

// ---------------------------------------------------------------------------
// Progress Bar Component
// ---------------------------------------------------------------------------

function AgentProgressBar({
  currentStep,
  totalSteps,
  isLoading,
}: {
  currentStep: number;
  totalSteps: number | null;
  isLoading: boolean;
}) {
  const total = totalSteps || Math.max(currentStep + 2, 3);
  const progress = Math.min((currentStep + 1) / total, 1) * 100;

  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        {isLoading
          ? `Schritt ${currentStep + 1}${totalSteps ? `/${totalSteps}` : ''}`
          : 'Fertig'
        }
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Turn Summary (for completed turns)
// ---------------------------------------------------------------------------

function TurnSummary({
  turn,
  index,
  isLast,
}: {
  turn: AgentTurn;
  index: number;
  isLast: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(isLast);
  const isCompleted = !!turn.completedAt;
  const hasError = turn.toolResults.some((r) => !r.success);
  const toolNames = turn.toolCalls.map((c) => c.name);

  // Calculate duration
  let duration = '';
  if (turn.completedAt) {
    const ms = new Date(turn.completedAt).getTime() - new Date(turn.startedAt).getTime();
    duration = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="mb-1.5">
      {/* Collapsed summary header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 w-full text-left py-1 px-1.5 rounded-md transition-colors text-xs',
          'hover:bg-muted/40',
          isExpanded && 'bg-muted/30',
        )}
      >
        <span className="shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>

        {/* Step number */}
        <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">
          {index + 1}.
        </span>

        {/* Status icon */}
        {!isCompleted ? (
          <Loader2 className="h-3 w-3 text-blue-400 animate-spin shrink-0" />
        ) : hasError ? (
          <XCircle className="h-3 w-3 text-red-400 shrink-0" />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
        )}

        {/* Tool names */}
        <span className="flex-1 truncate text-foreground/80">
          {toolNames.length > 0
            ? toolNames.join(', ')
            : 'Keine Werkzeuge'}
        </span>

        {/* Duration */}
        {duration && (
          <span className="text-[10px] text-muted-foreground shrink-0">{duration}</span>
        )}
      </button>

      {/* Expanded tool details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-6"
          >
            {turn.toolCalls.map((call) => {
              const result = turn.toolResults.find((r) => r.callId === call.id);
              return (
                <ToolCallBlock
                  key={call.id}
                  call={call}
                  result={result}
                  turnStartedAt={turn.startedAt}
                  turnCompletedAt={turn.completedAt}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentMessage({
  turns,
  content,
  isLoading,
  isExecutingTool,
  currentTurnIndex,
  totalTurnsEstimate,
  modelName,
  error,
  plan,
}: AgentMessageProps) {
  const hasTurns = turns.length > 0;
  const hasContent = content.length > 0;
  const displayName = modelName || 'LocAI Agent';
  const timestamp = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      className="flex flex-col w-full mb-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <ChatAvatar type="ai" size={36} />
        <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
          {displayName}
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
            <Bot className="h-3 w-3" />
            Agent
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{timestamp}</span>
      </div>

      <div className="pl-[48px]">
        {/* Plan block */}
        {plan && (
          <motion.div
            className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-primary">
              <ClipboardList className="h-3.5 w-3.5" />
              Plan
            </div>
            <div className="text-sm text-foreground/80">
              <MarkdownRenderer content={plan} className="" style={{ fontSize: '0.8rem' }} />
            </div>
          </motion.div>
        )}

        {/* Progress bar */}
        {hasTurns && (
          <AgentProgressBar
            currentStep={currentTurnIndex ?? 0}
            totalSteps={totalTurnsEstimate}
            isLoading={isLoading}
          />
        )}

        {/* Collapsible turn timeline */}
        {hasTurns && (
          <div className="mb-2">
            {turns.map((turn, idx) => (
              <TurnSummary
                key={turn.index}
                turn={turn}
                index={idx}
                isLast={idx === turns.length - 1}
              />
            ))}

            {/* Thinking indicator between tool execution and final answer */}
            {isLoading && !isExecutingTool && !hasContent && (
              <motion.div
                className="flex items-center gap-2 text-xs text-muted-foreground py-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Antwort wird erstellt…</span>
              </motion.div>
            )}
          </div>
        )}

        {/* Tool execution indicator (when no turns yet) */}
        {isLoading && isExecutingTool && !hasTurns && (
          <motion.div
            className="flex items-center gap-2 text-xs text-blue-400 py-2 mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Werkzeuge werden ausgeführt…</span>
          </motion.div>
        )}

        {/* Final message content */}
        {hasContent && (
          <Card className="max-w-[95%] bg-muted/50 text-foreground">
            <CardContent className="p-3">
              <MarkdownRenderer
                content={content}
                className=""
                style={{ fontSize: 'var(--font-size-chat)' }}
              />
            </CardContent>
          </Card>
        )}

        {/* Loading indicator (no turns, no content yet) */}
        {isLoading && !hasTurns && !hasContent && !isExecutingTool && (
          <motion.div
            className="flex items-center gap-2 text-xs text-muted-foreground py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Agent denkt nach…</span>
          </motion.div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-1 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            ⚠️ {error}
          </div>
        )}
      </div>
    </motion.div>
  );
}
