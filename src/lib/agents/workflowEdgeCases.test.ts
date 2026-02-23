// ============================================================================
// WorkflowEngine Edge Cases Tests
// ============================================================================
// Tests for edge cases, boundary conditions, and error scenarios in the
// WorkflowEngine after dependency injection refactoring.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowEngine } from './workflow';
import { ToolRegistry } from './registry';
import type { ChatProvider, ChatMessage, ChatResponse, ChatOptions } from '../providers/types';
import type { WorkflowStreamEvent, WorkflowPlan } from './workflowTypes';

// ---------------------------------------------------------------------------
// Edge Case Mock Provider
// ---------------------------------------------------------------------------

class EdgeCaseMockProvider implements ChatProvider {
  readonly type = 'ollama' as const;
  readonly name = 'EdgeCaseMockProvider';

  private responses: (ChatResponse | Error)[] = [];
  private responseIndex = 0;
  private callCount = 0;

  constructor(responses: (ChatResponse | Error)[] = []) {
    this.setResponses(responses);
  }

  setResponses(responses: (ChatResponse | Error)[]): void {
    this.responses = responses;
    this.responseIndex = 0;
    this.callCount = 0;
  }

  getCallCount(): number {
    return this.callCount;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    this.callCount++;

    if (this.responseIndex >= this.responses.length) {
      throw new Error(`No more responses available (call ${this.callCount})`);
    }
    
    const response = this.responses[this.responseIndex];
    this.responseIndex++;
    
    if (response instanceof Error) {
      throw response;
    }
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
    
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
    return [{ id: 'edge-case-model', name: 'Edge Case Model', provider: this.type }];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Test Utilities
// ---------------------------------------------------------------------------

function createMinimalRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  
  registry.register({
    definition: {
      name: 'mock_tool',
      description: 'Mock tool for testing',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action to perform' }
        },
        required: ['action']
      }
    },
    handler: async (args) => {
      if (args.action === 'fail') {
        return {
          callId: 'mock-call',
          success: false,
          content: '',
          error: 'Tool intentionally failed'
        };
      }
      return { 
        callId: 'mock-call',
        success: true, 
        content: `Mock result: ${args.action}` 
      };
    }
  });

  return registry;
}

function createEmptyRegistry(): ToolRegistry {
  return new ToolRegistry();
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
// Edge Cases Tests
// ---------------------------------------------------------------------------

describe('WorkflowEngine Edge Cases', () => {
  let mockProvider: EdgeCaseMockProvider;
  let registry: ToolRegistry;
  let messages: ChatMessage[];

  beforeEach(() => {
    mockProvider = new EdgeCaseMockProvider();
    registry = createMinimalRegistry();
    messages = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'User request' }
    ];
    
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Max Iterations Reached', () => {
    it('should stop execution when max steps is reached', async () => {
      mockProvider.setResponses([
        // Planning: return more steps than allowed
        {
          content: JSON.stringify({
            goal: 'Long workflow',
            steps: Array.from({ length: 10 }, (_, i) => ({
              id: `step-${i + 1}`,
              description: `Step ${i + 1}`,
              expectedTools: [],
              dependsOn: [],
              successCriteria: 'Done'
            })),
            maxSteps: 10
          }),
          finishReason: 'stop'
        },
        // Step responses
        ...Array.from({ length: 3 }, () => ({
          content: 'Step completed',
          finishReason: 'stop' as const
        })),
        // Final answer
        {
          content: 'Stopped at max steps',
          finishReason: 'stop'
        }
      ]);

      const engine = new WorkflowEngine({
        message: 'Long workflow test',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          maxSteps: 3, // Limit to 3 steps
          enableReflection: false,
          enableParallelExecution: false
        }
      });

      const events = await collectEventsWithTimeout(engine);
      const stepStartEvents = events.filter(e => e.type === 'step_start');
      
      expect(stepStartEvents.length).toBeLessThanOrEqual(3);
      
      const finalState = engine.getState();
      expect(finalState.steps.length).toBeLessThanOrEqual(3);
    });

    it('should handle max replans limit', async () => {
      mockProvider.setResponses([
        // Initial planning
        {
          content: JSON.stringify({
            goal: 'Replanning test',
            steps: [{ id: 'step-1', description: 'Initial step', expectedTools: [], dependsOn: [], successCriteria: 'Done' }],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        // Step execution
        { content: 'Step executed', finishReason: 'stop' },
        // First reflection suggesting replan
        {
          content: JSON.stringify({
            assessment: 'partial',
            nextAction: 'adjust_plan',
            planAdjustment: {
              reason: 'Need different approach',
              newSteps: [{ id: 'new-step-1', description: 'New step', expectedTools: [], dependsOn: [], successCriteria: 'Done' }]
            }
          }),
          finishReason: 'stop'
        },
        // New step execution after first replan
        { content: 'New step executed', finishReason: 'stop' },
        // Second reflection suggesting replan (should be ignored due to max replans)
        {
          content: JSON.stringify({
            assessment: 'partial',
            nextAction: 'adjust_plan',
            planAdjustment: {
              reason: 'Need another approach',
              newSteps: [{ id: 'newer-step-1', description: 'Newer step', expectedTools: [], dependsOn: [], successCriteria: 'Done' }]
            }
          }),
          finishReason: 'stop'
        },
        // Final answer
        { content: 'Workflow completed with limited replans', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'Test max replans',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          maxRePlans: 1, // Allow only 1 replan
          enableReflection: true,
          enableParallelExecution: false
        }
      });

      const events = await collectEventsWithTimeout(engine);
      const planEvents = events.filter(e => e.type === 'plan') as any[];
      
      // Should have initial plan + 1 adjustment
      expect(planEvents.length).toBeLessThanOrEqual(2);
      
      const finalState = engine.getState();
      expect(finalState.replanCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Empty Plan Handling', () => {
    it('should handle completely empty planning response', async () => {
      mockProvider.setResponses([
        // Empty/invalid planning response
        { content: '', finishReason: 'stop' },
        // Fallback step execution
        { content: 'Fallback execution', finishReason: 'stop' },
        // Final answer
        { content: 'Completed with fallback plan', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'Empty plan test',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: false
        }
      });

      const events = await collectEventsWithTimeout(engine);
      const planEvents = events.filter(e => e.type === 'plan') as any[];
      
      expect(planEvents.length).toBe(1);
      expect(planEvents[0].plan.steps).toHaveLength(1);
      expect(planEvents[0].plan.steps[0].description).toBe('Aufgabe direkt ausführen');
    });

    it.skip('should handle plan with empty steps array', async () => {
      mockProvider.setResponses([
        // Plan with empty steps
        {
          content: JSON.stringify({
            goal: 'Empty steps plan',
            steps: [],
            maxSteps: 0
          }),
          finishReason: 'stop'
        },
        // Fallback execution
        { content: 'Fallback step', finishReason: 'stop' },
        // Final answer
        { content: 'Completed with fallback', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'Empty steps test',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
      });

      const events = await collectEventsWithTimeout(engine);
      const finalState = engine.getState();
      
      expect(finalState.plan).not.toBeNull();
      expect(finalState.plan!.steps).toHaveLength(1); // Fallback plan
    });
  });

  describe('Provider Error Scenarios', () => {
    it('should handle provider throwing errors during planning', async () => {
      mockProvider.setResponses([
        new Error('Planning service unavailable'),
        // Fallback responses after error
        { content: 'Fallback step', finishReason: 'stop' },
        { content: 'Error recovery complete', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'Provider error test',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
      });

      const events = await collectEventsWithTimeout(engine);
      const planEvents = events.filter(e => e.type === 'plan');
      
      // Should still create a fallback plan
      expect(planEvents).toHaveLength(1);
      
      const finalState = engine.getState();
      expect(finalState.status).toBe('done'); // Should recover with fallback
    });

    it('should handle provider errors during step execution', async () => {
      mockProvider.setResponses([
        // Valid planning
        {
          content: JSON.stringify({
            goal: 'Error prone task',
            steps: [
              { id: 'step-1', description: 'Failing step', expectedTools: [], dependsOn: [], successCriteria: 'Success' }
            ],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        // Error during step execution
        new Error('Step execution failed'),
        // Recovery attempt (final answer)
        { content: 'Partial completion despite errors', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'Step error test',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: false
        }
      });

      const events = await collectEventsWithTimeout(engine);
      const errorEvents = events.filter(e => e.type === 'error');
      
      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
      
      const finalState = engine.getState();
      // Should fail gracefully
      expect(['error', 'done', 'cancelled']).toContain(finalState.status);
    });

    it('should handle provider returning invalid JSON', async () => {
      mockProvider.setResponses([
        // Invalid JSON for planning
        { content: '{ invalid json content }', finishReason: 'stop' },
        // Fallback execution
        { content: 'Fallback after JSON error', finishReason: 'stop' },
        // Final answer
        { content: 'Completed despite JSON issues', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'Invalid JSON test',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
      });

      const events = await collectEventsWithTimeout(engine);
      const finalState = engine.getState();
      
      // Should use fallback plan
      expect(finalState.plan).not.toBeNull();
      expect(finalState.plan!.steps[0].description).toBe('Aufgabe direkt ausführen');
    });
  });

  describe('Concurrent Workflow Prevention', () => {
    it('should handle multiple concurrent engine instances independently', async () => {
      const provider1 = new EdgeCaseMockProvider([
        {
          content: JSON.stringify({
            goal: 'Workflow 1',
            steps: [{ id: 'step-1a', description: 'Step 1A', expectedTools: [], dependsOn: [], successCriteria: 'Done' }],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        { content: 'Workflow 1 step', finishReason: 'stop' },
        { content: 'Workflow 1 complete', finishReason: 'stop' }
      ]);

      const provider2 = new EdgeCaseMockProvider([
        {
          content: JSON.stringify({
            goal: 'Workflow 2',
            steps: [{ id: 'step-1b', description: 'Step 1B', expectedTools: [], dependsOn: [], successCriteria: 'Done' }],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        { content: 'Workflow 2 step', finishReason: 'stop' },
        { content: 'Workflow 2 complete', finishReason: 'stop' }
      ]);

      const engine1 = new WorkflowEngine({
        message: 'Concurrent test 1',
        messages,
        model: 'test-model',
        registry,
        provider: provider1,
        config: { enableReflection: false }
      });

      const engine2 = new WorkflowEngine({
        message: 'Concurrent test 2',
        messages,
        model: 'test-model',
        registry,
        provider: provider2,
        config: { enableReflection: false }
      });

      // Run both concurrently
      const [events1, events2] = await Promise.all([
        collectEventsWithTimeout(engine1),
        collectEventsWithTimeout(engine2)
      ]);

      const state1 = engine1.getState();
      const state2 = engine2.getState();

      // Both should complete independently
      expect(state1.id).not.toBe(state2.id);
      expect(state1.plan?.goal).toBe('Workflow 1');
      expect(state2.plan?.goal).toBe('Workflow 2');
      
      // Check that they didn't interfere with each other
      expect(provider1.getCallCount()).toBeGreaterThanOrEqual(2);
      expect(provider2.getCallCount()).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Resource Constraints', () => {
    it('should handle workflow with no available tools', async () => {
      const emptyRegistry = createEmptyRegistry();
      
      mockProvider.setResponses([
        // Planning with no tools available
        {
          content: JSON.stringify({
            goal: 'No tools task',
            steps: [{ id: 'step-1', description: 'Manual step', expectedTools: [], dependsOn: [], successCriteria: 'Done' }],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        // Step execution without tools
        { content: 'Completed without tools', finishReason: 'stop' },
        // Final answer
        { content: 'Task completed using reasoning only', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'No tools test',
        messages,
        model: 'test-model',
        registry: emptyRegistry,
        provider: mockProvider,
      });

      const events = await collectEventsWithTimeout(engine);
      const finalState = engine.getState();
      
      expect(finalState.status).toBe('done');
      expect(finalState.config.enabledTools).toHaveLength(0);
    });

    it('should handle extremely long messages gracefully', async () => {
      const longMessage = 'A'.repeat(100000); // 100k character message
      
      mockProvider.setResponses([
        {
          content: JSON.stringify({
            goal: 'Process long input',
            steps: [{ id: 'step-1', description: 'Handle long text', expectedTools: [], dependsOn: [], successCriteria: 'Processed' }],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        { content: 'Long message processed', finishReason: 'stop' },
        { content: 'Successfully handled large input', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: longMessage,
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
        config: {
          enableReflection: false
        }
      });

      const events = await collectEventsWithTimeout(engine);
      const finalState = engine.getState();
      
      expect(finalState.userMessage).toBe(longMessage);
      expect(finalState.status).toBe('done');
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state during rapid cancellations', async () => {
      mockProvider.setResponses([
        {
          content: JSON.stringify({
            goal: 'Cancellation test',
            steps: Array.from({ length: 5 }, (_, i) => ({
              id: `step-${i + 1}`,
              description: `Step ${i + 1}`,
              expectedTools: [],
              dependsOn: [],
              successCriteria: 'Done'
            })),
            maxSteps: 5
          }),
          finishReason: 'stop'
        },
        ...Array.from({ length: 10 }, () => ({
          content: 'Step in progress',
          finishReason: 'stop' as const
        }))
      ]);

      const engine = new WorkflowEngine({
        message: 'Rapid cancellation test',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
      });

      // Start execution and cancel very quickly multiple times
      const startTime = Date.now();
      const runPromise = collectEventsWithTimeout(engine, 2000);
      
      setTimeout(() => engine.cancel(), 10);
      setTimeout(() => engine.cancel(), 20); // Second cancel should be safe
      setTimeout(() => engine.cancel(), 30); // Third cancel should be safe

      const events = await runPromise;
      const finalState = engine.getState();
      
      // Should end in cancelled state regardless of multiple cancel calls
      expect(finalState.status).toBe('cancelled');
      
      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeLessThan(1000); // Should cancel quickly
    });

    it.skip('should handle state queries during execution', async () => {
      mockProvider.setResponses([
        {
          content: JSON.stringify({
            goal: 'State query test',
            steps: [{ id: 'step-1', description: 'Long step', expectedTools: [], dependsOn: [], successCriteria: 'Done' }],
            maxSteps: 1
          }),
          finishReason: 'stop'
        },
        { content: 'Step result', finishReason: 'stop' },
        { content: 'Final answer', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'State query test',
        messages,
        model: 'test-model',
        registry,
        provider: mockProvider,
      });

      const states: string[] = [];
      
      // Start execution and periodically check state
      const runPromise = collectEventsWithTimeout(engine);
      
      const statePoller = setInterval(() => {
        const state = engine.getState();
        states.push(state.status);
      }, 50);

      const events = await runPromise;
      clearInterval(statePoller);
      
      // Should have seen multiple different states
      expect(states.length).toBeGreaterThan(0);
      expect(new Set(states).size).toBeGreaterThanOrEqual(2); // At least 2 different states
    });
  });
});
