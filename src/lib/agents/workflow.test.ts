// ============================================================================
// WorkflowEngine Unit Tests
// ============================================================================
// Tests for the WorkflowEngine state machine and core functionality after
// dependency injection refactoring. 
//
// These tests use mocked ChatProviders to avoid heavy transitive imports.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowEngine } from './workflow';
import { ToolRegistry } from './registry';
import type { ChatProvider, ChatMessage, ChatResponse, ChatOptions } from '../providers/types';
import type { WorkflowStreamEvent, WorkflowPlan } from './workflowTypes';

// ---------------------------------------------------------------------------
// Mock ChatProvider
// ---------------------------------------------------------------------------

class MockChatProvider implements ChatProvider {
  readonly type = 'mock' as const;
  readonly name = 'MockProvider';

  private responses: ChatResponse[] = [];
  private responseIndex = 0;

  constructor(responses: ChatResponse[] = []) {
    this.setResponses(responses);
  }

  setResponses(responses: ChatResponse[]): void {
    this.responses = responses;
    this.responseIndex = 0;
  }

  addResponse(response: ChatResponse): void {
    this.responses.push(response);
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    if (this.responseIndex >= this.responses.length) {
      throw new Error('No more mock responses available');
    }
    
    const response = this.responses[this.responseIndex];
    this.responseIndex++;
    
    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return response;
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions) {
    const response = await this.chat(messages, options);
    yield {
      content: response.content,
      done: true,
      usage: response.usage
    };
  }

  async listModels() {
    return [{ id: 'mock-model', name: 'Mock Model', provider: this.type }];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Test Utilities
// ---------------------------------------------------------------------------

function createMockRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  
  // Add a mock tool for testing
  registry.register({
    definition: {
      name: 'test_tool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Test message' }
        },
        required: ['message']
      }
    },
    handler: async (args) => {
      return { 
        callId: 'test-call',
        success: true, 
        content: `Test result: ${args.message}` 
      };
    }
  });

  return registry;
}

function createBasicMessages(): ChatMessage[] {
  return [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Please help me with a test task.' }
  ];
}

async function collectEvents(engine: WorkflowEngine): Promise<WorkflowStreamEvent[]> {
  const events: WorkflowStreamEvent[] = [];
  
  try {
    for await (const event of engine.run()) {
      events.push(event);
    }
  } catch (error) {
    // Collect error as final event
    events.push({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      recoverable: false
    });
  }
  
  return events;
}

async function collectEventsWithTimeout(engine: WorkflowEngine, timeoutMs: number = 5000): Promise<WorkflowStreamEvent[]> {
  const events: WorkflowStreamEvent[] = [];
  
  return new Promise<WorkflowStreamEvent[]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      engine.cancel();
      resolve(events); // Return what we collected so far
    }, timeoutMs);

    (async () => {
      try {
        for await (const event of engine.run()) {
          events.push(event);
        }
        clearTimeout(timeout);
        resolve(events);
      } catch (error) {
        clearTimeout(timeout);
        events.push({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: false
        });
        resolve(events);
      }
    })();
  });
}

// ---------------------------------------------------------------------------
// Core Tests
// ---------------------------------------------------------------------------

describe('WorkflowEngine', () => {
  let mockProvider: MockChatProvider;
  let registry: ToolRegistry;
  let messages: ChatMessage[];

  beforeEach(() => {
    mockProvider = new MockChatProvider();
    registry = createMockRegistry();
    messages = createBasicMessages();
    
    // Clear all timers between tests
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Basic State', () => {
    it('should create engine with correct initial state', () => {
      const engine = new WorkflowEngine({
        message: 'Test message',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
      });

      const state = engine.getState();
      expect(state.status).toBe('idle');
      expect(state.userMessage).toBe('Test message');
      expect(state.plan).toBeNull();
      expect(state.steps).toHaveLength(0);
      expect(state.currentStepIndex).toBe(0);
      expect(state.replanCount).toBe(0);
      expect(state.config.model).toBe('test-model');
      expect(state.id).toMatch(/^wf_\d+_\d+$/);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        maxSteps: 3,
        enableReflection: false,
        timeoutMs: 10000
      };

      const engine = new WorkflowEngine({
        message: 'Test message',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: customConfig,
      });

      const state = engine.getState();
      expect(state.config.maxSteps).toBe(3);
      expect(state.config.enableReflection).toBe(false);
      expect(state.config.timeoutMs).toBe(10000);
    });

    it('should accept initial plan', () => {
      const initialPlan: WorkflowPlan = {
        goal: 'Test goal',
        steps: [
          {
            id: 'step-1',
            description: 'Test step',
            expectedTools: ['test_tool'],
            dependsOn: [],
            successCriteria: 'Success'
          }
        ],
        maxSteps: 1,
        createdAt: new Date().toISOString(),
        version: 1
      };

      const engine = new WorkflowEngine({
        message: 'Test message',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        initialPlan,
      });

      const state = engine.getState();
      expect(state.plan).toEqual(initialPlan);
    });
  });

  describe('State Machine Transitions', () => {
    it('should transition from idle -> planning -> executing -> done', async () => {
      // Mock planning response
      mockProvider.setResponses([
        {
          content: JSON.stringify({
            goal: 'Complete test task',
            steps: [
              {
                id: 'step-1',
                description: 'Execute test',
                expectedTools: ['test_tool'],
                dependsOn: [],
                successCriteria: 'Task completed'
              }
            ],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        // Step execution response (empty - no tool calls)
        {
          content: 'Task completed successfully.',
          finishReason: 'stop'
        },
        // Final answer response
        {
          content: 'The test task has been completed successfully.',
          finishReason: 'stop'
        }
      ]);

      const engine = new WorkflowEngine({
        message: 'Complete a test task',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: false, // Simplify for this test
          enableParallelExecution: false
        }
      });

      const events = await collectEvents(engine);
      const statusEvents = events.filter(e => ['workflow_start', 'plan', 'step_start', 'step_end', 'workflow_end'].includes(e.type));
      
      expect(statusEvents).toHaveLength(5);
      expect(statusEvents[0].type).toBe('workflow_start');
      expect(statusEvents[1].type).toBe('plan');
      expect(statusEvents[2].type).toBe('step_start');
      expect(statusEvents[3].type).toBe('step_end');
      expect(statusEvents[4].type).toBe('workflow_end');

      const finalState = engine.getState();
      expect(finalState.status).toBe('done');
    });

    it('should handle workflow cancellation', async () => {
      mockProvider.setResponses([
        // Planning
        {
          content: JSON.stringify({
            goal: 'Long running task',
            steps: [{ id: 'step-1', description: 'Wait', expectedTools: [], dependsOn: [], successCriteria: 'Done' }],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        // Extra responses in case execution starts
        { content: 'Step executing...', finishReason: 'stop' },
        { content: 'Cancelled during execution', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'Long task',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: false
        }
      });

      // Start workflow and cancel very quickly
      const runPromise = collectEventsWithTimeout(engine, 1000);
      setTimeout(() => engine.cancel(), 10); // Cancel almost immediately
      
      const events = await runPromise;
      const finalState = engine.getState();
      
      expect(finalState.status).toBe('cancelled');
      expect(events.some(e => e.type === 'cancelled')).toBe(true);
    });
  });

  describe('Plan Execution', () => {
    it('should execute steps in linear mode', async () => {
      mockProvider.setResponses([
        // Planning response
        {
          content: JSON.stringify({
            goal: 'Multi-step task',
            steps: [
              {
                id: 'step-1',
                description: 'First step',
                expectedTools: ['test_tool'],
                dependsOn: [],
                successCriteria: 'First done'
              },
              {
                id: 'step-2',
                description: 'Second step',
                expectedTools: ['test_tool'],
                dependsOn: ['step-1'],
                successCriteria: 'Second done'
              }
            ],
            maxSteps: 2
          }),
          finishReason: 'stop'
        },
        // Step 1 execution
        {
          content: 'First step completed.',
          finishReason: 'stop'
        },
        // Step 2 execution
        {
          content: 'Second step completed.',
          finishReason: 'stop'
        },
        // Final answer
        {
          content: 'Both steps completed successfully.',
          finishReason: 'stop'
        }
      ]);

      const engine = new WorkflowEngine({
        message: 'Execute multi-step task',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: false,
          enableParallelExecution: false
        }
      });

      const events = await collectEvents(engine);
      const stepEvents = events.filter(e => e.type === 'step_start');
      
      expect(stepEvents).toHaveLength(2);
      expect(stepEvents[0]).toMatchObject({
        type: 'step_start',
        stepId: 'step-1',
        description: 'First step'
      });
      expect(stepEvents[1]).toMatchObject({
        type: 'step_start',
        stepId: 'step-2',
        description: 'Second step'
      });

      const finalState = engine.getState();
      expect(finalState.steps).toHaveLength(2);
      expect(finalState.status).toBe('done');
    });

    it('should handle planning failure with fallback plan', async () => {
      mockProvider.setResponses([
        // Invalid planning response
        {
          content: 'This is not valid JSON for a plan.',
          finishReason: 'stop'
        },
        // Fallback step execution
        {
          content: 'Executed fallback step.',
          finishReason: 'stop'
        },
        // Final answer
        {
          content: 'Task completed with fallback plan.',
          finishReason: 'stop'
        }
      ]);

      const engine = new WorkflowEngine({
        message: 'Test fallback planning',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: false
        }
      });

      const events = await collectEvents(engine);
      const planEvents = events.filter(e => e.type === 'plan');
      
      expect(planEvents).toHaveLength(1);
      const planEvent = planEvents[0] as any;
      expect(planEvent.plan.goal).toBe('Test fallback planning');
      expect(planEvent.plan.steps).toHaveLength(1);
      expect(planEvent.plan.steps[0].id).toBe('step-1');
      expect(planEvent.plan.steps[0].description).toBe('Aufgabe direkt ausführen');
    });
  });

  describe('Reflection and Plan Adjustment', () => {
    it('should handle reflection with continue action', async () => {
      mockProvider.setResponses([
        // Planning
        {
          content: JSON.stringify({
            goal: 'Test reflection',
            steps: [
              { id: 'step-1', description: 'First step', expectedTools: [], dependsOn: [], successCriteria: 'Done' },
              { id: 'step-2', description: 'Second step', expectedTools: [], dependsOn: [], successCriteria: 'Done' }
            ],
            maxSteps: 2
          }),
          finishReason: 'stop'
        },
        // Step 1 execution
        { content: 'Step 1 done.', finishReason: 'stop' },
        // Reflection
        {
          content: JSON.stringify({
            assessment: 'success',
            nextAction: 'continue',
            comment: 'Good progress, continue to next step'
          }),
          finishReason: 'stop'
        },
        // Step 2 execution
        { content: 'Step 2 done.', finishReason: 'stop' },
        // Second reflection
        {
          content: JSON.stringify({
            assessment: 'success',
            nextAction: 'continue',
            comment: 'All steps completed successfully'
          }),
          finishReason: 'stop'
        },
        // Final answer
        { content: 'Both steps completed.', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'Test reflection continue',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: true,
          enableParallelExecution: false
        }
      });

      const events = await collectEvents(engine);
      const reflectionEvents = events.filter(e => e.type === 'reflection');
      
      expect(reflectionEvents).toHaveLength(2); // One after each step
      expect(reflectionEvents[0]).toMatchObject({
        type: 'reflection',
        stepId: 'step-1',
        assessment: 'success',
        nextAction: 'continue'
      });
    });

    it('should handle reflection with early completion', async () => {
      mockProvider.setResponses([
        // Planning
        {
          content: JSON.stringify({
            goal: 'Early completion test',
            steps: [
              { id: 'step-1', description: 'Only step needed', expectedTools: [], dependsOn: [], successCriteria: 'Complete' }
            ],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        // Step execution
        { content: 'Task fully completed in one step.', finishReason: 'stop' },
        // Reflection with completion
        {
          content: JSON.stringify({
            assessment: 'success',
            nextAction: 'complete',
            finalAnswer: 'The task has been completed successfully in the first step.',
            comment: 'No further steps needed'
          }),
          finishReason: 'stop'
        }
      ]);

      const engine = new WorkflowEngine({
        message: 'Simple task',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: true
        }
      });

      const events = await collectEvents(engine);
      const messageEvents = events.filter(e => e.type === 'message');
      
      expect(messageEvents).toHaveLength(1);
      expect(messageEvents[0]).toMatchObject({
        type: 'message',
        content: 'The task has been completed successfully in the first step.',
        done: true
      });

      const finalState = engine.getState();
      expect(finalState.status).toBe('done');
      expect(finalState.finalAnswer).toBe('The task has been completed successfully in the first step.');
    });

    it('should handle reflection with abort action', async () => {
      mockProvider.setResponses([
        // Planning
        {
          content: JSON.stringify({
            goal: 'Task that will abort',
            steps: [
              { id: 'step-1', description: 'Problematic step', expectedTools: [], dependsOn: [], successCriteria: 'Success' }
            ],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        // Step execution
        { content: 'Step encountered issues.', finishReason: 'stop' },
        // Reflection with abort
        {
          content: JSON.stringify({
            assessment: 'failure',
            nextAction: 'abort',
            abortReason: 'Unrecoverable error occurred',
            comment: 'Cannot proceed further'
          }),
          finishReason: 'stop'
        }
      ]);

      const engine = new WorkflowEngine({
        message: 'Task with abort',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: true
        }
      });

      const events = await collectEvents(engine);
      const errorEvents = events.filter(e => e.type === 'error');
      
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toMatchObject({
        type: 'error',
        message: 'Unrecoverable error occurred',
        recoverable: false
      });

      const finalState = engine.getState();
      expect(finalState.status).toBe('error');
      expect(finalState.errorMessage).toBe('Unrecoverable error occurred');
    });
  });

  describe('Timeout Handling', () => {
    it('should handle global timeout', async () => {
      vi.useFakeTimers();
      
      // Create a provider that never responds
      const slowProvider = new MockChatProvider();
      slowProvider.chat = vi.fn().mockImplementation(async () => {
        // Never resolve - will be cancelled by timeout
        return new Promise(() => {});
      });

      const engine = new WorkflowEngine({
        message: 'Long running task',
        messages,
        model: 'test-model',
        registry,
        provider: slowProvider,
        config: {
          timeoutMs: 1000, // 1 second timeout
          enableReflection: false
        }
      });

      const runPromise = collectEventsWithTimeout(engine, 2000);
      
      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(1500);
      
      const events = await runPromise;
      const finalState = engine.getState();
      
      expect(finalState.status).toBe('timeout');
      
      vi.useRealTimers();
    }, 10000); // 10 second test timeout

    it('should handle step timeout', async () => {
      vi.useFakeTimers();
      
      // Mock a provider that hangs during step execution
      const slowProvider = new MockChatProvider([
        // Planning succeeds
        {
          content: JSON.stringify({
            goal: 'Quick task',
            steps: [{ id: 'step-1', description: 'Quick step', expectedTools: [], dependsOn: [], successCriteria: 'Done' }],
            maxSteps: 1
          }),
          finishReason: 'stop'
        }
      ]);
      
      // Make the step execution hang
      slowProvider.chat = vi.fn()
        .mockResolvedValueOnce({
          content: JSON.stringify({
            goal: 'Quick task',
            steps: [{ id: 'step-1', description: 'Quick step', expectedTools: [], dependsOn: [], successCriteria: 'Done' }],
            maxSteps: 1
          }),
          finishReason: 'stop'
        })
        .mockImplementation(async () => {
          // Hang on subsequent calls (step execution)
          return new Promise(() => {});
        });

      const engine = new WorkflowEngine({
        message: 'Quick task',
        messages,
        model: 'test-model',
        registry,
        provider: slowProvider,
        config: {
          stepTimeoutMs: 1000, // 1 second step timeout
          timeoutMs: 30000, // 30 second global timeout
          enableReflection: false
        }
      });

      const runPromise = collectEventsWithTimeout(engine, 3000);
      
      // Fast-forward to trigger step timeout but not global timeout
      vi.advanceTimersByTime(1500);
      
      const events = await runPromise;
      const logEvents = events.filter(e => e.type === 'log') as any[];
      const timeoutLogs = logEvents.filter(log => log.message.includes('TIMED OUT'));
      
      expect(timeoutLogs.length).toBeGreaterThan(0);
      
      vi.useRealTimers();
    }, 10000); // 10 second test timeout
  });

  describe('Error Recovery', () => {
    it('should handle provider errors gracefully', async () => {
      const failingProvider = new MockChatProvider();
      failingProvider.chat = vi.fn().mockRejectedValue(new Error('Provider connection failed'));

      const engine = new WorkflowEngine({
        message: 'Test error handling',
        messages,
        model: 'test-model',
        registry,
        provider: failingProvider,
        config: {
          enableReflection: false,
          enablePlanning: false // Skip planning to ensure we get to the error faster
        }
      });

      const events = await collectEventsWithTimeout(engine, 2000);
      const finalState = engine.getState();
      
      expect(finalState.status).toBe('error');
      expect(events.some(e => e.type === 'error')).toBe(true);
    });

    it('should continue execution despite step failures when possible', async () => {
      mockProvider.setResponses([
        // Planning
        {
          content: JSON.stringify({
            goal: 'Resilient task',
            steps: [
              { id: 'step-1', description: 'Good step', expectedTools: [], dependsOn: [], successCriteria: 'Success' },
              { id: 'step-2', description: 'Another good step', expectedTools: [], dependsOn: [], successCriteria: 'Success' }
            ],
            maxSteps: 2
          }),
          finishReason: 'stop'
        },
        // Step 1
        { content: 'Step 1 result', finishReason: 'stop' },
        // Step 2 continues despite step 1 "failure"
        { content: 'Step 2 result', finishReason: 'stop' },
        // Final answer
        { content: 'Workflow completed despite issues.', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'Resilient workflow',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: false,
          enableParallelExecution: false
        }
      });

      const events = await collectEventsWithTimeout(engine, 3000);
      const stepEndEvents = events.filter(e => e.type === 'step_end');
      
      expect(stepEndEvents).toHaveLength(2);
      
      const finalState = engine.getState();
      expect(finalState.status).toBe('done');
      expect(finalState.steps).toHaveLength(2);
    });
  });
});