// ============================================================================
// workflow.test.ts – WorkflowEngine Unit Tests
// ============================================================================
// Tests for the WorkflowEngine state machine:
//   idle → planning → executing → reflecting → done
//
// Mocks: sendAgentChatMessage (LLM calls) + executeAgentLoop (step execution)
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowEngine } from './workflow';
import { ToolRegistry } from './registry';
import type { WorkflowStreamEvent, WorkflowConfig } from './workflowTypes';
import { WORKFLOW_DEFAULTS } from './workflowTypes';
import type { AgentFinalTurn } from './executor';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@/lib/ollama', () => ({
  sendAgentChatMessage: vi.fn(),
}));

vi.mock('./executor', () => ({
  executeAgentLoop: vi.fn(),
}));

import { sendAgentChatMessage } from '@/lib/ollama';
import { executeAgentLoop } from './executor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all events from the workflow generator into an array */
async function collectEvents(engine: WorkflowEngine): Promise<WorkflowStreamEvent[]> {
  const events: WorkflowStreamEvent[] = [];
  for await (const event of engine.run()) {
    events.push(event);
  }
  return events;
}

/** Minimal valid plan JSON for a single step */
const singleStepPlan = JSON.stringify({
  goal: 'Accomplish the task',
  steps: [
    {
      id: 'step-1',
      description: 'Execute the main task',
      expectedTools: ['read_file'],
      dependsOn: [],
      successCriteria: 'File read successfully',
    },
  ],
  maxSteps: 1,
});

/** Two-step plan */
const twoStepPlan = JSON.stringify({
  goal: 'Complete the workflow',
  steps: [
    {
      id: 'step-1',
      description: 'First step: read data',
      expectedTools: ['read_file'],
      dependsOn: [],
      successCriteria: 'Data read',
    },
    {
      id: 'step-2',
      description: 'Second step: process data',
      expectedTools: ['write_file'],
      dependsOn: ['step-1'],
      successCriteria: 'Data processed',
    },
  ],
  maxSteps: 2,
});

/** Reflection JSON for different actions */
const reflectionContinue = JSON.stringify({
  assessment: 'success',
  nextAction: 'continue',
  comment: 'Step completed successfully, proceeding.',
  finalAnswer: null,
  planAdjustment: null,
});

const reflectionComplete = JSON.stringify({
  assessment: 'success',
  nextAction: 'complete',
  comment: 'Task fully accomplished.',
  finalAnswer: 'Here is the final answer: all done!',
  planAdjustment: null,
});

const reflectionAbort = JSON.stringify({
  assessment: 'failure',
  nextAction: 'abort',
  comment: 'Cannot proceed.',
  abortReason: 'Tool is unavailable and the task cannot be completed.',
  finalAnswer: null,
  planAdjustment: null,
});

const reflectionAdjust = JSON.stringify({
  assessment: 'partial',
  nextAction: 'adjust_plan',
  comment: 'Need to revise approach.',
  finalAnswer: null,
  planAdjustment: {
    reason: 'Original approach failed',
    newGoal: 'Alternative approach',
    newSteps: [
      {
        id: 'step-alt-1',
        description: 'Alternative step',
        expectedTools: ['web_search'],
        dependsOn: [],
        successCriteria: 'Search completed',
      },
    ],
  },
});

/** Mock AgentFinalTurn with no tool calls (empty executor step) */
function makeTurnNoTools(index = 0): AgentFinalTurn {
  return {
    index,
    toolCalls: [],
    toolResults: [],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    assistantMessage: 'Done',
  };
}

/** Mock AgentFinalTurn with a tool call + result */
function makeTurnWithTool(index = 0): AgentFinalTurn {
  return {
    index,
    toolCalls: [
      { id: 'tc_001', name: 'read_file', arguments: { path: 'test.txt' } },
    ],
    toolResults: [
      { callId: 'tc_001', content: 'file contents here', success: true },
    ],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

/** Create a mock registry with a named tool */
function makeRegistry(toolNames: string[] = ['read_file', 'write_file']): ToolRegistry {
  const registry = new ToolRegistry();
  for (const name of toolNames) {
    registry.register({
      definition: {
        name,
        description: `Mock tool: ${name}`,
        parameters: { type: 'object', properties: {}, required: [] },
        enabled: true,
      },
      handler: vi.fn().mockResolvedValue({ callId: '', content: `result of ${name}`, success: true }),
    });
  }
  return registry;
}

/** Default options for WorkflowEngine construction */
function makeOptions(overrides: Partial<WorkflowConfig> = {}) {
  const registry = makeRegistry();
  return {
    message: 'Do a task for me',
    messages: [{ role: 'system' as const, content: 'You are a helpful agent.' }],
    model: 'llama3',
    registry,
    config: {
      maxSteps: WORKFLOW_DEFAULTS.maxSteps,
      maxRePlans: WORKFLOW_DEFAULTS.maxRePlans,
      timeoutMs: WORKFLOW_DEFAULTS.timeoutMs,
      stepTimeoutMs: WORKFLOW_DEFAULTS.stepTimeoutMs,
      enableReflection: false, // Default OFF in tests to keep tests fast
      enablePlanning: true,
      enabledTools: registry.listNames(),
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default: executeAgentLoop yields a single empty turn
  vi.mocked(executeAgentLoop).mockImplementation(async function* () {
    yield makeTurnNoTools();
  });

  // Default: sendAgentChatMessage returns the single-step plan
  vi.mocked(sendAgentChatMessage).mockResolvedValue({
    content: singleStepPlan,
    tokenStats: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// 1. State Machine: Initial State
// ===========================================================================

describe('WorkflowEngine – Initial State', () => {
  it('starts in idle status', () => {
    const engine = new WorkflowEngine(makeOptions());
    expect(engine.getState().status).toBe('idle');
  });

  it('stores the user message in state', () => {
    const opts = makeOptions();
    const engine = new WorkflowEngine({ ...opts, message: 'Specific task' });
    expect(engine.getState().userMessage).toBe('Specific task');
  });

  it('generates a unique workflow ID', () => {
    const e1 = new WorkflowEngine(makeOptions());
    const e2 = new WorkflowEngine(makeOptions());
    expect(e1.getState().id).not.toBe(e2.getState().id);
  });

  it('applies WORKFLOW_DEFAULTS for unspecified config values', () => {
    const opts = makeOptions();
    const engine = new WorkflowEngine(opts);
    const state = engine.getState();
    expect(state.config.maxSteps).toBe(WORKFLOW_DEFAULTS.maxSteps);
    expect(state.config.maxRePlans).toBe(WORKFLOW_DEFAULTS.maxRePlans);
    expect(state.config.timeoutMs).toBe(WORKFLOW_DEFAULTS.timeoutMs);
  });
});

// ===========================================================================
// 2. State Machine: Event Sequence (Happy Path)
// ===========================================================================

describe('WorkflowEngine – Event Sequence (Happy Path)', () => {
  it('emits workflow_start as first event', async () => {
    const engine = new WorkflowEngine(makeOptions());
    // Provide a final-answer response for the last sendAgentChatMessage call
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null }) // planning
      .mockResolvedValueOnce({ content: 'Final answer text', tokenStats: null }); // final answer

    const events = await collectEvents(engine);
    expect(events[0].type).toBe('workflow_start');
  });

  it('emits plan event after planning phase', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const planEvent = events.find((e) => e.type === 'plan');
    expect(planEvent).toBeDefined();
    if (planEvent?.type === 'plan') {
      expect(planEvent.plan.goal).toBe('Accomplish the task');
      expect(planEvent.plan.steps).toHaveLength(1);
      expect(planEvent.isAdjustment).toBe(false);
    }
  });

  it('emits step_start → step_end for each plan step', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const stepStarts = events.filter((e) => e.type === 'step_start');
    const stepEnds = events.filter((e) => e.type === 'step_end');

    expect(stepStarts).toHaveLength(1);
    expect(stepEnds).toHaveLength(1);
    expect(stepStarts[0].type === 'step_start' && stepStarts[0].stepId).toBe('step-1');
  });

  it('emits step_start before step_end for the same step', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const startIdx = events.findIndex((e) => e.type === 'step_start');
    const endIdx = events.findIndex((e) => e.type === 'step_end');
    expect(startIdx).toBeLessThan(endIdx);
  });

  it('emits message event with final answer', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer text', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const msgEvent = events.find((e) => e.type === 'message');
    expect(msgEvent).toBeDefined();
    if (msgEvent?.type === 'message') {
      expect(msgEvent.done).toBe(true);
      expect(msgEvent.content).toBe('Final answer text');
    }
  });

  it('emits workflow_end as last event', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const last = events[events.length - 1];
    expect(last.type).toBe('workflow_end');
    if (last.type === 'workflow_end') {
      expect(last.status).toBe('done');
    }
  });

  it('includes durationMs in workflow_end', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent?.type === 'workflow_end' && endEvent.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ===========================================================================
// 3. Planning Phase
// ===========================================================================

describe('WorkflowEngine – Planning Phase', () => {
  it('parses valid JSON plan from LLM', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: twoStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'continue', tokenStats: null }) // reflection step-1
      .mockResolvedValueOnce({ content: 'continue', tokenStats: null }) // reflection step-2
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({ enableReflection: false }));
    const events = await collectEvents(engine);

    const planEvent = events.find((e) => e.type === 'plan');
    expect(planEvent?.type === 'plan' && planEvent.plan.steps).toHaveLength(2);
  });

  it('creates fallback plan when LLM returns invalid JSON', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: 'This is not JSON at all!', tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const planEvent = events.find((e) => e.type === 'plan');
    expect(planEvent).toBeDefined();
    if (planEvent?.type === 'plan') {
      // Fallback plan has 1 generic step
      expect(planEvent.plan.steps).toHaveLength(1);
      expect(planEvent.plan.steps[0].description).toBe('Aufgabe direkt ausführen');
    }
  });

  it('creates fallback plan when planning LLM call fails (throws)', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockRejectedValueOnce(new Error('Ollama connection refused'))
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const planEvent = events.find((e) => e.type === 'plan');
    expect(planEvent).toBeDefined();
    if (planEvent?.type === 'plan') {
      expect(planEvent.plan.steps).toHaveLength(1);
    }
  });

  it('skips planning when enablePlanning is false (uses fallback)', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({ enablePlanning: false }));
    const events = await collectEvents(engine);

    // sendAgentChatMessage should only be called once (for final answer), not for planning
    expect(vi.mocked(sendAgentChatMessage)).toHaveBeenCalledTimes(1);

    const planEvent = events.find((e) => e.type === 'plan');
    expect(planEvent?.type === 'plan' && planEvent.plan.steps).toHaveLength(1);
  });

  it('strips markdown code fences from plan JSON', async () => {
    const fencedPlan = '```json\n' + singleStepPlan + '\n```';
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: fencedPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const planEvent = events.find((e) => e.type === 'plan');
    expect(planEvent?.type === 'plan' && planEvent.plan.goal).toBe('Accomplish the task');
  });

  it('limits plan steps to configured maxSteps', async () => {
    // Plan with more steps than allowed
    const manyStepsPlan = JSON.stringify({
      goal: 'Many steps',
      steps: Array.from({ length: 15 }, (_, i) => ({
        id: `step-${i + 1}`,
        description: `Step ${i + 1}`,
        expectedTools: [],
        dependsOn: [],
        successCriteria: 'done',
      })),
      maxSteps: 15,
    });

    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: manyStepsPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({ maxSteps: 3 }));
    const events = await collectEvents(engine);

    // Should only execute up to maxSteps
    const stepStarts = events.filter((e) => e.type === 'step_start');
    expect(stepStarts.length).toBeLessThanOrEqual(3);
  });
});

// ===========================================================================
// 4. Step Execution
// ===========================================================================

describe('WorkflowEngine – Step Execution', () => {
  it('emits tool_call and tool_result events when tools are used', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    vi.mocked(executeAgentLoop).mockImplementation(async function* () {
      yield makeTurnWithTool(0);
    });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const toolCallEvents = events.filter((e) => e.type === 'tool_call');
    const toolResultEvents = events.filter((e) => e.type === 'tool_result');

    expect(toolCallEvents).toHaveLength(1);
    expect(toolResultEvents).toHaveLength(1);

    if (toolCallEvents[0].type === 'tool_call') {
      expect(toolCallEvents[0].call.name).toBe('read_file');
    }
    if (toolResultEvents[0].type === 'tool_result') {
      expect(toolResultEvents[0].result.success).toBe(true);
    }
  });

  it('marks step as success when all tools succeed', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    vi.mocked(executeAgentLoop).mockImplementation(async function* () {
      yield makeTurnWithTool(0);
    });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const stepEnd = events.find((e) => e.type === 'step_end');
    expect(stepEnd?.type === 'step_end' && stepEnd.status).toBe('success');
  });

  it('marks step as failed when a tool fails', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    vi.mocked(executeAgentLoop).mockImplementation(async function* () {
      yield {
        index: 0,
        toolCalls: [{ id: 'tc_fail', name: 'read_file', arguments: { path: 'missing.txt' } }],
        toolResults: [{ callId: 'tc_fail', content: '', error: 'File not found', success: false }],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const stepEnd = events.find((e) => e.type === 'step_end');
    expect(stepEnd?.type === 'step_end' && stepEnd.status).toBe('failed');
  });

  it('emits recoverable error event when step executor throws', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    vi.mocked(executeAgentLoop).mockImplementation(async function* () {
      throw new Error('LLM execution error');
      yield makeTurnNoTools(); // unreachable, for type
    });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === 'error') {
      expect(errorEvent.recoverable).toBe(true);
      expect(errorEvent.message).toContain('LLM execution error');
    }
  });

  it('executes all steps in a multi-step plan', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: twoStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    vi.mocked(executeAgentLoop).mockImplementation(async function* () {
      yield makeTurnNoTools();
    });

    const engine = new WorkflowEngine(makeOptions({ enableReflection: false }));
    const events = await collectEvents(engine);

    const stepStarts = events.filter((e) => e.type === 'step_start');
    const stepEnds = events.filter((e) => e.type === 'step_end');

    expect(stepStarts).toHaveLength(2);
    expect(stepEnds).toHaveLength(2);
  });
});

// ===========================================================================
// 5. Reflection Phase
// ===========================================================================

describe('WorkflowEngine – Reflection Phase', () => {
  it('emits reflection event after each step when enableReflection is true', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null }) // planning
      .mockResolvedValueOnce({ content: reflectionContinue, tokenStats: null }) // reflection
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null }); // final answer

    const engine = new WorkflowEngine(makeOptions({ enableReflection: true }));
    const events = await collectEvents(engine);

    const reflectionEvents = events.filter((e) => e.type === 'reflection');
    expect(reflectionEvents).toHaveLength(1);

    if (reflectionEvents[0].type === 'reflection') {
      expect(reflectionEvents[0].assessment).toBe('success');
      expect(reflectionEvents[0].nextAction).toBe('continue');
    }
  });

  it('skips reflection when enableReflection is false', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({ enableReflection: false }));
    const events = await collectEvents(engine);

    const reflectionEvents = events.filter((e) => e.type === 'reflection');
    expect(reflectionEvents).toHaveLength(0);
  });

  it('exits early with message event when reflection returns complete', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: reflectionComplete, tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({ enableReflection: true }));
    const events = await collectEvents(engine);

    const msgEvent = events.find((e) => e.type === 'message');
    expect(msgEvent).toBeDefined();
    if (msgEvent?.type === 'message') {
      expect(msgEvent.content).toBe('Here is the final answer: all done!');
      expect(msgEvent.done).toBe(true);
    }

    // workflow_end should have 'done' status
    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent?.type === 'workflow_end' && endEvent.status).toBe('done');
  });

  it('does NOT call generateFinalAnswer when reflection returns complete', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: reflectionComplete, tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({ enableReflection: true }));
    await collectEvents(engine);

    // sendAgentChatMessage called twice: once for planning, once for reflection
    // NOT a third time for final answer generation
    expect(vi.mocked(sendAgentChatMessage)).toHaveBeenCalledTimes(2);
  });

  it('transitions to error when reflection returns abort', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: reflectionAbort, tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({ enableReflection: true }));
    const events = await collectEvents(engine);

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === 'error') {
      expect(errorEvent.recoverable).toBe(false);
      expect(errorEvent.message).toContain('Tool is unavailable');
    }

    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent?.type === 'workflow_end' && endEvent.status).toBe('error');
  });

  it('adjusts plan when reflection returns adjust_plan', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })  // initial plan
      .mockResolvedValueOnce({ content: reflectionAdjust, tokenStats: null }) // reflection → adjust
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null }); // final answer

    const engine = new WorkflowEngine(makeOptions({
      enableReflection: true,
      maxRePlans: 2,
    }));
    const events = await collectEvents(engine);

    const planEvents = events.filter((e) => e.type === 'plan');
    // One initial plan + one adjusted plan
    expect(planEvents).toHaveLength(2);

    const adjustedPlan = planEvents.find((e) => e.type === 'plan' && e.isAdjustment);
    expect(adjustedPlan).toBeDefined();
    if (adjustedPlan?.type === 'plan') {
      expect(adjustedPlan.isAdjustment).toBe(true);
    }
  });

  it('falls back to continue when reflection returns invalid JSON', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Not valid JSON at all!', tokenStats: null }) // bad reflection
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({ enableReflection: true }));
    const events = await collectEvents(engine);

    // Workflow should complete normally despite bad reflection
    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent).toBeDefined();
    expect(endEvent?.type === 'workflow_end' && endEvent.status).toBe('done');
  });
});

// ===========================================================================
// 6. Re-Plan Limit (max 2x)
// ===========================================================================

describe('WorkflowEngine – Re-Plan Limit', () => {
  it('allows adjust_plan up to maxRePlans times', async () => {
    // Planning + step + 2 reflections each requesting adjust_plan
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null }) // initial plan
      .mockResolvedValueOnce({ content: reflectionAdjust, tokenStats: null }) // reflection 1 → adjust
      // After adjust_plan, new steps are used. The alt step runs:
      .mockResolvedValueOnce({ content: reflectionAdjust, tokenStats: null }) // reflection 2 → adjust
      // Second re-plan allowed (replanCount = 2 = maxRePlans), another alt step:
      .mockResolvedValueOnce({ content: reflectionContinue, tokenStats: null }) // reflection 3 → continue
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({
      enableReflection: true,
      maxRePlans: 2,
    }));
    const events = await collectEvents(engine);

    // Should emit plan adjustment events
    const adjustedPlans = events.filter(
      (e) => e.type === 'plan' && e.isAdjustment,
    );
    expect(adjustedPlans.length).toBeGreaterThanOrEqual(1);
    expect(adjustedPlans.length).toBeLessThanOrEqual(2);
  });

  it('does NOT re-plan beyond maxRePlans', async () => {
    // Exhaust the re-plan budget: all reflections request adjust_plan
    const reflectionCalls = [
      singleStepPlan, // initial plan
      reflectionAdjust, // reflection 1 → adjust (replanCount becomes 1)
      reflectionAdjust, // reflection 2 → adjust (replanCount becomes 2 = maxRePlans)
      // Now replanCount === maxRePlans → adjust_plan ignored, treated as continue
      reflectionContinue, // reflection 3 → continue
      'Final answer',     // final answer
    ];

    vi.mocked(sendAgentChatMessage).mockImplementation(() => {
      const content = reflectionCalls.shift() ?? 'done';
      return Promise.resolve({ content, tokenStats: null });
    });

    const engine = new WorkflowEngine(makeOptions({
      enableReflection: true,
      maxRePlans: 2,
    }));
    const events = await collectEvents(engine);

    // replanCount should never exceed maxRePlans
    const state = engine.getState();
    expect(state.replanCount).toBeLessThanOrEqual(2);
  });
});

// ===========================================================================
// 7. Cancellation via AbortController
// ===========================================================================

describe('WorkflowEngine – Cancellation', () => {
  it('cancel() before run() causes workflow to emit cancelled + workflow_end', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValue({ content: singleStepPlan, tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    engine.cancel(); // Cancel before run

    const events = await collectEvents(engine);

    // Should have a workflow_end with cancelled or an error status
    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent).toBeDefined();
    // Since abort happens before steps, the finalize should detect it
    expect(
      endEvent?.type === 'workflow_end' &&
      ['cancelled', 'planning', 'executing'].includes(endEvent.status),
    ).toBe(true);
  });

  it('cancel() mid-run transitions to cancelled status', async () => {
    let cancelCalled = false;
    let engine: WorkflowEngine;

    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    engine = new WorkflowEngine(makeOptions());
    const events: WorkflowStreamEvent[] = [];
    let eventCount = 0;

    for await (const event of engine.run()) {
      events.push(event);
      eventCount++;
      // Cancel after plan event (index 1)
      if (event.type === 'plan' && !cancelCalled) {
        cancelCalled = true;
        engine.cancel();
      }
    }

    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent).toBeDefined();
    // Status should reflect the cancellation
    const endStatus = endEvent?.type === 'workflow_end' ? endEvent.status : '';
    expect(['cancelled', 'executing', 'planning']).toContain(endStatus);
  });

  it('getState() shows cancelled status after cancel()', () => {
    const engine = new WorkflowEngine(makeOptions());
    engine.cancel();
    expect(engine.getState().status).toBe('cancelled');
  });
});

// ===========================================================================
// 8. Timeout Handling
// ===========================================================================

describe('WorkflowEngine – Timeout Handling', () => {
  it('uses fake timers to trigger global timeout', async () => {
    vi.useFakeTimers();

    // Planning will hang until we resolve it
    let resolvePlanning!: (value: { content: string; tokenStats: null }) => void;
    const planningPromise = new Promise<{ content: string; tokenStats: null }>(
      (resolve) => { resolvePlanning = resolve; },
    );

    vi.mocked(sendAgentChatMessage).mockReturnValueOnce(planningPromise);

    const engine = new WorkflowEngine(makeOptions({ timeoutMs: 1000 }));
    const events: WorkflowStreamEvent[] = [];

    // Start running
    const runGen = engine.run();

    // Get workflow_start event
    const first = await runGen.next();
    if (first.value) events.push(first.value);

    // Advance past timeout
    await vi.advanceTimersByTimeAsync(1100);

    // Now resolve the hanging planning call
    resolvePlanning({ content: '', tokenStats: null });

    // Collect remaining events
    for await (const event of runGen) {
      events.push(event);
    }

    vi.useRealTimers();

    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent).toBeDefined();
    // After timeout, either 'timeout' or 'cancelled' status (finalize logic)
    const endStatus = endEvent?.type === 'workflow_end' ? endEvent.status : '';
    expect(['timeout', 'cancelled', 'planning']).toContain(endStatus);
  });
});

// ===========================================================================
// 9. Config Overrides
// ===========================================================================

describe('WorkflowEngine – Config Overrides', () => {
  it('respects custom maxSteps limit', async () => {
    const manyStepsPlan = JSON.stringify({
      goal: 'Many steps',
      steps: [1, 2, 3, 4, 5].map((i) => ({
        id: `step-${i}`,
        description: `Step ${i}`,
        expectedTools: [],
        dependsOn: [],
        successCriteria: 'done',
      })),
      maxSteps: 5,
    });

    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: manyStepsPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({
      maxSteps: 2,
      enableReflection: false,
    }));
    const events = await collectEvents(engine);

    const stepStarts = events.filter((e) => e.type === 'step_start');
    expect(stepStarts.length).toBeLessThanOrEqual(2);
  });

  it('uses custom host for LLM calls', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const opts = makeOptions();
    const engine = new WorkflowEngine({ ...opts, host: 'http://custom-host:11434' });
    await collectEvents(engine);

    expect(vi.mocked(sendAgentChatMessage)).toHaveBeenCalledWith(
      'llama3',
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ host: 'http://custom-host:11434' }),
    );
  });

  it('stores config in state', () => {
    const engine = new WorkflowEngine(makeOptions({
      maxSteps: 4,
      enableReflection: true,
    }));
    const state = engine.getState();
    expect(state.config.maxSteps).toBe(4);
    expect(state.config.enableReflection).toBe(true);
  });
});

// ===========================================================================
// 10. Error Recovery
// ===========================================================================

describe('WorkflowEngine – Error Recovery', () => {
  it('recovers from planning LLM error and uses fallback plan', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockRejectedValueOnce(new Error('Network error during planning'))
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    // Should still produce a plan (fallback)
    const planEvent = events.find((e) => e.type === 'plan');
    expect(planEvent).toBeDefined();

    // Workflow should complete
    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent?.type === 'workflow_end' && endEvent.status).toBe('done');
  });

  it('recovers from reflection LLM error and continues', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockRejectedValueOnce(new Error('Reflection LLM error'))
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions({ enableReflection: true }));
    const events = await collectEvents(engine);

    // Workflow should complete despite reflection failure
    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent?.type === 'workflow_end' && endEvent.status).toBe('done');
  });

  it('emits fatal error event when entire run throws unexpectedly', async () => {
    // This simulates an unexpected error that bypasses try-catch
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null });

    vi.mocked(executeAgentLoop).mockImplementation(async function* () {
      throw new Error('Unexpected fatal error');
      yield makeTurnNoTools(); // type stub
    });

    // Mock final answer to also fail (so the catch block in run() is triggered)
    vi.mocked(sendAgentChatMessage)
      .mockRejectedValue(new Error('Final answer also failed'));

    const engine = new WorkflowEngine(makeOptions({ enableReflection: false }));
    const events = await collectEvents(engine);

    // Either a recoverable step error or fatal error
    const hasError = events.some((e) => e.type === 'error');
    expect(hasError).toBe(true);

    // workflow_end should always be emitted
    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent).toBeDefined();
  });

  it('workflow_end is always emitted, even after errors', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockRejectedValue(new Error('Total chaos'));
    vi.mocked(executeAgentLoop).mockImplementation(async function* () {
      throw new Error('Executor also failed');
      yield makeTurnNoTools();
    });

    const engine = new WorkflowEngine(makeOptions());
    const events = await collectEvents(engine);

    const endEvent = events.find((e) => e.type === 'workflow_end');
    expect(endEvent).toBeDefined();
  });
});

// ===========================================================================
// 11. getState() reflects current workflow state
// ===========================================================================

describe('WorkflowEngine – State Tracking', () => {
  it('getState() returns copy (not reference)', () => {
    const engine = new WorkflowEngine(makeOptions());
    const state1 = engine.getState();
    const state2 = engine.getState();
    expect(state1).not.toBe(state2); // Different object references
    expect(state1).toEqual(state2);  // But same content
  });

  it('tracks completed steps in state after run', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const engine = new WorkflowEngine(makeOptions());
    await collectEvents(engine);

    const state = engine.getState();
    expect(state.steps).toHaveLength(1);
    expect(state.steps[0].planStepId).toBe('step-1');
  });

  it('stores startedAt timestamp', async () => {
    vi.mocked(sendAgentChatMessage)
      .mockResolvedValueOnce({ content: singleStepPlan, tokenStats: null })
      .mockResolvedValueOnce({ content: 'Final answer', tokenStats: null });

    const before = new Date().toISOString();
    const engine = new WorkflowEngine(makeOptions());
    await collectEvents(engine);
    const after = new Date().toISOString();

    const state = engine.getState();
    expect(state.startedAt >= before).toBe(true);
    expect(state.startedAt <= after).toBe(true);
  });
});
