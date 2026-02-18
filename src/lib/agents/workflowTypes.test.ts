// ============================================================================
// workflowTypes.test.ts – Type Guards & Defaults
// ============================================================================
// Tests for all isWorkflow*Event type guards and WORKFLOW_DEFAULTS values.
// No mocking needed – pure unit tests.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_DEFAULTS,
  isWorkflowStartEvent,
  isWorkflowPlanEvent,
  isWorkflowStepStartEvent,
  isWorkflowStepEndEvent,
  isWorkflowMessageEvent,
  isWorkflowEndEvent,
  isWorkflowErrorEvent,
  isWorkflowReflectionEvent,
} from './workflowTypes';
import type {
  WorkflowStreamEvent,
  WorkflowStartEvent,
  WorkflowPlanEvent,
  WorkflowStepStartEvent,
  WorkflowStepEndEvent,
  WorkflowMessageEvent,
  WorkflowEndEvent,
  WorkflowErrorEvent,
  WorkflowReflectionEvent,
  WorkflowPlan,
} from './workflowTypes';

// ---------------------------------------------------------------------------
// Helpers: build minimal valid events
// ---------------------------------------------------------------------------

const minimalPlan: WorkflowPlan = {
  goal: 'Test goal',
  steps: [],
  maxSteps: 1,
  createdAt: new Date().toISOString(),
  version: 1,
};

const startEvent: WorkflowStartEvent = {
  type: 'workflow_start',
  workflowId: 'wf_test_1',
  timestamp: new Date().toISOString(),
  config: { maxSteps: 8, enabledTools: ['read_file'] },
};

const planEvent: WorkflowPlanEvent = {
  type: 'plan',
  plan: minimalPlan,
  isAdjustment: false,
};

const stepStartEvent: WorkflowStepStartEvent = {
  type: 'step_start',
  stepId: 'step-1',
  stepIndex: 0,
  totalSteps: 3,
  description: 'Read the file',
  expectedTools: ['read_file'],
};

const stepEndEvent: WorkflowStepEndEvent = {
  type: 'step_end',
  stepId: 'step-1',
  stepIndex: 0,
  status: 'success',
  durationMs: 1500,
};

const messageEvent: WorkflowMessageEvent = {
  type: 'message',
  content: 'Here is the result',
  done: true,
};

const endEvent: WorkflowEndEvent = {
  type: 'workflow_end',
  workflowId: 'wf_test_1',
  status: 'done',
  totalSteps: 3,
  durationMs: 5000,
};

const errorEvent: WorkflowErrorEvent = {
  type: 'error',
  message: 'Something went wrong',
  recoverable: false,
};

const reflectionEvent: WorkflowReflectionEvent = {
  type: 'reflection',
  stepId: 'step-1',
  assessment: 'success',
  nextAction: 'continue',
  comment: 'Step completed successfully',
};

// ---------------------------------------------------------------------------
// WORKFLOW_DEFAULTS
// ---------------------------------------------------------------------------

describe('WORKFLOW_DEFAULTS', () => {
  it('has maxSteps = 8', () => {
    expect(WORKFLOW_DEFAULTS.maxSteps).toBe(8);
  });

  it('has maxRePlans = 2', () => {
    expect(WORKFLOW_DEFAULTS.maxRePlans).toBe(2);
  });

  it('has timeoutMs = 120000 (2 minutes)', () => {
    expect(WORKFLOW_DEFAULTS.timeoutMs).toBe(120_000);
  });

  it('has stepTimeoutMs = 30000 (30 seconds)', () => {
    expect(WORKFLOW_DEFAULTS.stepTimeoutMs).toBe(30_000);
  });

  it('has enableReflection = true (Adi decision)', () => {
    expect(WORKFLOW_DEFAULTS.enableReflection).toBe(true);
  });

  it('has enablePlanning = true', () => {
    expect(WORKFLOW_DEFAULTS.enablePlanning).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isWorkflowStartEvent
// ---------------------------------------------------------------------------

describe('isWorkflowStartEvent', () => {
  it('returns true for workflow_start event', () => {
    expect(isWorkflowStartEvent(startEvent)).toBe(true);
  });

  it('returns false for plan event', () => {
    expect(isWorkflowStartEvent(planEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for step_start event', () => {
    expect(isWorkflowStartEvent(stepStartEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for error event', () => {
    expect(isWorkflowStartEvent(errorEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for workflow_end event', () => {
    expect(isWorkflowStartEvent(endEvent as WorkflowStreamEvent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isWorkflowPlanEvent
// ---------------------------------------------------------------------------

describe('isWorkflowPlanEvent', () => {
  it('returns true for plan event', () => {
    expect(isWorkflowPlanEvent(planEvent)).toBe(true);
  });

  it('returns true for plan adjustment event', () => {
    const adjustmentEvent: WorkflowPlanEvent = {
      ...planEvent,
      isAdjustment: true,
      adjustmentReason: 'Previous step failed',
    };
    expect(isWorkflowPlanEvent(adjustmentEvent)).toBe(true);
  });

  it('returns false for workflow_start event', () => {
    expect(isWorkflowPlanEvent(startEvent as unknown as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for step_start event', () => {
    expect(isWorkflowPlanEvent(stepStartEvent as WorkflowStreamEvent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isWorkflowStepStartEvent
// ---------------------------------------------------------------------------

describe('isWorkflowStepStartEvent', () => {
  it('returns true for step_start event', () => {
    expect(isWorkflowStepStartEvent(stepStartEvent)).toBe(true);
  });

  it('returns false for step_end event', () => {
    expect(isWorkflowStepStartEvent(stepEndEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for plan event', () => {
    expect(isWorkflowStepStartEvent(planEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for message event', () => {
    expect(isWorkflowStepStartEvent(messageEvent as WorkflowStreamEvent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isWorkflowStepEndEvent
// ---------------------------------------------------------------------------

describe('isWorkflowStepEndEvent', () => {
  it('returns true for step_end event', () => {
    expect(isWorkflowStepEndEvent(stepEndEvent)).toBe(true);
  });

  it('returns true for failed step_end event', () => {
    const failedEnd: WorkflowStepEndEvent = { ...stepEndEvent, status: 'failed' };
    expect(isWorkflowStepEndEvent(failedEnd)).toBe(true);
  });

  it('returns false for step_start event', () => {
    expect(isWorkflowStepEndEvent(stepStartEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for workflow_end event', () => {
    expect(isWorkflowStepEndEvent(endEvent as WorkflowStreamEvent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isWorkflowMessageEvent
// ---------------------------------------------------------------------------

describe('isWorkflowMessageEvent', () => {
  it('returns true for message event (done=true)', () => {
    expect(isWorkflowMessageEvent(messageEvent)).toBe(true);
  });

  it('returns true for message event (done=false, streaming)', () => {
    const streamChunk: WorkflowMessageEvent = {
      type: 'message',
      content: 'partial chunk',
      done: false,
    };
    expect(isWorkflowMessageEvent(streamChunk)).toBe(true);
  });

  it('returns false for workflow_end event', () => {
    expect(isWorkflowMessageEvent(endEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for error event', () => {
    expect(isWorkflowMessageEvent(errorEvent as WorkflowStreamEvent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isWorkflowEndEvent
// ---------------------------------------------------------------------------

describe('isWorkflowEndEvent', () => {
  it('returns true for workflow_end event (done)', () => {
    expect(isWorkflowEndEvent(endEvent)).toBe(true);
  });

  it('returns true for workflow_end event with error status', () => {
    const errorEnd: WorkflowEndEvent = { ...endEvent, status: 'error' };
    expect(isWorkflowEndEvent(errorEnd)).toBe(true);
  });

  it('returns true for workflow_end event with cancelled status', () => {
    const cancelledEnd: WorkflowEndEvent = { ...endEvent, status: 'cancelled' };
    expect(isWorkflowEndEvent(cancelledEnd)).toBe(true);
  });

  it('returns false for workflow_start event', () => {
    expect(isWorkflowEndEvent(startEvent as unknown as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for message event', () => {
    expect(isWorkflowEndEvent(messageEvent as WorkflowStreamEvent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isWorkflowErrorEvent
// ---------------------------------------------------------------------------

describe('isWorkflowErrorEvent', () => {
  it('returns true for error event (non-recoverable)', () => {
    expect(isWorkflowErrorEvent(errorEvent)).toBe(true);
  });

  it('returns true for recoverable error event', () => {
    const recoverableError: WorkflowErrorEvent = {
      type: 'error',
      message: 'Tool failed, continuing',
      recoverable: true,
      stepId: 'step-1',
    };
    expect(isWorkflowErrorEvent(recoverableError)).toBe(true);
  });

  it('returns false for workflow_end event', () => {
    expect(isWorkflowErrorEvent(endEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for message event', () => {
    expect(isWorkflowErrorEvent(messageEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for step_end event', () => {
    expect(isWorkflowErrorEvent(stepEndEvent as WorkflowStreamEvent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isWorkflowReflectionEvent
// ---------------------------------------------------------------------------

describe('isWorkflowReflectionEvent', () => {
  it('returns true for reflection event (continue)', () => {
    expect(isWorkflowReflectionEvent(reflectionEvent)).toBe(true);
  });

  it('returns true for reflection event (complete)', () => {
    const completeReflection: WorkflowReflectionEvent = {
      type: 'reflection',
      stepId: 'step-1',
      assessment: 'success',
      nextAction: 'complete',
    };
    expect(isWorkflowReflectionEvent(completeReflection)).toBe(true);
  });

  it('returns true for reflection event (abort)', () => {
    const abortReflection: WorkflowReflectionEvent = {
      type: 'reflection',
      stepId: 'step-1',
      assessment: 'failure',
      nextAction: 'abort',
    };
    expect(isWorkflowReflectionEvent(abortReflection)).toBe(true);
  });

  it('returns true for reflection event (adjust_plan)', () => {
    const adjustReflection: WorkflowReflectionEvent = {
      type: 'reflection',
      stepId: 'step-1',
      assessment: 'partial',
      nextAction: 'adjust_plan',
      comment: 'Need to revise the approach',
    };
    expect(isWorkflowReflectionEvent(adjustReflection)).toBe(true);
  });

  it('returns false for step_end event', () => {
    expect(isWorkflowReflectionEvent(stepEndEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for plan event', () => {
    expect(isWorkflowReflectionEvent(planEvent as WorkflowStreamEvent)).toBe(false);
  });

  it('returns false for error event', () => {
    expect(isWorkflowReflectionEvent(errorEvent as WorkflowStreamEvent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases: Type guards with mismatched event types
// ---------------------------------------------------------------------------

describe('Type guards – cross-type rejection', () => {
  const allEvents: WorkflowStreamEvent[] = [
    startEvent,
    planEvent,
    stepStartEvent,
    stepEndEvent,
    messageEvent,
    endEvent,
    errorEvent,
    reflectionEvent,
    { type: 'tool_call', stepId: 'step-1', turn: 0, call: { id: 'c1', name: 'read_file', arguments: {}, stepId: 'step-1', callIndex: 0, startedAt: new Date().toISOString() } },
    { type: 'tool_result', stepId: 'step-1', turn: 0, result: { callId: 'c1', content: 'ok', success: true } },
    { type: 'cancelled', workflowId: 'wf_1', completedSteps: 2 },
  ];

  it('isWorkflowStartEvent only matches workflow_start', () => {
    const matches = allEvents.filter(isWorkflowStartEvent);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('workflow_start');
  });

  it('isWorkflowPlanEvent only matches plan', () => {
    const matches = allEvents.filter(isWorkflowPlanEvent);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('plan');
  });

  it('isWorkflowStepStartEvent only matches step_start', () => {
    const matches = allEvents.filter(isWorkflowStepStartEvent);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('step_start');
  });

  it('isWorkflowStepEndEvent only matches step_end', () => {
    const matches = allEvents.filter(isWorkflowStepEndEvent);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('step_end');
  });

  it('isWorkflowMessageEvent only matches message', () => {
    const matches = allEvents.filter(isWorkflowMessageEvent);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('message');
  });

  it('isWorkflowEndEvent only matches workflow_end', () => {
    const matches = allEvents.filter(isWorkflowEndEvent);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('workflow_end');
  });

  it('isWorkflowErrorEvent only matches error', () => {
    const matches = allEvents.filter(isWorkflowErrorEvent);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('error');
  });

  it('isWorkflowReflectionEvent only matches reflection', () => {
    const matches = allEvents.filter(isWorkflowReflectionEvent);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('reflection');
  });
});
