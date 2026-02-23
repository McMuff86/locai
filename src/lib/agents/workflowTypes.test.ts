import { describe, expect, it } from 'vitest';
import {
  WorkflowStatus,
  WorkflowStreamEvent,
  WorkflowStepStatus,
  WorkflowPlanStep,
  WorkflowPlan,
  WorkflowStep,
  WorkflowStepReflection,
  WorkflowState,
  WorkflowConfig,
  WORKFLOW_DEFAULTS,
  // Type Guards
  isWorkflowStartEvent,
  isWorkflowPlanEvent,
  isWorkflowStepStartEvent,
  isWorkflowStepEndEvent,
  isWorkflowMessageEvent,
  isWorkflowEndEvent,
  isWorkflowErrorEvent,
  isWorkflowReflectionEvent,
  isWorkflowLogEvent,
} from './workflowTypes';

// ---------------------------------------------------------------------------
// Test Data Helpers
// ---------------------------------------------------------------------------

function makeBasicPlanStep(id: string): WorkflowPlanStep {
  return {
    id,
    description: `Test step ${id}`,
    expectedTools: ['tool1', 'tool2'],
    dependsOn: [],
    successCriteria: 'Task completed successfully',
  };
}

function makeBasicPlan(): WorkflowPlan {
  return {
    goal: 'Test workflow goal',
    steps: [makeBasicPlanStep('step-1'), makeBasicPlanStep('step-2')],
    maxSteps: 2,
    createdAt: new Date().toISOString(),
    version: 1,
  };
}

function makeBasicWorkflowStep(): WorkflowStep {
  return {
    planStepId: 'step-1',
    executionIndex: 0,
    description: 'Test step',
    status: 'pending',
    toolCalls: [],
    toolResults: [],
    startedAt: new Date().toISOString(),
  };
}

function makeBasicConfig(): WorkflowConfig {
  return {
    model: 'llama3',
    enabledTools: ['tool1', 'tool2'],
    maxSteps: 5,
    maxRePlans: 2,
    timeoutMs: 300000,
    stepTimeoutMs: 120000,
    enableReflection: true,
    enablePlanning: true,
  };
}

// ---------------------------------------------------------------------------
// Type Guard Tests
// ---------------------------------------------------------------------------

describe('WorkflowTypes - Type Guards', () => {
  describe('isWorkflowStartEvent', () => {
    it('returns true for workflow_start event', () => {
      const event: WorkflowStreamEvent = {
        type: 'workflow_start',
        workflowId: 'wf-123',
        timestamp: new Date().toISOString(),
        config: { maxSteps: 5, enabledTools: ['tool1'] },
      };
      expect(isWorkflowStartEvent(event)).toBe(true);
    });

    it('returns false for other event types', () => {
      const event: WorkflowStreamEvent = {
        type: 'workflow_end',
        workflowId: 'wf-123',
        status: 'done',
        totalSteps: 2,
        durationMs: 5000,
      };
      expect(isWorkflowStartEvent(event)).toBe(false);
    });
  });

  describe('isWorkflowPlanEvent', () => {
    it('returns true for plan event', () => {
      const event: WorkflowStreamEvent = {
        type: 'plan',
        plan: makeBasicPlan(),
        isAdjustment: false,
      };
      expect(isWorkflowPlanEvent(event)).toBe(true);
    });

    it('returns false for other event types', () => {
      const event: WorkflowStreamEvent = {
        type: 'step_start',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 2,
        description: 'Test',
        expectedTools: [],
      };
      expect(isWorkflowPlanEvent(event)).toBe(false);
    });
  });

  describe('isWorkflowStepStartEvent', () => {
    it('returns true for step_start event', () => {
      const event: WorkflowStreamEvent = {
        type: 'step_start',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 2,
        description: 'Test step',
        expectedTools: ['tool1'],
      };
      expect(isWorkflowStepStartEvent(event)).toBe(true);
    });

    it('returns false for other event types', () => {
      const event: WorkflowStreamEvent = {
        type: 'step_end',
        stepId: 'step-1',
        stepIndex: 0,
        status: 'success',
        durationMs: 1000,
      };
      expect(isWorkflowStepStartEvent(event)).toBe(false);
    });
  });

  describe('isWorkflowStepEndEvent', () => {
    it('returns true for step_end event', () => {
      const event: WorkflowStreamEvent = {
        type: 'step_end',
        stepId: 'step-1',
        stepIndex: 0,
        status: 'success',
        durationMs: 1000,
      };
      expect(isWorkflowStepEndEvent(event)).toBe(true);
    });

    it('returns false for other event types', () => {
      const event: WorkflowStreamEvent = {
        type: 'step_start',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 2,
        description: 'Test',
        expectedTools: [],
      };
      expect(isWorkflowStepEndEvent(event)).toBe(false);
    });
  });

  describe('isWorkflowMessageEvent', () => {
    it('returns true for message event', () => {
      const event: WorkflowStreamEvent = {
        type: 'message',
        content: 'Test message',
        done: false,
      };
      expect(isWorkflowMessageEvent(event)).toBe(true);
    });

    it('returns false for other event types', () => {
      const event: WorkflowStreamEvent = {
        type: 'error',
        message: 'Error message',
        recoverable: true,
      };
      expect(isWorkflowMessageEvent(event)).toBe(false);
    });
  });

  describe('isWorkflowEndEvent', () => {
    it('returns true for workflow_end event', () => {
      const event: WorkflowStreamEvent = {
        type: 'workflow_end',
        workflowId: 'wf-123',
        status: 'done',
        totalSteps: 3,
        durationMs: 5000,
      };
      expect(isWorkflowEndEvent(event)).toBe(true);
    });

    it('returns false for other event types', () => {
      const event: WorkflowStreamEvent = {
        type: 'workflow_start',
        workflowId: 'wf-123',
        timestamp: new Date().toISOString(),
        config: { maxSteps: 5, enabledTools: [] },
      };
      expect(isWorkflowEndEvent(event)).toBe(false);
    });
  });

  describe('isWorkflowErrorEvent', () => {
    it('returns true for error event', () => {
      const event: WorkflowStreamEvent = {
        type: 'error',
        message: 'Something went wrong',
        recoverable: false,
        stepId: 'step-1',
      };
      expect(isWorkflowErrorEvent(event)).toBe(true);
    });

    it('returns false for other event types', () => {
      const event: WorkflowStreamEvent = {
        type: 'message',
        content: 'Normal message',
        done: true,
      };
      expect(isWorkflowErrorEvent(event)).toBe(false);
    });
  });

  describe('isWorkflowReflectionEvent', () => {
    it('returns true for reflection event', () => {
      const event: WorkflowStreamEvent = {
        type: 'reflection',
        stepId: 'step-1',
        assessment: 'success',
        nextAction: 'continue',
        comment: 'Step completed successfully',
      };
      expect(isWorkflowReflectionEvent(event)).toBe(true);
    });

    it('returns false for other event types', () => {
      const event: WorkflowStreamEvent = {
        type: 'step_end',
        stepId: 'step-1',
        stepIndex: 0,
        status: 'success',
        durationMs: 1000,
      };
      expect(isWorkflowReflectionEvent(event)).toBe(false);
    });
  });

  describe('isWorkflowLogEvent', () => {
    it('returns true for log event', () => {
      const event: WorkflowStreamEvent = {
        type: 'log',
        level: 'info',
        message: 'Step started',
        timestamp: new Date().toISOString(),
        stepId: 'step-1',
      };
      expect(isWorkflowLogEvent(event)).toBe(true);
    });

    it('returns false for other event types', () => {
      const event: WorkflowStreamEvent = {
        type: 'cancelled',
        workflowId: 'wf-123',
        completedSteps: 2,
      };
      expect(isWorkflowLogEvent(event)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// State Transition Tests
// ---------------------------------------------------------------------------

describe('WorkflowTypes - State Transitions', () => {
  describe('WorkflowStatus transitions', () => {
    it('defines all expected workflow statuses', () => {
      const validStatuses: WorkflowStatus[] = [
        'idle',
        'planning',
        'executing',
        'reflecting',
        'done',
        'cancelled',
        'error',
        'timeout',
      ];

      // Test that these are the expected string values
      expect(validStatuses).toContain('idle');
      expect(validStatuses).toContain('planning');
      expect(validStatuses).toContain('executing');
      expect(validStatuses).toContain('reflecting');
      expect(validStatuses).toContain('done');
      expect(validStatuses).toContain('cancelled');
      expect(validStatuses).toContain('error');
      expect(validStatuses).toContain('timeout');
    });

    it('supports proper workflow state transitions', () => {
      // Test that we can create a WorkflowState with all status values
      const baseState = {
        id: 'wf-test',
        status: 'idle' as WorkflowStatus,
        userMessage: 'Test message',
        plan: null,
        steps: [],
        currentStepIndex: 0,
        replanCount: 0,
        config: makeBasicConfig(),
        startedAt: new Date().toISOString(),
      };

      // Should be able to transition through all states
      const stateTransitions: WorkflowStatus[] = [
        'planning',
        'executing',
        'reflecting',
        'done',
      ];

      for (const status of stateTransitions) {
        const state: WorkflowState = { ...baseState, status };
        expect(state.status).toBe(status);
      }

      // Error states
      const errorStates: WorkflowStatus[] = ['cancelled', 'error', 'timeout'];
      for (const status of errorStates) {
        const state: WorkflowState = { ...baseState, status };
        expect(state.status).toBe(status);
      }
    });
  });

  describe('WorkflowStepStatus transitions', () => {
    it('defines all expected step statuses', () => {
      const validStepStatuses: WorkflowStepStatus[] = [
        'pending',
        'running',
        'success',
        'failed',
        'skipped',
      ];

      expect(validStepStatuses).toContain('pending');
      expect(validStepStatuses).toContain('running');
      expect(validStepStatuses).toContain('success');
      expect(validStepStatuses).toContain('failed');
      expect(validStepStatuses).toContain('skipped');
    });

    it('supports step status progression', () => {
      const baseStep = makeBasicWorkflowStep();

      // Test normal execution flow: pending -> running -> success
      baseStep.status = 'pending';
      expect(baseStep.status).toBe('pending');

      baseStep.status = 'running';
      expect(baseStep.status).toBe('running');

      baseStep.status = 'success';
      expect(baseStep.status).toBe('success');

      // Test failure flow: pending -> running -> failed
      const failedStep = makeBasicWorkflowStep();
      failedStep.status = 'running';
      failedStep.status = 'failed';
      expect(failedStep.status).toBe('failed');

      // Test skip: pending -> skipped
      const skippedStep = makeBasicWorkflowStep();
      skippedStep.status = 'skipped';
      expect(skippedStep.status).toBe('skipped');
    });
  });

  describe('WorkflowStepReflection nextAction values', () => {
    it('defines all expected reflection next actions', () => {
      const reflection: WorkflowStepReflection = {
        assessment: 'success',
        nextAction: 'continue',
      };

      const validActions = ['continue', 'adjust_plan', 'complete', 'abort'];
      for (const action of validActions) {
        reflection.nextAction = action as WorkflowStepReflection['nextAction'];
        expect(reflection.nextAction).toBe(action);
      }
    });

    it('supports reflection assessment values', () => {
      const reflection: WorkflowStepReflection = {
        assessment: 'success',
        nextAction: 'continue',
      };

      const validAssessments = ['success', 'partial', 'failure'];
      for (const assessment of validAssessments) {
        reflection.assessment = assessment as WorkflowStepReflection['assessment'];
        expect(reflection.assessment).toBe(assessment);
      }
    });

    it('supports optional reflection fields', () => {
      const minimalReflection: WorkflowStepReflection = {
        assessment: 'success',
        nextAction: 'continue',
      };
      expect(minimalReflection.comment).toBeUndefined();
      expect(minimalReflection.finalAnswer).toBeUndefined();
      expect(minimalReflection.planAdjustment).toBeUndefined();

      const fullReflection: WorkflowStepReflection = {
        assessment: 'partial',
        nextAction: 'adjust_plan',
        comment: 'Step partially successful',
        planAdjustment: {
          reason: 'Need additional steps',
          newSteps: [makeBasicPlanStep('new-step')],
        },
      };
      expect(fullReflection.comment).toBe('Step partially successful');
      expect(fullReflection.planAdjustment?.reason).toBe('Need additional steps');
      expect(fullReflection.planAdjustment?.newSteps).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Data Structure Validation Tests
// ---------------------------------------------------------------------------

describe('WorkflowTypes - Data Structure Validation', () => {
  describe('WorkflowPlanStep structure', () => {
    it('creates valid WorkflowPlanStep with all required fields', () => {
      const step: WorkflowPlanStep = {
        id: 'test-step-1',
        description: 'Execute test action',
        expectedTools: ['file_write', 'run_command'],
        dependsOn: ['previous-step'],
        successCriteria: 'Files created successfully',
      };

      expect(step.id).toBe('test-step-1');
      expect(step.description).toBe('Execute test action');
      expect(step.expectedTools).toEqual(['file_write', 'run_command']);
      expect(step.dependsOn).toEqual(['previous-step']);
      expect(step.successCriteria).toBe('Files created successfully');
    });

    it('supports optional stepType and control flow fields', () => {
      const conditionStep: WorkflowPlanStep = {
        ...makeBasicPlanStep('cond-1'),
        stepType: 'condition',
        conditionConfig: {
          mode: 'llm',
          prompt: 'Is the file ready?',
        },
      };

      expect(conditionStep.stepType).toBe('condition');
      expect(conditionStep.conditionConfig?.mode).toBe('llm');
      expect(conditionStep.conditionConfig?.prompt).toBe('Is the file ready?');

      const loopStep: WorkflowPlanStep = {
        ...makeBasicPlanStep('loop-1'),
        stepType: 'loop',
        loopConfig: {
          mode: 'count',
          maxIterations: 5,
          count: 3,
          bodyStepIds: ['step-a', 'step-b'],
        },
      };

      expect(loopStep.stepType).toBe('loop');
      expect(loopStep.loopConfig?.mode).toBe('count');
      expect(loopStep.loopConfig?.count).toBe(3);
      expect(loopStep.loopConfig?.bodyStepIds).toEqual(['step-a', 'step-b']);
    });
  });

  describe('WorkflowConfig defaults', () => {
    it('provides correct WORKFLOW_DEFAULTS', () => {
      expect(WORKFLOW_DEFAULTS.maxSteps).toBe(8);
      expect(WORKFLOW_DEFAULTS.maxRePlans).toBe(2);
      expect(WORKFLOW_DEFAULTS.timeoutMs).toBe(600_000); // 10 minutes
      expect(WORKFLOW_DEFAULTS.stepTimeoutMs).toBe(240_000); // 4 minutes
      expect(WORKFLOW_DEFAULTS.enableReflection).toBe(true); // Default ON per Adi's decision
      expect(WORKFLOW_DEFAULTS.enablePlanning).toBe(true);
    });

    it('merges defaults with custom config', () => {
      const customConfig: WorkflowConfig = {
        ...WORKFLOW_DEFAULTS,
        model: 'custom-model',
        enabledTools: ['tool1', 'tool2'],
        maxSteps: 10,
        enableReflection: false,
      };

      expect(customConfig.model).toBe('custom-model');
      expect(customConfig.enabledTools).toEqual(['tool1', 'tool2']);
      expect(customConfig.maxSteps).toBe(10); // Override
      expect(customConfig.maxRePlans).toBe(2); // From defaults
      expect(customConfig.enableReflection).toBe(false); // Override
      expect(customConfig.enablePlanning).toBe(true); // From defaults
    });
  });

  describe('WorkflowState structure integrity', () => {
    it('creates valid WorkflowState with complete data', () => {
      const plan = makeBasicPlan();
      const step = makeBasicWorkflowStep();
      step.status = 'success';
      step.completedAt = new Date().toISOString();
      step.durationMs = 2500;

      const state: WorkflowState = {
        id: 'wf-test-123',
        conversationId: 'conv-456',
        status: 'executing',
        userMessage: 'Create a test file',
        plan,
        steps: [step],
        currentStepIndex: 0,
        replanCount: 0,
        finalAnswer: 'Task completed successfully',
        config: makeBasicConfig(),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 5000,
      };

      expect(state.id).toBe('wf-test-123');
      expect(state.conversationId).toBe('conv-456');
      expect(state.status).toBe('executing');
      expect(state.plan).toBe(plan);
      expect(state.steps).toHaveLength(1);
      expect(state.steps[0]).toBe(step);
      expect(state.finalAnswer).toBe('Task completed successfully');
      expect(state.durationMs).toBe(5000);
    });

    it('supports minimal WorkflowState for new workflow', () => {
      const minimalState: WorkflowState = {
        id: 'wf-new',
        status: 'idle',
        userMessage: 'Start new workflow',
        plan: null,
        steps: [],
        currentStepIndex: 0,
        replanCount: 0,
        config: makeBasicConfig(),
        startedAt: new Date().toISOString(),
      };

      expect(minimalState.id).toBe('wf-new');
      expect(minimalState.status).toBe('idle');
      expect(minimalState.plan).toBeNull();
      expect(minimalState.steps).toHaveLength(0);
      expect(minimalState.finalAnswer).toBeUndefined();
      expect(minimalState.errorMessage).toBeUndefined();
      expect(minimalState.completedAt).toBeUndefined();
    });
  });
});