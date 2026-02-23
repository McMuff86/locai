// ============================================================================
// WorkflowEngine Integration Test – Multi-Step File Operations
// ============================================================================
// Tests a complete workflow: read_file → process → write_file
// Uses MockChatProvider with tool call responses to exercise the full
// engine pipeline including planning, tool execution, and finalization.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowEngine } from './workflow';
import { ToolRegistry } from './registry';
import type { ChatProvider, ChatMessage, ChatResponse, ChatOptions } from '../providers/types';
import type { WorkflowStreamEvent } from './workflowTypes';

// ---------------------------------------------------------------------------
// In-memory filesystem for deterministic testing
// ---------------------------------------------------------------------------

const memFs = new Map<string, string>();

function createFileToolsRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    definition: {
      name: 'read_file',
      description: 'Read a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
        },
        required: ['path'],
      },
    },
    handler: async (args) => {
      const filePath = args.path as string;
      const content = memFs.get(filePath);
      if (content === undefined) {
        return { callId: 'rf', success: false, content: '', error: `File not found: ${filePath}` };
      }
      return { callId: 'rf', success: true, content: `File: ${filePath}\n\n${content}` };
    },
  });

  registry.register({
    definition: {
      name: 'write_file',
      description: 'Write a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
    handler: async (args) => {
      const filePath = args.path as string;
      const content = args.content as string;
      memFs.set(filePath, content);
      return { callId: 'wf', success: true, content: `Written: ${filePath} (${content.length} chars)` };
    },
  });

  return registry;
}

// ---------------------------------------------------------------------------
// Mock Provider that returns tool_calls
// ---------------------------------------------------------------------------

class IntegrationMockProvider implements ChatProvider {
  readonly type = 'ollama' as const;
  readonly name = 'IntegrationMockProvider';

  private responses: ChatResponse[] = [];
  private idx = 0;

  setResponses(r: ChatResponse[]) {
    this.responses = r;
    this.idx = 0;
  }

  async chat(_msgs: ChatMessage[], _opts: ChatOptions): Promise<ChatResponse> {
    if (this.idx >= this.responses.length) {
      return { content: 'No more responses', finishReason: 'stop' };
    }
    return this.responses[this.idx++];
  }

  async *chatStream(msgs: ChatMessage[], opts: ChatOptions) {
    const r = await this.chat(msgs, opts);
    yield { content: r.content, done: true, usage: r.usage };
  }

  async listModels() {
    return [{ id: 'mock', name: 'Mock', provider: this.type }];
  }

  async isAvailable() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collectEvents(engine: WorkflowEngine, timeoutMs = 8000): Promise<WorkflowStreamEvent[]> {
  const events: WorkflowStreamEvent[] = [];
  return new Promise<WorkflowStreamEvent[]>((resolve) => {
    const timeout = setTimeout(() => { engine.cancel(); resolve(events); }, timeoutMs);
    (async () => {
      try {
        for await (const ev of engine.run()) {
          events.push(ev);
        }
      } catch { /* ignore */ }
      clearTimeout(timeout);
      resolve(events);
    })();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkflowEngine Integration – File Operations', () => {
  let provider: IntegrationMockProvider;
  let registry: ToolRegistry;
  let messages: ChatMessage[];

  beforeEach(() => {
    memFs.clear();
    provider = new IntegrationMockProvider();
    registry = createFileToolsRegistry();
    messages = [
      { role: 'system', content: 'You are a helpful assistant with file tools.' },
      { role: 'user', content: 'Read input.txt, uppercase the content, write to output.txt.' },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete a read → process → write workflow', async () => {
    // Seed the in-memory filesystem
    memFs.set('input.txt', 'hello world');

    provider.setResponses([
      // 1) Planning response – 2 steps: read then write
      {
        content: JSON.stringify({
          goal: 'Read input.txt, uppercase, write output.txt',
          steps: [
            {
              id: 'step-1',
              description: 'Read input.txt',
              expectedTools: ['read_file'],
              dependsOn: [],
              successCriteria: 'File content obtained',
            },
            {
              id: 'step-2',
              description: 'Write uppercased content to output.txt',
              expectedTools: ['write_file'],
              dependsOn: ['step-1'],
              successCriteria: 'File written',
            },
          ],
          maxSteps: 2,
        }),
        finishReason: 'stop',
      },
      // 2) Step 1 execution – model requests read_file tool
      {
        content: '',
        finishReason: 'stop',
        toolCalls: [
          { id: 'tc1', name: 'read_file', arguments: { path: 'input.txt' } },
        ],
      },
      // 3) After tool result, model produces step summary
      {
        content: 'Read input.txt successfully. Content is: hello world',
        finishReason: 'stop',
      },
      // 4) Step 2 execution – model requests write_file
      {
        content: '',
        finishReason: 'stop',
        toolCalls: [
          { id: 'tc2', name: 'write_file', arguments: { path: 'output.txt', content: 'HELLO WORLD' } },
        ],
      },
      // 5) After tool result, model produces step summary
      {
        content: 'Written uppercased content to output.txt.',
        finishReason: 'stop',
      },
      // 6) Final answer
      {
        content: 'Done! Uppercased content written to output.txt.',
        finishReason: 'stop',
      },
    ]);

    const engine = new WorkflowEngine({
      message: 'Read input.txt, uppercase the content, write to output.txt.',
      messages,
      model: 'test-model',
      registry,
      provider,
      config: { enableReflection: false },
    });

    const events = await collectEvents(engine);
    const state = engine.getState();

    // Workflow should complete
    expect(state.status).toBe('done');

    // Plan should have 2 steps
    expect(state.plan).not.toBeNull();
    expect(state.plan!.steps).toHaveLength(2);

    // Verify file was actually written to in-memory fs
    expect(memFs.get('output.txt')).toBe('HELLO WORLD');

    // Should have plan and step events
    const planEvents = events.filter((e) => e.type === 'plan');
    expect(planEvents).toHaveLength(1);

    const stepStartEvents = events.filter((e) => e.type === 'step_start');
    expect(stepStartEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle read_file failure gracefully in workflow', async () => {
    // No file seeded – read will fail

    provider.setResponses([
      // Planning
      {
        content: JSON.stringify({
          goal: 'Read missing file',
          steps: [
            {
              id: 'step-1',
              description: 'Read missing.txt',
              expectedTools: ['read_file'],
              dependsOn: [],
              successCriteria: 'File read',
            },
          ],
          maxSteps: 1,
        }),
        finishReason: 'stop',
      },
      // Step execution – tool call
      {
        content: '',
        finishReason: 'stop',
        toolCalls: [
          { id: 'tc1', name: 'read_file', arguments: { path: 'missing.txt' } },
        ],
      },
      // Model sees error, responds
      {
        content: 'The file missing.txt does not exist.',
        finishReason: 'stop',
      },
      // Final answer
      {
        content: 'Could not complete: file not found.',
        finishReason: 'stop',
      },
    ]);

    const engine = new WorkflowEngine({
      message: 'Read missing.txt',
      messages,
      model: 'test-model',
      registry,
      provider,
      config: { enableReflection: false },
    });

    const events = await collectEvents(engine);
    const state = engine.getState();

    expect(state.status).toBe('done');

    // Tool call should show the error
    const toolEvents = events.filter((e) => e.type === 'tool_result');
    if (toolEvents.length > 0) {
      const toolResult = toolEvents[0] as any;
      expect(toolResult.error || toolResult.result?.error).toBeTruthy();
    }
  });

  it('should execute sequential read and write in correct order', async () => {
    memFs.set('data.csv', 'name,age\nAlice,30\nBob,25');

    provider.setResponses([
      // Planning – single step
      {
        content: JSON.stringify({
          goal: 'Process CSV data',
          steps: [
            {
              id: 'step-1',
              description: 'Read and process CSV',
              expectedTools: ['read_file', 'write_file'],
              dependsOn: [],
              successCriteria: 'Summary written',
            },
          ],
          maxSteps: 1,
        }),
        finishReason: 'stop',
      },
      // Step: read
      {
        content: '',
        finishReason: 'stop',
        toolCalls: [{ id: 'tc1', name: 'read_file', arguments: { path: 'data.csv' } }],
      },
      // After read, model calls write
      {
        content: '',
        finishReason: 'stop',
        toolCalls: [
          {
            id: 'tc2',
            name: 'write_file',
            arguments: { path: 'summary.txt', content: '2 records found: Alice (30), Bob (25)' },
          },
        ],
      },
      // Step summary
      {
        content: 'CSV processed and summary written.',
        finishReason: 'stop',
      },
      // Final
      {
        content: 'Done.',
        finishReason: 'stop',
      },
    ]);

    const engine = new WorkflowEngine({
      message: 'Read data.csv and write a summary to summary.txt',
      messages,
      model: 'test-model',
      registry,
      provider,
      config: { enableReflection: false },
    });

    await collectEvents(engine);
    const state = engine.getState();

    expect(state.status).toBe('done');
    expect(memFs.get('summary.txt')).toBe('2 records found: Alice (30), Bob (25)');
  });
});
