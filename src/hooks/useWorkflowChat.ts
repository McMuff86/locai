"use client";

// ============================================================================
// useWorkflowChat Hook
// ============================================================================
// Frontend hook for the Workflow Agent mode.
// Connects to POST /api/chat/agent/workflow and manages workflow state.
//
// Key differences from useAgentChat:
// - Uses WorkflowState (steps, plan, reflections) instead of AgentTurns
// - Parses WorkflowStreamEvent (richer event types)
// - Reflection is default ON (toggle to disable)
// - Cancel support via AbortController
// ============================================================================

import { useState, useCallback, useRef } from 'react';
import {
  WorkflowStatus,
  WorkflowPlan,
  WorkflowStep,
  WorkflowToolCall,
  WorkflowToolResult,
  WorkflowStepReflection,
  WorkflowStreamEvent,
  WorkflowApiRequest,
} from '@/lib/agents/workflowTypes';

// ---------------------------------------------------------------------------
// Internal state shape
// ---------------------------------------------------------------------------

export interface WorkflowRunState {
  workflowId: string | null;
  status: WorkflowStatus;
  plan: WorkflowPlan | null;
  steps: WorkflowStep[];
  currentStepIndex: number;
  finalAnswer: string | null;
  streamingAnswer: string;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  totalSteps: number | null;
  isPlanAdjusted: boolean;
}

// ---------------------------------------------------------------------------
// Hook options & return type
// ---------------------------------------------------------------------------

export interface WorkflowSendOptions {
  model?: string;
  enabledTools?: string[];
  maxSteps?: number;
  conversationHistory?: Array<{ role: string; content: string }>;
  host?: string;
  presetId?: string;
  conversationId?: string;
}

export interface UseWorkflowChatReturn {
  /** Current workflow run state */
  workflowState: WorkflowRunState;
  /** Whether the workflow is currently running */
  isRunning: boolean;
  /** Whether reflection is enabled (default: true per Adi's decision) */
  enableReflection: boolean;
  /** Toggle reflection on/off */
  toggleReflection: () => void;
  /** Whether planning is enabled */
  enablePlanning: boolean;
  /** Toggle planning on/off */
  togglePlanning: () => void;
  /** Send a message and start a workflow */
  sendWorkflowMessage: (content: string, options?: WorkflowSendOptions) => Promise<string | null>;
  /** Cancel the running workflow */
  cancelWorkflow: () => void;
  /** Reset workflow state */
  resetWorkflow: () => void;
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

function makeInitialState(): WorkflowRunState {
  return {
    workflowId: null,
    status: 'idle',
    plan: null,
    steps: [],
    currentStepIndex: 0,
    finalAnswer: null,
    streamingAnswer: '',
    error: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    totalSteps: null,
    isPlanAdjusted: false,
  };
}

// ---------------------------------------------------------------------------
// Hook Implementation
// ---------------------------------------------------------------------------

export function useWorkflowChat(): UseWorkflowChatReturn {
  const [workflowState, setWorkflowState] = useState<WorkflowRunState>(makeInitialState());
  const [isRunning, setIsRunning] = useState(false);
  const [enableReflection, setEnableReflection] = useState(true); // Default ON
  const [enablePlanning, setEnablePlanning] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);

  const toggleReflection = useCallback(() => {
    setEnableReflection((prev) => !prev);
  }, []);

  const togglePlanning = useCallback(() => {
    setEnablePlanning((prev) => !prev);
  }, []);

  const resetWorkflow = useCallback(() => {
    setWorkflowState(makeInitialState());
    setIsRunning(false);
  }, []);

  const cancelWorkflow = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    setWorkflowState((prev) => ({
      ...prev,
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    }));
  }, []);

  // -------------------------------------------------------------------------
  // Event Processing
  // -------------------------------------------------------------------------

  const processEvent = useCallback((event: WorkflowStreamEvent) => {
    setWorkflowState((prev) => {
      switch (event.type) {
        case 'workflow_start': {
          return {
            ...prev,
            workflowId: event.workflowId,
            status: 'planning',
            startedAt: event.timestamp,
          };
        }

        case 'plan': {
          const updated = {
            ...prev,
            plan: event.plan,
            totalSteps: event.plan.steps.length,
            status: 'executing' as WorkflowStatus,
          };
          if (event.isAdjustment) {
            updated.isPlanAdjusted = true;
          }
          return updated;
        }

        case 'step_start': {
          // Add a new step in 'running' state
          const newStep: WorkflowStep = {
            planStepId: event.stepId,
            executionIndex: event.stepIndex,
            description: event.description,
            status: 'running',
            toolCalls: [],
            toolResults: [],
            startedAt: new Date().toISOString(),
          };
          return {
            ...prev,
            status: 'executing',
            currentStepIndex: event.stepIndex,
            steps: [...prev.steps, newStep],
          };
        }

        case 'tool_call': {
          const call: WorkflowToolCall = event.call;
          return {
            ...prev,
            steps: prev.steps.map((s) =>
              s.planStepId === event.stepId
                ? { ...s, toolCalls: [...s.toolCalls, call] }
                : s,
            ),
          };
        }

        case 'tool_result': {
          const result: WorkflowToolResult = event.result;
          return {
            ...prev,
            steps: prev.steps.map((s) =>
              s.planStepId === event.stepId
                ? { ...s, toolResults: [...s.toolResults, result] }
                : s,
            ),
          };
        }

        case 'step_end': {
          return {
            ...prev,
            steps: prev.steps.map((s) =>
              s.planStepId === event.stepId
                ? {
                    ...s,
                    status: event.status,
                    completedAt: new Date().toISOString(),
                    durationMs: event.durationMs,
                  }
                : s,
            ),
          };
        }

        case 'reflection': {
          const reflection: WorkflowStepReflection = {
            assessment: event.assessment,
            nextAction: event.nextAction,
            comment: event.comment,
          };
          return {
            ...prev,
            status: 'reflecting',
            steps: prev.steps.map((s) =>
              s.planStepId === event.stepId
                ? { ...s, reflection }
                : s,
            ),
          };
        }

        case 'message': {
          const newAnswer = prev.streamingAnswer + event.content;
          return {
            ...prev,
            streamingAnswer: newAnswer,
            finalAnswer: event.done ? newAnswer : prev.finalAnswer,
            status: event.done ? 'done' : prev.status,
          };
        }

        case 'workflow_end': {
          return {
            ...prev,
            status: event.status,
            durationMs: event.durationMs,
            completedAt: new Date().toISOString(),
          };
        }

        case 'error': {
          return {
            ...prev,
            error: event.message,
            status: event.recoverable ? prev.status : 'error',
          };
        }

        case 'cancelled': {
          return {
            ...prev,
            status: 'cancelled',
            completedAt: new Date().toISOString(),
          };
        }

        case 'state_snapshot': {
          // Full state sync from server
          const serverState = event.state;
          return {
            ...prev,
            workflowId: serverState.id,
            status: serverState.status,
            plan: serverState.plan,
            steps: serverState.steps,
            currentStepIndex: serverState.currentStepIndex,
            finalAnswer: serverState.finalAnswer ?? null,
            error: serverState.errorMessage ?? null,
            durationMs: serverState.durationMs ?? null,
          };
        }

        default:
          return prev;
      }
    });
  }, []);

  // -------------------------------------------------------------------------
  // Send Message
  // -------------------------------------------------------------------------

  const sendWorkflowMessage = useCallback(
    async (content: string, options?: WorkflowSendOptions): Promise<string | null> => {
      if (!content.trim()) return null;

      // Reset for new run
      resetWorkflow();
      setIsRunning(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestBody: WorkflowApiRequest = {
        message: content,
        model: options?.model ?? 'llama3',
        conversationId: options?.conversationId,
        enabledTools: options?.enabledTools,
        maxSteps: options?.maxSteps,
        enablePlanning,
        enableReflection,
        host: options?.host,
        conversationHistory: options?.conversationHistory ?? [],
        presetId: options?.presetId,
      };

      try {
        const response = await fetch('/api/chat/agent/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Workflow API error ${response.status}: ${errText}`);
        }

        if (!response.body) {
          throw new Error('No response body from workflow endpoint');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalContent = '';

        // Parse NDJSON stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const event = JSON.parse(trimmed) as WorkflowStreamEvent;
              processEvent(event);

              if (event.type === 'message' && event.done) {
                finalContent = event.content;
              }
            } catch {
              // Skip malformed lines
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim()) as WorkflowStreamEvent;
            processEvent(event);
            if (event.type === 'message') {
              finalContent += event.content;
            }
          } catch {
            // Ignore
          }
        }

        setIsRunning(false);

        // Return the accumulated final answer from state
        return finalContent || null;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          setIsRunning(false);
          return null;
        }

        const errMsg = error instanceof Error ? error.message : 'Unknown workflow error';
        setWorkflowState((prev) => ({
          ...prev,
          error: errMsg,
          status: 'error',
        }));
        setIsRunning(false);
        return null;
      }
    },
    [enablePlanning, enableReflection, processEvent, resetWorkflow],
  );

  return {
    workflowState,
    isRunning,
    enableReflection,
    toggleReflection,
    enablePlanning,
    togglePlanning,
    sendWorkflowMessage,
    cancelWorkflow,
    resetWorkflow,
  };
}

export default useWorkflowChat;
