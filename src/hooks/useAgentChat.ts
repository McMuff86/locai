"use client";

import { useState, useCallback, useRef } from 'react';
import { AgentTurn, ToolCall, ToolResult } from '@/lib/agents/types';
import type { AgentPreset } from '@/lib/agents/presets';
import { BUILTIN_TOOL_NAMES } from '@/lib/agents/tools/names';

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

interface StreamEventPlan {
  type: 'plan';
  content: string;
}

interface StreamEventMemoryContext {
  type: 'memory_context';
  count: number;
  memories: Array<{ key: string; value: string; category: string }>;
}

interface StreamEventFallback {
  type: 'fallback';
  originalProvider: string;
  originalModel: string;
  fallbackProvider: string;
  fallbackModel: string;
  reason: string;
}

type StreamEvent =
  | StreamEventToolCall
  | StreamEventToolResult
  | StreamEventMessage
  | StreamEventError
  | StreamEventTurnStart
  | StreamEventTurnEnd
  | StreamEventPlan
  | StreamEventMemoryContext
  | StreamEventFallback;

// ---------------------------------------------------------------------------
// Hook options & return type
// ---------------------------------------------------------------------------

export interface AgentSendOptions {
  enabledTools?: string[];
  maxIterations?: number;
  conversationHistory?: Array<{ role: string; content: string }>;
  /** Model name to use for agent execution */
  model?: string;
  /** Ollama host override */
  host?: string;
  /** Preset ID to use */
  presetId?: string;
  /** Whether to enable planning step */
  enablePlanning?: boolean;
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
  /** Active preset ID */
  activePreset: string | null;
  /** Select a preset (sets enabledTools from preset) */
  selectPreset: (preset: AgentPreset | null) => void;
  /** Whether planning is enabled */
  enablePlanning: boolean;
  /** Toggle planning on/off */
  togglePlanning: () => void;
  /** Plan content from the planning step */
  agentPlan: string | null;
  /** Memory context injected into the current run */
  memoryContext: Array<{ key: string; value: string; category: string }> | null;
  /** Fallback info if a provider switch occurred */
  fallbackInfo: { provider: string; model: string; reason: string } | null;
}

// ---------------------------------------------------------------------------
// Default available tools
// ---------------------------------------------------------------------------

const DEFAULT_TOOLS: string[] = [...BUILTIN_TOOL_NAMES];

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useAgentChat(): UseAgentChatReturn {
  const [agentTurns, setAgentTurns] = useState<AgentTurn[]>([]);
  const [isAgentMode, setIsAgentMode] = useState(true); // Agent Mode is the default
  const [enabledTools, setEnabledTools] = useState<string[]>(DEFAULT_TOOLS);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentStreamingContent, setAgentStreamingContent] = useState('');
  const [agentFinalContent, setAgentFinalContent] = useState<string | null>(null);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [totalTurnsEstimate, setTotalTurnsEstimate] = useState<number | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [enablePlanning, setEnablePlanning] = useState(false);
  const [agentPlan, setAgentPlan] = useState<string | null>(null);
  const [memoryContext, setMemoryContext] = useState<Array<{ key: string; value: string; category: string }> | null>(null);
  const [fallbackInfo, setFallbackInfo] = useState<{ provider: string; model: string; reason: string } | null>(null);

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
    // Deselect preset when tools are manually toggled
    setActivePreset(null);
  }, []);

  const selectPreset = useCallback((preset: AgentPreset | null) => {
    if (preset) {
      setActivePreset(preset.id);
      setEnabledTools(preset.enabledTools);
    } else {
      setActivePreset(null);
      setEnabledTools(DEFAULT_TOOLS);
    }
  }, []);

  const togglePlanning = useCallback(() => {
    setEnablePlanning(prev => !prev);
  }, []);

  const resetAgentState = useCallback(() => {
    setAgentTurns([]);
    setIsExecutingTool(false);
    setAgentStreamingContent('');
    setAgentFinalContent(null);
    setCurrentTurnIndex(0);
    setTotalTurnsEstimate(null);
    setAgentError(null);
    setAgentPlan(null);
    setMemoryContext(null);
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
          model: options?.model,
          enabledTools: options?.enabledTools ?? enabledTools,
          maxIterations: options?.maxIterations ?? 8,
          conversationHistory: options?.conversationHistory ?? [],
          host: options?.host,
          presetId: activePreset ?? options?.presetId,
          enablePlanning: options?.enablePlanning ?? enablePlanning,
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

            case 'plan': {
              setAgentPlan(event.content);
              break;
            }

            case 'memory_context': {
              setMemoryContext(event.memories);
              break;
            }

            case 'fallback': {
              setFallbackInfo({
                provider: event.fallbackProvider,
                model: event.fallbackModel,
                reason: event.reason,
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
  }, [enabledTools, resetAgentState, activePreset, enablePlanning]);

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
    activePreset,
    selectPreset,
    enablePlanning,
    togglePlanning,
    agentPlan,
    memoryContext,
  };
}

export default useAgentChat;
