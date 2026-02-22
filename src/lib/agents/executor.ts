// ============================================================================
// Agent Executor
// ============================================================================
// Implements the agentic tool-calling loop:
//   User message → LLM (with tools) → tool_calls? → execute → feed back → repeat
// Yields each turn so the caller (API route) can stream progress to the UI.
// ============================================================================
// Provider-agnostic: uses ChatProvider interface, not Ollama directly.
// ============================================================================

import type {
  ChatProvider,
  ChatMessage,
  ChatResponse,
  ToolDefinition as ProviderToolDefinition,
  ToolCallRequest,
} from '../providers/types';
import {
  AgentTurn,
  AgentOptions,
  ToolCall,
  ToolResult,
  AGENT_DEFAULTS,
} from './types';
import { ToolRegistry } from './registry';
import { parseToolCallsFromText } from './textToolParser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentLoopParams {
  /** Conversation messages (system + user + history) */
  messages: ChatMessage[];
  /** Model name to use */
  model: string;
  /** Tool registry to draw tools from */
  registry: ToolRegistry;
  /** Options for execution limits */
  options?: AgentOptions;
  /** Chat provider to use (if omitted, must be set externally) */
  provider: ChatProvider;
}

/** The final yield of the generator includes the assistant's text answer */
export interface AgentFinalTurn extends AgentTurn {
  /** The assistant's final text response (set on the last turn) */
  assistantMessage?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let callCounter = 0;

function makeCallId(): string {
  callCounter += 1;
  return `tc_${Date.now()}_${callCounter}`;
}

/**
 * Convert ToolCallRequest[] (provider-agnostic) to internal ToolCall[].
 */
function providerToolCallsToToolCalls(raw: ToolCallRequest[]): ToolCall[] {
  return raw.map((tc) => ({
    id: tc.id || makeCallId(),
    name: tc.function.name,
    arguments: tc.function.arguments ?? {},
  }));
}

/**
 * Convert internal ToolCall[] back to ToolCallRequest[] for conversation history.
 */
function toolCallsToProviderFormat(calls: ToolCall[]): ToolCallRequest[] {
  return calls.map((tc) => ({
    id: tc.id,
    function: {
      name: tc.name,
      arguments: tc.arguments,
    },
  }));
}

/**
 * Convert registry tools to provider ToolDefinition[] format.
 */
function registryToProviderTools(
  registry: ToolRegistry,
  enabledTools?: string[],
): ProviderToolDefinition[] {
  // registry.list() returns OllamaTool[] which already has the right shape
  const ollamaTools = registry.list(enabledTools);
  return ollamaTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: {
        type: t.function.parameters.type,
        properties: t.function.parameters.properties as Record<string, unknown>,
        required: t.function.parameters.required,
      },
    },
  }));
}

/**
 * Send a chat message via the provider and return a normalized response.
 */
async function chatViaProvider(
  provider: ChatProvider,
  model: string,
  messages: ChatMessage[],
  tools: ProviderToolDefinition[],
  signal?: AbortSignal,
  chatOptions?: Record<string, unknown>,
): Promise<{ content: string; tool_calls?: ToolCallRequest[] }> {
  const response: ChatResponse = await provider.chat(messages, {
    model,
    tools: tools.length > 0 ? tools : undefined,
    signal,
    temperature: chatOptions?.temperature as number | undefined,
    maxTokens: chatOptions?.num_predict as number | undefined,
  });

  return {
    content: response.content,
    tool_calls: response.toolCalls,
  };
}

// ---------------------------------------------------------------------------
// Planning Step
// ---------------------------------------------------------------------------

const PLANNING_PROMPT =
  'Bevor du mit der Ausfuehrung beginnst, erstelle einen kurzen Plan mit 2-5 Schritten. ' +
  'Beschreibe knapp, welche Werkzeuge du nutzen wirst und in welcher Reihenfolge. ' +
  'Antworte NUR mit dem Plan als nummerierte Liste, ohne weitere Erklaerung.';

async function executePlanningStep(
  provider: ChatProvider,
  messages: ChatMessage[],
  model: string,
  signal?: AbortSignal,
  chatOptions?: Record<string, unknown>,
): Promise<string | null> {
  const planningMessages: ChatMessage[] = [
    ...messages,
    { role: 'user', content: PLANNING_PROMPT },
  ];

  try {
    const response = await chatViaProvider(
      provider,
      model,
      planningMessages,
      [], // No tools for planning
      signal,
      chatOptions,
    );
    return response.content || null;
  } catch {
    // Planning is best-effort; if it fails, just proceed without a plan
    return null;
  }
}

// ---------------------------------------------------------------------------
// Agent Loop (AsyncGenerator)
// ---------------------------------------------------------------------------

/**
 * Run the agent tool-calling loop.
 *
 * Each iteration is yielded as an {@link AgentFinalTurn} so the caller
 * can stream incremental progress to the client.
 *
 * The final yield has `assistantMessage` set to the model's text answer
 * (when it stops requesting tools).
 */
export async function* executeAgentLoop(
  params: AgentLoopParams,
): AsyncGenerator<AgentFinalTurn> {
  const {
    messages,
    model,
    registry,
    options = {},
    provider,
  } = params;

  const maxIterations = options.maxIterations ?? AGENT_DEFAULTS.maxIterations;
  const signal = options.signal;
  const onLog = options.onLog;

  // Optional planning step
  if (options.enablePlanning) {
    const plan = await executePlanningStep(provider, messages, model, signal, options.chatOptions);
    if (plan) {
      // Yield a special planning turn with index -1
      const planTurn: AgentFinalTurn = {
        index: -1,
        toolCalls: [],
        toolResults: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        plan,
      };
      yield planTurn;

      // Add the plan to the conversation context so the model can follow it
      messages.push(
        { role: 'assistant', content: plan },
        { role: 'user', content: 'Gut, fuehre den Plan jetzt Schritt fuer Schritt aus.' },
      );
    }
  }

  // Build provider-compatible tool definitions from the registry
  const providerTools = registryToProviderTools(registry, options.enabledTools);

  // Working copy of the conversation
  const conversationMessages: ChatMessage[] = [...messages];

  for (let i = 0; i < maxIterations; i++) {
    // Check abort
    if (signal?.aborted) {
      throw new DOMException('Agent loop aborted', 'AbortError');
    }

    const startedAt = new Date().toISOString();

    // Send to provider (non-streaming, tool-calling)
    const llmStart = Date.now();
    console.log(`[Executor] 🔄 LLM call #${i + 1}/${maxIterations} started (model: ${model}, tools: ${providerTools.length})`);
    onLog?.(`LLM call #${i + 1}/${maxIterations} started (model: ${model}, tools: ${providerTools.length})`, 'info');
    const response = await chatViaProvider(
      provider,
      model,
      conversationMessages,
      providerTools,
      signal,
      options.chatOptions,
    );
    const llmDuration = ((Date.now() - llmStart) / 1000).toFixed(1);
    console.log(`[Executor] ✅ LLM call #${i + 1} completed (${llmDuration}s)`);
    onLog?.(`LLM call #${i + 1} completed (${llmDuration}s)`, 'info');

    // No tool_calls → check for tool calls embedded in text (fallback)
    if (!response.tool_calls || response.tool_calls.length === 0) {
      // Use ALL registered tool names for detection (not just enabled ones),
      // so the parser can catch tool calls the model knows from the system prompt.
      const toolNames = registry.listNames();
      const parsedCalls = parseToolCallsFromText(response.content, toolNames);

      if (parsedCalls.length === 0) {
        // Genuinely the final text answer
        const finalTurn: AgentFinalTurn = {
          index: i,
          toolCalls: [],
          toolResults: [],
          startedAt,
          completedAt: new Date().toISOString(),
          assistantMessage: response.content,
        };
        yield finalTurn;
        return; // Done
      }

      // Convert parsed calls to ToolCall[] and continue the loop below
      const toolCalls: ToolCall[] = parsedCalls.map((pc) => ({
        id: makeCallId(),
        name: pc.name,
        arguments: pc.arguments,
      }));

      // Append the assistant's message to the conversation
      conversationMessages.push({
        role: 'assistant',
        content: response.content || '',
      });

      // Execute each tool call
      const toolResults: ToolResult[] = [];
      for (const call of toolCalls) {
        if (signal?.aborted) {
          throw new DOMException('Agent loop aborted', 'AbortError');
        }
        const toolStart = Date.now();
        console.log(`[Executor] 🔧 Tool "${call.name}" started (args: ${JSON.stringify(call.arguments).slice(0, 120)})`);
        onLog?.(`Tool "${call.name}" started`, 'info');
        const result = await registry.execute(call, signal);
        const toolDuration = ((Date.now() - toolStart) / 1000).toFixed(1);
        console.log(`[Executor] ${result.success ? '✅' : '❌'} Tool "${call.name}" ${result.success ? 'completed' : 'failed'} (${toolDuration}s)${result.error ? ` — ${result.error}` : ''}`);
        onLog?.(`Tool "${call.name}" ${result.success ? 'completed' : 'failed'} (${toolDuration}s)${result.error ? ` — ${result.error}` : ''}`, result.success ? 'info' : 'error');
        toolResults.push(result);

        conversationMessages.push({
          role: 'tool',
          content: result.success
            ? result.content
            : `Error: ${result.error ?? 'Unknown error'}`,
          tool_call_id: result.callId,
        });
      }

      const turn: AgentFinalTurn = {
        index: i,
        toolCalls,
        toolResults,
        startedAt,
        completedAt: new Date().toISOString(),
      };
      yield turn;
      continue; // Next iteration
    }

    // Convert provider tool_calls to our ToolCall type
    const toolCalls = providerToolCallsToToolCalls(response.tool_calls);

    // Append the assistant's tool-calling message to the conversation
    conversationMessages.push({
      role: 'assistant',
      content: response.content || '',
      tool_calls: toolCallsToProviderFormat(toolCalls),
    });

    // Execute each tool call
    const toolResults: ToolResult[] = [];
    for (const call of toolCalls) {
      if (signal?.aborted) {
        throw new DOMException('Agent loop aborted', 'AbortError');
      }
      const toolStart = Date.now();
      console.log(`[Executor] 🔧 Tool "${call.name}" started (args: ${JSON.stringify(call.arguments).slice(0, 120)})`);
      onLog?.(`Tool "${call.name}" started`, 'info');
      const result = await registry.execute(call, signal);
      const toolDuration = ((Date.now() - toolStart) / 1000).toFixed(1);
      console.log(`[Executor] ${result.success ? '✅' : '❌'} Tool "${call.name}" ${result.success ? 'completed' : 'failed'} (${toolDuration}s)${result.error ? ` — ${result.error}` : ''}`);
      onLog?.(`Tool "${call.name}" ${result.success ? 'completed' : 'failed'} (${toolDuration}s)${result.error ? ` — ${result.error}` : ''}`, result.success ? 'info' : 'error');
      toolResults.push(result);

      // Feed the tool result back to the conversation
      conversationMessages.push({
        role: 'tool',
        content: result.success
          ? result.content
          : `Error: ${result.error ?? 'Unknown error'}`,
        tool_call_id: result.callId,
      });
    }

    // Yield this iteration
    const turn: AgentFinalTurn = {
      index: i,
      toolCalls,
      toolResults,
      startedAt,
      completedAt: new Date().toISOString(),
    };
    yield turn;
  }

  // If we exhausted max iterations, ask the model for a final answer without tools
  console.log(`[Executor] 🔄 Final answer LLM call started (max iterations exhausted)`);
  onLog?.('Final answer LLM call started (max iterations exhausted)', 'info');
  const finalLlmStart = Date.now();
  const finalResponse = await chatViaProvider(
    provider,
    model,
    conversationMessages,
    [], // No tools → force text answer
    signal,
    options.chatOptions,
  );

  const finalDuration = ((Date.now() - finalLlmStart) / 1000).toFixed(1);
  console.log(`[Executor] ✅ Final answer LLM call completed (${finalDuration}s)`);
  onLog?.(`Final answer LLM call completed (${finalDuration}s)`, 'info');

  const exhaustedTurn: AgentFinalTurn = {
    index: maxIterations,
    toolCalls: [],
    toolResults: [],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    assistantMessage: finalResponse.content,
  };
  yield exhaustedTurn;
}
