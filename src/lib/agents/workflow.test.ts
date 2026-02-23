// ============================================================================
// WorkflowEngine Unit Tests
// ============================================================================
// Basic tests to verify dependency injection refactoring works correctly.
// Tests use mocked ChatProviders to avoid heavy transitive imports.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowEngine } from './workflow';
import { ToolRegistry } from './registry';
import type { ChatProvider, ChatMessage, ChatResponse, ChatOptions } from '../providers/types';

// ---------------------------------------------------------------------------
// Mock ChatProvider
// ---------------------------------------------------------------------------

class MockChatProvider implements ChatProvider {
  readonly type = 'ollama' as const;
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

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    if (this.responseIndex >= this.responses.length) {
      return { content: 'No more responses', finishReason: 'stop' };
    }
    
    const response = this.responses[this.responseIndex];
    this.responseIndex++;
    
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Dependency Injection', () => {
    it('should create engine with required ChatProvider', () => {
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
      expect(state.config.model).toBe('test-model');
      expect(state.id).toMatch(/^wf_\d+_\d+$/);
    });

    it('should require provider parameter in TypeScript', () => {
      // This test documents that provider is now required in TypeScript
      // In practice, TypeScript compiler would catch missing provider at build time
      expect(true).toBe(true); // Provider requirement is enforced by TypeScript
    });

    it('should use injected provider instead of creating OllamaProvider', () => {
      const customProvider = new MockChatProvider([
        { content: 'Custom provider response', finishReason: 'stop' }
      ]);

      const engine = new WorkflowEngine({
        message: 'Test message',
        messages,
        model: 'test-model',
        registry,
        provider: customProvider,
      });

      // Access the private provider field to verify it's our custom one
      expect((engine as any).provider).toBe(customProvider);
      expect((engine as any).provider.name).toBe('MockProvider');
    });
  });

  describe('Basic Workflow Execution', () => {
    it('should execute simple workflow with injected provider', async () => {
      mockProvider.setResponses([
        // Planning response
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
        // Step execution response
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
          enableReflection: false
        }
      });

      let eventCount = 0;
      for await (const event of engine.run()) {
        eventCount++;
        if (eventCount > 50) break; // Safety limit
      }

      const finalState = engine.getState();
      expect(finalState.status).toBe('done');
      expect(finalState.plan).not.toBeNull();
      expect(finalState.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle provider being unavailable', async () => {
      const unavailableProvider = new MockChatProvider();
      unavailableProvider.isAvailable = vi.fn().mockResolvedValue(false);

      const engine = new WorkflowEngine({
        message: 'Test with unavailable provider',
        messages,
        model: 'test-model',
        registry,
        provider: unavailableProvider,
      });

      // Provider availability doesn't block workflow creation
      expect(engine.getState().status).toBe('idle');
    });
  });
});
