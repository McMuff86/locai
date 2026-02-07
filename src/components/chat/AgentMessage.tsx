"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Bot } from 'lucide-react';
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

      {/* Tool call turns */}
      {hasTurns && (
        <div className={cn('pl-[48px] mb-2')}>
          {turns.map((turn, idx) => (
            <div key={turn.index} className="mb-2">
              {/* Step counter */}
              {turns.length > 1 && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Schritt {idx + 1}
                    {totalTurnsEstimate ? `/${totalTurnsEstimate}` : turns.length > 1 ? `/${turns.length}` : ''}
                  </span>
                  {!turn.completedAt && (
                    <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
                  )}
                </div>
              )}

              {/* Tool calls for this turn */}
              {turn.toolCalls.map(call => {
                const result = turn.toolResults.find(r => r.callId === call.id);
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
            </div>
          ))}

          {/* Thinking indicator between tool execution and final answer */}
          {isLoading && !isExecutingTool && hasTurns && !hasContent && (
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
        <div className="pl-[48px] mb-2">
          <motion.div
            className="flex items-center gap-2 text-xs text-blue-400 py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Werkzeuge werden ausgeführt…</span>
          </motion.div>
        </div>
      )}

      {/* Final message content */}
      {hasContent && (
        <div className={cn('pl-[48px]')}>
          <Card className="max-w-[95%] bg-muted/50 text-foreground">
            <CardContent className="p-3">
              <MarkdownRenderer
                content={content}
                className=""
                style={{ fontSize: 'var(--font-size-chat)' }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading indicator (no turns, no content yet) */}
      {isLoading && !hasTurns && !hasContent && !isExecutingTool && (
        <div className="pl-[48px]">
          <motion.div
            className="flex items-center gap-2 text-xs text-muted-foreground py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Agent denkt nach…</span>
          </motion.div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="pl-[48px] mt-1">
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            ⚠️ {error}
          </div>
        </div>
      )}
    </motion.div>
  );
}
