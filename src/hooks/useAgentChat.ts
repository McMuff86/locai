"use client";

import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AgentTurn, ToolCall, ToolResult } from '@/lib/agents/types';

// ---------------------------------------------------------------------------
// Stream event types coming from /api/chat/agent (NDJSON)
// ---------------------------------------------------------------------------

interface StreamEventToolCall {
  type: 'tool_call';
  turn: number;
  call: ToolCall;
}

interface StreamEventToolResult {
  type: 'tool_result';
  turn: number;
  result: ToolResult;
}

interface StreamEventMessage {
  type: 'message';
  content: string;
  done: boolean;
}

interface StreamEventError {
  type: 'error';
  message: string;
}

interface StreamEventTurnStart {
  type: 'turn_start';
  turn: number;
  totalEstimate?: number;
}

interface StreamEventTurnEnd {
  type: 'turn_end';
  turn: number;
}

type StreamEvent =
  | StreamEventToolCall
  | StreamEventToolResult
  | StreamEventMessage
  | StreamEventError
  | StreamEventTurnStart
  | StreamEventTurnEnd;

// ---------------------------------------------------------------------------
// Hook options & return type
// ---------------------------------------------------------------------------

export interface AgentSendOptions {
  enabledTools?: string[];
  maxIterations?: number;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface UseAgentChatReturn {
  /** Current agent turns for the active run */
  agentTurns: AgentTurn[];
  /** Whether agent mode is enabled */
  isAgentMode: boolean;
  /** Toggle agent mode on/off */
  toggleAgentMode: () => void;
  /** Set agent mode explicitly */
  setIsAgentMode: (v: boolean) => void;
  /** Which tools are enabled */
  enabledTools: string[];
  /** Toggle a specific tool */
  toggleTool: (toolName: string) => void;
  /** Set enabled tools explicitly */
  setEnabledTools: (tools: string[]) => void;
  /** Whether a tool is currently executing */
  isExecutingTool: boolean;
  /** Whether the agent is running (loading) */
  isAgentLoading: boolean;
  /** Accumulated assistant message content */
  agentStreamingContent: string;
  /** Final assistant content after run completes */
  agentFinalContent: string | null;
  /** Current turn index (for step counter) */
  currentTurnIndex: number;
  /** Estimated total turns (if provided) */
  totalTurnsEstimate: number | null;
  /** Error message if something went wrong */
  agentError: string | null;
  /** Send a message in agent mode */
  sendAgentMessage: (content: string, options?: AgentSendOptions) => Promise<string | null>;
  /** Cancel the current agent run */
  cancelAgentRun: () => void;
  /** Reset agent state for a new run */
  resetAgentState: () => void;
}

// ---------------------------------------------------------------------------
// Default available tools
// ---------------------------------------------------------------------------

const DEFAULT_TOOLS = [
  'search_documents',
  'web_search',
  'read_file',
  'create_note',
];

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useAgentChat(): UseAgentChatReturn {
  const [agentTurns, setAgentTurns] = useState<AgentTurn[]>([]);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [enabledTools, setEnabledTools] = useState<string[]>(DEFAULT_TOOLS);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentStreamingContent, setAgentStreamingContent] = useState('');
  const [agentFinalContent, setAgentFinalContent] = useState<string | null>(null);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [totalTurnsEstimate, setTotalTurnsEstimate] = useState<number | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const toggleAgentMode = useCallback(() => {
    setIsAgentMode(prev => !prev);
  }, []);

  const toggleTool = useCallback((toolName: string) => {
    setEnabledTools(prev =>
      prev.includes(toolName)
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  }, []);

  const resetAgentState = useCallback(() => {
    setAgentTurns([]);
    setIsExecutingTool(false);
    setAgentStreamingContent('');
    setAgentFinalContent(null);
    setCurrentTurnIndex(0);
    setTotalTurnsEstimate(null);
    setAgentError(null);
  }, []);

  const cancelAgentRun = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsAgentLoading(false);
    setIsExecutingTool(false);
  }, []);

  const sendAgentMessage = useCallback(async (
    content: string,
    options?: AgentSendOptions
  ): Promise<string | null> => {
    if (!content.trim()) return null;

    // Reset state for new run
    resetAgentState();
    setIsAgentLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          enabledTools: options?.enabledTools ?? enabledTools,
          maxIterations: options?.maxIterations ?? 8,
          conversationHistory: options?.conversationHistory ?? [],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agent API error ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body (streaming not supported)');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalContent = '';

      // Process NDJSON stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(trimmed) as StreamEvent;
          } catch {
            // Skip malformed lines
            continue;
          }

          switch (event.type) {
            case 'turn_start': {
              setCurrentTurnIndex(event.turn);
              if (event.totalEstimate) {
                setTotalTurnsEstimate(event.totalEstimate);
              }
              // Create a new AgentTurn entry
              setAgentTurns(prev => [
                ...prev,
                {
                  index: event.turn,
                  toolCalls: [],
                  toolResults: [],
                  startedAt: new Date().toISOString(),
                },
              ]);
              break;
            }

            case 'tool_call': {
              setIsExecutingTool(true);
              setAgentTurns(prev => {
                const updated = [...prev];
                const turnIdx = updated.findIndex(t => t.index === event.turn);
                if (turnIdx >= 0) {
                  updated[turnIdx] = {
                    ...updated[turnIdx],
                    toolCalls: [...updated[turnIdx].toolCalls, event.call],
                  };
                }
                return updated;
              });
              break;
            }

            case 'tool_result': {
              setIsExecutingTool(false);
              setAgentTurns(prev => {
                const updated = [...prev];
                const turnIdx = updated.findIndex(t => t.index === event.turn);
                if (turnIdx >= 0) {
                  updated[turnIdx] = {
                    ...updated[turnIdx],
                    toolResults: [...updated[turnIdx].toolResults, event.result],
                  };
                }
                return updated;
              });
              break;
            }

            case 'turn_end': {
              setAgentTurns(prev => {
                const updated = [...prev];
                const turnIdx = updated.findIndex(t => t.index === event.turn);
                if (turnIdx >= 0) {
                  updated[turnIdx] = {
                    ...updated[turnIdx],
                    completedAt: new Date().toISOString(),
                  };
                }
                return updated;
              });
              break;
            }

            case 'message': {
              finalContent += event.content;
              setAgentStreamingContent(finalContent);
              if (event.done) {
                setAgentFinalContent(finalContent);
              }
              break;
            }

            case 'error': {
              setAgentError(event.message);
              break;
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as StreamEvent;
          if (event.type === 'message') {
            finalContent += event.content;
            setAgentStreamingContent(finalContent);
            setAgentFinalContent(finalContent);
          }
        } catch {
          // Ignore trailing partial data
        }
      }

      setIsAgentLoading(false);
      setIsExecutingTool(false);
      return finalContent || null;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled
        setIsAgentLoading(false);
        return null;
      }
      const errMsg = error instanceof Error ? error.message : 'Unknown agent error';
      setAgentError(errMsg);
      setIsAgentLoading(false);
      setIsExecutingTool(false);
      return null;
    }
  }, [enabledTools, resetAgentState]);

  return {
    agentTurns,
    isAgentMode,
    toggleAgentMode,
    setIsAgentMode,
    enabledTools,
    toggleTool,
    setEnabledTools,
    isExecutingTool,
    isAgentLoading,
    agentStreamingContent,
    agentFinalContent,
    currentTurnIndex,
    totalTurnsEstimate,
    agentError,
    sendAgentMessage,
    cancelAgentRun,
    resetAgentState,
  };
}

export default useAgentChat;
