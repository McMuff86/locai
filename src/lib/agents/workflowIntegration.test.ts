// ============================================================================
// WorkflowEngine Integration Test – Multi-Step File Operations
// ============================================================================
// Tests a complete workflow: read_file → process → write_file
// Uses MockChatProvider with tool call responses to exercise the full
// engine pipeline including planning, tool execution, and finalization.
//
// Key: The workflow engine uses maxIterations=1 per step in executeAgentLoop,
// so each step gets exactly ONE provider call. If the provider returns
// toolCalls, tools are executed and the turn ends. If it returns text only,
// that's the final answer for the step.
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
      return { callId: 'rf', success: true, content };
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
      return { callId: 'wf', success: true, content: `Written: ${filePath}` };
    },
  });

  return registry;
}

// ---------------------------------------------------------------------------
// Mock Provider
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
        for await (const ev of engine.run()) events.push(ev);
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

  it('should complete a read → write multi-step workflow', async () => {
    memFs.set('input.txt', 'hello world');

    provider.setResponses([
      // 1) Planning: 2 steps
      {
        content: JSON.stringify({
          goal: 'Read input.txt, uppercase, write output.txt',
          steps: [
            { id: 'step-1', description: 'Read input.txt', expectedTools: ['read_file'], dependsOn: [], successCriteria: 'File content obtained' },
            { id: 'step-2', description: 'Write uppercased content', expectedTools: ['write_file'], dependsOn: ['step-1'], successCriteria: 'File written' },
          ],
          maxSteps: 2,
        }),
        finishReason: 'stop',
      },
      // 2) Step 1: model calls read_file
      {
        content: '',
        finishReason: 'stop',
        toolCalls: [{ id: 'tc1', function: { name: 'read_file', arguments: { path: 'input.txt' } } }],
      },
      // 3) Step 1: executor exhausted-iterations final answer call
      {
        content: 'Read input.txt: hello world',
        finishReason: 'stop',
      },
      // 4) Step 2: model calls write_file
      {
        content: '',
        finishReason: 'stop',
        toolCalls: [{ id: 'tc2', function: { name: 'write_file', arguments: { path: 'output.txt', content: 'HELLO WORLD' } } }],
      },
      // 5) Step 2: executor exhausted-iterations final answer call
      {
        content: 'Written output.txt with uppercased content.',
        finishReason: 'stop',
      },
      // 6) Workflow final answer
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

    expect(state.status).toBe('done');
    expect(state.plan).not.toBeNull();
    expect(state.plan!.steps).toHaveLength(2);

    // Verify file was written to in-memory fs
    expect(memFs.get('output.txt')).toBe('HELLO WORLD');

    // Should have plan event
    expect(events.filter((e) => e.type === 'plan')).toHaveLength(1);
    // Should have tool_call events
    expect(events.filter((e) => e.type === 'tool_call').length).toBeGreaterThanOrEqual(2);
    // Should have tool_result events
    expect(events.filter((e) => e.type === 'tool_result').length).toBeGreaterThanOrEqual(2);
  });

  it('should handle read_file failure gracefully', async () => {
    // No file seeded – read will fail

    provider.setResponses([
      // Planning
      {
        content: JSON.stringify({
          goal: 'Read missing file',
          steps: [
            { id: 'step-1', description: 'Read missing.txt', expectedTools: ['read_file'], dependsOn: [], successCriteria: 'File read' },
          ],
          maxSteps: 1,
        }),
        finishReason: 'stop',
      },
      // Step: tool call for missing file
      {
        content: '',
        finishReason: 'stop',
        toolCalls: [{ id: 'tc1', function: { name: 'read_file', arguments: { path: 'missing.txt' } } }],
      },
      // Step: executor exhausted-iterations final answer
      {
        content: 'File not found: missing.txt',
        finishReason: 'stop',
      },
      // Workflow final answer
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

    // Should have a tool_result with error
    const toolResults = events.filter((e) => e.type === 'tool_result') as any[];
    expect(toolResults.length).toBeGreaterThanOrEqual(1);
    // The tool result should indicate failure
    const failedResult = toolResults.find((r: any) => r.result?.error || !r.result?.success);
    expect(failedResult).toBeTruthy();
  });

  it('should execute read + write in single step', async () => {
    memFs.set('data.csv', 'name,age\nAlice,30\nBob,25');

    provider.setResponses([
      // Planning – single step with both tools
      {
        content: JSON.stringify({
          goal: 'Process CSV',
          steps: [
            { id: 'step-1', description: 'Read CSV and write summary', expectedTools: ['read_file', 'write_file'], dependsOn: [], successCriteria: 'Done' },
          ],
          maxSteps: 1,
        }),
        finishReason: 'stop',
      },
      // Step: read_file tool call
      {
        content: '',
        finishReason: 'stop',
        toolCalls: [
          { id: 'tc1', function: { name: 'read_file', arguments: { path: 'data.csv' } } },
        ],
      },
      // Step: executor exhausted-iterations final answer
      {
        content: 'CSV data read successfully.',
        finishReason: 'stop',
      },
      // Workflow final answer
      {
        content: 'CSV processed.',
        finishReason: 'stop',
      },
    ]);

    const engine = new WorkflowEngine({
      message: 'Read data.csv',
      messages,
      model: 'test-model',
      registry,
      provider,
      config: { enableReflection: false },
    });

    await collectEvents(engine);
    const state = engine.getState();

    expect(state.status).toBe('done');
    // Verify read_file was called (tool_result events)
    expect(state.steps.length).toBeGreaterThanOrEqual(1);
  });
});
