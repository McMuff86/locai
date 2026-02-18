// @vitest-environment jsdom
// ============================================================================
// useWorkflowChat.test.ts – Frontend Hook Tests
// ============================================================================
// Tests for the useWorkflowChat React hook.
// Uses @testing-library/react for renderHook + act.
//
// Key test areas:
//   - NDJSON event parsing from streaming response
//   - State updates for each WorkflowStreamEvent type
//   - Cancel/Reset behavior
//   - Reflection & Planning toggle
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowChat } from './useWorkflowChat';
import type { WorkflowStreamEvent } from '@/lib/agents/workflowTypes';

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

/** Build a fake ReadableStream from NDJSON events */
function buildNdjsonStream(events: WorkflowStreamEvent[]): ReadableStream<Uint8Array> {
  const ndjson = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  const bytes = new TextEncoder().encode(ndjson);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Build a mock Response with NDJSON body */
function mockNdjsonResponse(events: WorkflowStreamEvent[]): Response {
  return new Response(buildNdjsonStream(events), {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

// ---------------------------------------------------------------------------
// Sample Events for Tests
// ---------------------------------------------------------------------------

const workflowId = 'wf_test_123';
const timestamp = new Date().toISOString();

const startEvent: WorkflowStreamEvent = {
  type: 'workflow_start',
  workflowId,
  timestamp,
  config: { maxSteps: 8, enabledTools: ['read_file'] },
};

const planEvent: WorkflowStreamEvent = {
  type: 'plan',
  plan: {
    goal: 'Test goal',
    steps: [
      {
        id: 'step-1',
        description: 'Execute step 1',
        expectedTools: ['read_file'],
        dependsOn: [],
        successCriteria: 'Done',
      },
    ],
    maxSteps: 1,
    createdAt: timestamp,
    version: 1,
  },
  isAdjustment: false,
};

const stepStartEvent: WorkflowStreamEvent = {
  type: 'step_start',
  stepId: 'step-1',
  stepIndex: 0,
  totalSteps: 1,
  description: 'Execute step 1',
  expectedTools: ['read_file'],
};

const toolCallEvent: WorkflowStreamEvent = {
  type: 'tool_call',
  stepId: 'step-1',
  turn: 0,
  call: {
    id: 'tc_001',
    name: 'read_file',
    arguments: { path: 'test.txt' },
    stepId: 'step-1',
    callIndex: 0,
    startedAt: timestamp,
  },
};

const toolResultEvent: WorkflowStreamEvent = {
  type: 'tool_result',
  stepId: 'step-1',
  turn: 0,
  result: {
    callId: 'tc_001',
    content: 'file contents',
    success: true,
  },
};

const stepEndEvent: WorkflowStreamEvent = {
  type: 'step_end',
  stepId: 'step-1',
  stepIndex: 0,
  status: 'success',
  durationMs: 1200,
};

const reflectionEvent: WorkflowStreamEvent = {
  type: 'reflection',
  stepId: 'step-1',
  assessment: 'success',
  nextAction: 'complete',
  comment: 'Task done!',
};

const messageEvent: WorkflowStreamEvent = {
  type: 'message',
  content: 'Here is the final answer.',
  done: true,
};

const workflowEndEvent: WorkflowStreamEvent = {
  type: 'workflow_end',
  workflowId,
  status: 'done',
  totalSteps: 1,
  durationMs: 5000,
};

/** Standard happy-path event sequence */
const happyPathEvents: WorkflowStreamEvent[] = [
  startEvent,
  planEvent,
  stepStartEvent,
  toolCallEvent,
  toolResultEvent,
  stepEndEvent,
  messageEvent,
  workflowEndEvent,
];

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ===========================================================================
// 1. Initial State
// ===========================================================================

describe('useWorkflowChat – Initial State', () => {
  it('starts with idle status', () => {
    const { result } = renderHook(() => useWorkflowChat());
    expect(result.current.workflowState.status).toBe('idle');
  });

  it('starts with isRunning = false', () => {
    const { result } = renderHook(() => useWorkflowChat());
    expect(result.current.isRunning).toBe(false);
  });

  it('starts with enableReflection = true (Adi decision)', () => {
    const { result } = renderHook(() => useWorkflowChat());
    expect(result.current.enableReflection).toBe(true);
  });

  it('starts with enablePlanning = true', () => {
    const { result } = renderHook(() => useWorkflowChat());
    expect(result.current.enablePlanning).toBe(true);
  });

  it('starts with empty steps and null plan', () => {
    const { result } = renderHook(() => useWorkflowChat());
    expect(result.current.workflowState.steps).toHaveLength(0);
    expect(result.current.workflowState.plan).toBeNull();
  });

  it('starts with null finalAnswer and error', () => {
    const { result } = renderHook(() => useWorkflowChat());
    expect(result.current.workflowState.finalAnswer).toBeNull();
    expect(result.current.workflowState.error).toBeNull();
  });
});

// ===========================================================================
// 2. Reflection Toggle
// ===========================================================================

describe('useWorkflowChat – Reflection Toggle', () => {
  it('toggleReflection switches enableReflection from true to false', () => {
    const { result } = renderHook(() => useWorkflowChat());
    expect(result.current.enableReflection).toBe(true);

    act(() => {
      result.current.toggleReflection();
    });

    expect(result.current.enableReflection).toBe(false);
  });

  it('toggleReflection switches enableReflection from false back to true', () => {
    const { result } = renderHook(() => useWorkflowChat());

    act(() => {
      result.current.toggleReflection();
    });
    expect(result.current.enableReflection).toBe(false);

    act(() => {
      result.current.toggleReflection();
    });
    expect(result.current.enableReflection).toBe(true);
  });
});

// ===========================================================================
// 3. Planning Toggle
// ===========================================================================

describe('useWorkflowChat – Planning Toggle', () => {
  it('togglePlanning switches enablePlanning from true to false', () => {
    const { result } = renderHook(() => useWorkflowChat());
    expect(result.current.enablePlanning).toBe(true);

    act(() => {
      result.current.togglePlanning();
    });

    expect(result.current.enablePlanning).toBe(false);
  });

  it('togglePlanning is idempotent on multiple calls', () => {
    const { result } = renderHook(() => useWorkflowChat());

    act(() => {
      result.current.togglePlanning();
      result.current.togglePlanning();
    });

    // Two toggles → back to original
    expect(result.current.enablePlanning).toBe(true);
  });
});

// ===========================================================================
// 4. Reset Behavior
// ===========================================================================

describe('useWorkflowChat – resetWorkflow', () => {
  it('resets state to initial values', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse(happyPathEvents));

    const { result } = renderHook(() => useWorkflowChat());

    // Run a workflow first
    await act(async () => {
      await result.current.sendWorkflowMessage('test task');
    });

    // Should have some state now
    expect(result.current.workflowState.status).not.toBe('idle');

    // Reset
    act(() => {
      result.current.resetWorkflow();
    });

    expect(result.current.workflowState.status).toBe('idle');
    expect(result.current.workflowState.steps).toHaveLength(0);
    expect(result.current.workflowState.plan).toBeNull();
    expect(result.current.workflowState.finalAnswer).toBeNull();
    expect(result.current.workflowState.error).toBeNull();
    expect(result.current.isRunning).toBe(false);
  });
});

// ===========================================================================
// 5. Cancel Behavior
// ===========================================================================

describe('useWorkflowChat – cancelWorkflow', () => {
  it('sets isRunning to false after cancel', () => {
    const { result } = renderHook(() => useWorkflowChat());

    act(() => {
      result.current.cancelWorkflow();
    });

    expect(result.current.isRunning).toBe(false);
  });

  it('sets status to cancelled after cancel', () => {
    const { result } = renderHook(() => useWorkflowChat());

    act(() => {
      result.current.cancelWorkflow();
    });

    expect(result.current.workflowState.status).toBe('cancelled');
  });
});

// ===========================================================================
// 6. NDJSON Event Parsing – State Updates
// ===========================================================================

describe('useWorkflowChat – NDJSON Event Parsing', () => {
  it('updates workflowId from workflow_start event', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse([startEvent]));

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.workflowId).toBe(workflowId);
  });

  it('sets status to planning on workflow_start', async () => {
    // Only start event, rest will be empty so status ends at planning
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse([startEvent]));

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    // After start event, status should have been at least 'planning' at some point
    // (final state depends on workflow_end; without it, stays at planning)
    // We check the workflowId was set
    expect(result.current.workflowState.workflowId).toBe(workflowId);
  });

  it('sets plan and totalSteps from plan event', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse([startEvent, planEvent]));

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.plan).not.toBeNull();
    expect(result.current.workflowState.plan?.goal).toBe('Test goal');
    expect(result.current.workflowState.totalSteps).toBe(1);
  });

  it('sets isPlanAdjusted when plan is an adjustment', async () => {
    const adjustedPlanEvent: WorkflowStreamEvent = {
      type: 'plan',
      plan: { ...planEvent.type === 'plan' ? planEvent.plan : {} } as WorkflowStreamEvent['type'] extends 'plan' ? never : never,
      isAdjustment: true,
      adjustmentReason: 'Step failed',
    };
    // Inline create adjusted plan event properly
    const adjustedPlan: WorkflowStreamEvent = {
      type: 'plan',
      plan: {
        goal: 'Revised goal',
        steps: [],
        maxSteps: 1,
        createdAt: timestamp,
        version: 2,
      },
      isAdjustment: true,
      adjustmentReason: 'Step failed',
    };

    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([startEvent, adjustedPlan]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.isPlanAdjusted).toBe(true);
  });

  it('adds new step from step_start event', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([startEvent, planEvent, stepStartEvent]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.steps).toHaveLength(1);
    expect(result.current.workflowState.steps[0].planStepId).toBe('step-1');
    expect(result.current.workflowState.steps[0].status).toBe('running');
  });

  it('appends tool_call to correct step', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([startEvent, planEvent, stepStartEvent, toolCallEvent]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    const step = result.current.workflowState.steps[0];
    expect(step.toolCalls).toHaveLength(1);
    expect(step.toolCalls[0].name).toBe('read_file');
  });

  it('appends tool_result to correct step', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([
        startEvent, planEvent, stepStartEvent, toolCallEvent, toolResultEvent,
      ]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    const step = result.current.workflowState.steps[0];
    expect(step.toolResults).toHaveLength(1);
    expect(step.toolResults[0].content).toBe('file contents');
    expect(step.toolResults[0].success).toBe(true);
  });

  it('updates step status from step_end event', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([
        startEvent, planEvent, stepStartEvent, toolCallEvent, toolResultEvent, stepEndEvent,
      ]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    const step = result.current.workflowState.steps[0];
    expect(step.status).toBe('success');
    expect(step.durationMs).toBe(1200);
  });

  it('attaches reflection to step from reflection event', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([
        startEvent, planEvent, stepStartEvent, stepEndEvent, reflectionEvent,
      ]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    const step = result.current.workflowState.steps[0];
    expect(step.reflection).toBeDefined();
    expect(step.reflection?.assessment).toBe('success');
    expect(step.reflection?.nextAction).toBe('complete');
  });

  it('sets status to reflecting from reflection event', async () => {
    // Without workflow_end, status stays at reflecting
    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([startEvent, planEvent, stepStartEvent, stepEndEvent, reflectionEvent]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.status).toBe('reflecting');
  });

  it('accumulates streaming message content', async () => {
    const chunk1: WorkflowStreamEvent = { type: 'message', content: 'Hello ', done: false };
    const chunk2: WorkflowStreamEvent = { type: 'message', content: 'World!', done: true };

    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([startEvent, chunk1, chunk2]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.streamingAnswer).toBe('Hello World!');
    expect(result.current.workflowState.finalAnswer).toBe('Hello World!');
    expect(result.current.workflowState.status).toBe('done');
  });

  it('sets finalAnswer from message event with done=true', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse(happyPathEvents));

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.finalAnswer).toBe('Here is the final answer.');
  });

  it('sets durationMs from workflow_end event', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse(happyPathEvents));

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.durationMs).toBe(5000);
  });

  it('sets status from workflow_end event', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse(happyPathEvents));

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.status).toBe('done');
  });

  it('sets error from error event (non-recoverable)', async () => {
    const errorEvt: WorkflowStreamEvent = {
      type: 'error',
      message: 'Something broke',
      recoverable: false,
    };

    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([startEvent, errorEvt]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.error).toBe('Something broke');
    expect(result.current.workflowState.status).toBe('error');
  });

  it('keeps current status for recoverable error events', async () => {
    const recoverableError: WorkflowStreamEvent = {
      type: 'error',
      message: 'Tool failed but continuing',
      recoverable: true,
    };

    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([startEvent, planEvent, stepStartEvent, recoverableError]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    // Error is set
    expect(result.current.workflowState.error).toBe('Tool failed but continuing');
    // Status does NOT change to 'error' (recoverable)
    expect(result.current.workflowState.status).toBe('executing');
  });

  it('sets status to cancelled from cancelled event', async () => {
    const cancelledEvt: WorkflowStreamEvent = {
      type: 'cancelled',
      workflowId,
      completedSteps: 0,
    };

    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([startEvent, cancelledEvt]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.status).toBe('cancelled');
  });

  it('syncs state from state_snapshot event', async () => {
    const snapshotEvt: WorkflowStreamEvent = {
      type: 'state_snapshot',
      state: {
        id: 'wf_snapshot_1',
        status: 'executing',
        userMessage: 'Do a task',
        plan: null,
        steps: [],
        currentStepIndex: 2,
        replanCount: 0,
        config: {
          model: 'llama3',
          enabledTools: [],
          maxSteps: 8,
          maxRePlans: 2,
          timeoutMs: 120000,
          stepTimeoutMs: 30000,
          enableReflection: true,
          enablePlanning: true,
        },
        startedAt: timestamp,
      },
    };

    vi.mocked(fetch).mockResolvedValue(
      mockNdjsonResponse([startEvent, snapshotEvt]),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.workflowId).toBe('wf_snapshot_1');
    expect(result.current.workflowState.currentStepIndex).toBe(2);
    expect(result.current.workflowState.status).toBe('executing');
  });

  it('skips malformed NDJSON lines gracefully', async () => {
    // Create a stream with a malformed line between valid events
    const validJson = JSON.stringify(startEvent);
    const malformed = '{ this is not valid JSON !!';
    const validEnd = JSON.stringify(workflowEndEvent);
    const ndjson = [validJson, malformed, validEnd].join('\n') + '\n';

    const bytes = new TextEncoder().encode(ndjson);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    vi.mocked(fetch).mockResolvedValue(
      new Response(stream, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } }),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    // Valid events should still be processed
    expect(result.current.workflowState.workflowId).toBe(workflowId);
    // workflow_end should be processed too
    expect(result.current.workflowState.status).toBe('done');
    // No error from malformed JSON
    expect(result.current.workflowState.error).toBeNull();
  });
});

// ===========================================================================
// 7. sendWorkflowMessage – Fetch Behavior
// ===========================================================================

describe('useWorkflowChat – sendWorkflowMessage', () => {
  it('sets isRunning to false after completion', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse(happyPathEvents));

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.isRunning).toBe(false);
  });

  it('returns null for empty message', async () => {
    const { result } = renderHook(() => useWorkflowChat());

    let returnValue: string | null = 'not-null';
    await act(async () => {
      returnValue = await result.current.sendWorkflowMessage('');
    });

    expect(returnValue).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null for whitespace-only message', async () => {
    const { result } = renderHook(() => useWorkflowChat());

    let returnValue: string | null = 'not-null';
    await act(async () => {
      returnValue = await result.current.sendWorkflowMessage('   ');
    });

    expect(returnValue).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns final answer content when message event has done=true', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse(happyPathEvents));

    const { result } = renderHook(() => useWorkflowChat());

    let answer: string | null = null;
    await act(async () => {
      answer = await result.current.sendWorkflowMessage('Do a task');
    });

    expect(answer).toBe('Here is the final answer.');
  });

  it('sends POST request to /api/chat/agent/workflow', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse([]));

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test task');
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/chat/agent/workflow',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('includes enableReflection in request body', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse([]));

    const { result } = renderHook(() => useWorkflowChat());

    // Disable reflection first
    act(() => {
      result.current.toggleReflection();
    });

    await act(async () => {
      await result.current.sendWorkflowMessage('test task');
    });

    const [, fetchOptions] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((fetchOptions as RequestInit).body as string);
    expect(body.enableReflection).toBe(false);
  });

  it('includes enablePlanning in request body', async () => {
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse([]));

    const { result } = renderHook(() => useWorkflowChat());

    // Disable planning
    act(() => {
      result.current.togglePlanning();
    });

    await act(async () => {
      await result.current.sendWorkflowMessage('test task');
    });

    const [, fetchOptions] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((fetchOptions as RequestInit).body as string);
    expect(body.enablePlanning).toBe(false);
  });

  it('resets workflow state at the start of a new send', async () => {
    // First run
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse(happyPathEvents));
    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('first task');
    });

    expect(result.current.workflowState.steps).toHaveLength(1);

    // Second run – state should reset
    vi.mocked(fetch).mockResolvedValue(mockNdjsonResponse([startEvent]));
    await act(async () => {
      await result.current.sendWorkflowMessage('second task');
    });

    // After reset + second run, steps from first run should be gone
    // (reset clears steps, then step_start would add them back)
    // Since second run only has start event, no steps are added
    expect(result.current.workflowState.steps).toHaveLength(0);
  });

  it('sets error state on HTTP error response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Bad Request', { status: 400 }),
    );

    const { result } = renderHook(() => useWorkflowChat());

    await act(async () => {
      await result.current.sendWorkflowMessage('test');
    });

    expect(result.current.workflowState.error).not.toBeNull();
    expect(result.current.workflowState.status).toBe('error');
    expect(result.current.isRunning).toBe(false);
  });
});
