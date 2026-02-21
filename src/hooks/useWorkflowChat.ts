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
// - Auto-save to IndexedDB for resume after refresh
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
  WorkflowState,
} from '@/lib/agents/workflowTypes';
import {
  saveActiveWorkflow,
  loadActiveWorkflow,
  clearActiveWorkflow,
} from '@/lib/agents/workflowPersistence';

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
  /** Restore state from a saved WorkflowState (for resume) */
  restoreWorkflowState: (state: WorkflowState) => void;
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
// Persistence helpers (fire-and-forget)
// ---------------------------------------------------------------------------

function persistSnapshot(state: WorkflowState): void {
  saveActiveWorkflow(state).catch(console.warn);
}

function clearPersistence(conversationId: string): void {
  clearActiveWorkflow(conversationId).catch(console.warn);
}

async function saveToServer(state: WorkflowState): Promise<void> {
  try {
    await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow: state }),
    });
  } catch {
    console.warn('[useWorkflowChat] Failed to save workflow to server');
  }
}

// ---------------------------------------------------------------------------
// Exported: check IndexedDB for active workflow
// ---------------------------------------------------------------------------

export async function checkActiveWorkflow(conversationId: string): Promise<WorkflowState | null> {
  const state = await loadActiveWorkflow(conversationId);
  if (!state) return null;
  // Only return if workflow was in-progress (not done/error/cancelled)
  const activeStatuses: WorkflowStatus[] = ['planning', 'executing', 'reflecting'];
  if (activeStatuses.includes(state.status)) {
    return state;
  }
  // Clean up stale entries
  clearPersistence(conversationId);
  return null;
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
  const conversationIdRef = useRef<string | undefined>(undefined);

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
    // Clear persistence on cancel
    if (conversationIdRef.current) {
      clearPersistence(conversationIdRef.current);
    }
  }, []);

  /** Restore state from a saved WorkflowState (for resume dialog) */
  const restoreWorkflowState = useCallback((state: WorkflowState) => {
    setWorkflowState({
      workflowId: state.id,
      status: state.status,
      plan: state.plan,
      steps: state.steps,
      currentStepIndex: state.currentStepIndex,
      finalAnswer: state.finalAnswer ?? null,
      streamingAnswer: '',
      error: state.errorMessage ?? null,
      startedAt: state.startedAt,
      completedAt: state.completedAt ?? null,
      durationMs: state.durationMs ?? null,
      totalSteps: state.plan?.steps.length ?? null,
      isPlanAdjusted: false,
    });
    conversationIdRef.current = state.conversationId;
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
          // Full state sync from server — also persist to IndexedDB
          const serverState = event.state;
          persistSnapshot(serverState);
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

      // Track conversationId for persistence
      conversationIdRef.current = options?.conversationId;

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
        let lastServerState: WorkflowState | null = null;

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

              // Track server state for persistence
              if (event.type === 'state_snapshot') {
                lastServerState = event.state;
              }

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
            if (event.type === 'state_snapshot') {
              lastServerState = event.state;
            }
          } catch {
            // Ignore
          }
        }

        setIsRunning(false);

        // On completion: clear IndexedDB, save to server
        if (options?.conversationId) {
          clearPersistence(options.conversationId);
        }
        if (lastServerState) {
          saveToServer(lastServerState);
        }

        // Return the accumulated final answer from state
        return finalContent || null;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          setIsRunning(false);
          // Clear persistence on abort
          if (options?.conversationId) {
            clearPersistence(options.conversationId);
          }
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
    restoreWorkflowState,
  };
}

export default useWorkflowChat;
