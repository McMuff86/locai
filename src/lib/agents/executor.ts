// ============================================================================
// Agent Executor
// ============================================================================
// Implements the agentic tool-calling loop:
//   User message → LLM (with tools) → tool_calls? → execute → feed back → repeat
// Yields each turn so the caller (API route) can stream progress to the UI.
// ============================================================================

import {
  sendAgentChatMessage,
  OllamaChatMessage,
  OllamaTool,
  OllamaToolCall,
} from '../ollama';
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
  messages: OllamaChatMessage[];
  /** Model name to use */
  model: string;
  /** Tool registry to draw tools from */
  registry: ToolRegistry;
  /** Options for execution limits */
  options?: AgentOptions;
  /** Ollama host override */
  host?: string;
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

function ollamaToolCallsToToolCalls(
  raw: OllamaToolCall[]
): ToolCall[] {
  return raw.map((tc) => ({
    id: makeCallId(),
    name: tc.function.name,
    arguments: tc.function.arguments ?? {},
  }));
}

// ---------------------------------------------------------------------------
// Planning Step
// ---------------------------------------------------------------------------

const PLANNING_PROMPT =
  'Bevor du mit der Ausfuehrung beginnst, erstelle einen kurzen Plan mit 2-5 Schritten. ' +
  'Beschreibe knapp, welche Werkzeuge du nutzen wirst und in welcher Reihenfolge. ' +
  'Antworte NUR mit dem Plan als nummerierte Liste, ohne weitere Erklaerung.';

async function executePlanningStep(
  messages: OllamaChatMessage[],
  model: string,
  host?: string,
  signal?: AbortSignal,
  chatOptions?: Record<string, unknown>,
): Promise<string | null> {
  const planningMessages: OllamaChatMessage[] = [
    ...messages,
    { role: 'user', content: PLANNING_PROMPT },
  ];

  try {
    const response = await sendAgentChatMessage(
      model,
      planningMessages,
      [], // No tools for planning
      { host, signal, chatOptions },
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
    host,
  } = params;

  const maxIterations = options.maxIterations ?? AGENT_DEFAULTS.maxIterations;
  const signal = options.signal;

  // Optional planning step
  if (options.enablePlanning) {
    const plan = await executePlanningStep(messages, model, host, signal, options.chatOptions);
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

  // Build the OllamaTool[] from the registry
  const ollamaTools: OllamaTool[] = registry.list(options.enabledTools);

  // Working copy of the conversation
  const conversationMessages: OllamaChatMessage[] = [...messages];

  for (let i = 0; i < maxIterations; i++) {
    // Check abort
    if (signal?.aborted) {
      throw new DOMException('Agent loop aborted', 'AbortError');
    }

    const startedAt = new Date().toISOString();

    // Send to Ollama (non-streaming, tool-calling)
    const response = await sendAgentChatMessage(
      model,
      conversationMessages,
      ollamaTools,
      { host, signal, chatOptions: options.chatOptions },
    );

    // No tool_calls → check for tool calls embedded in text (fallback)
    if (!response.tool_calls || response.tool_calls.length === 0) {
      const toolNames = registry.listNames(options.enabledTools);
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
        const result = await registry.execute(call, signal);
        toolResults.push(result);

        conversationMessages.push({
          role: 'tool',
          content: result.success
            ? result.content
            : `Error: ${result.error ?? 'Unknown error'}`,
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

    // Convert Ollama tool_calls to our ToolCall type
    const toolCalls = ollamaToolCallsToToolCalls(response.tool_calls);

    // Append the assistant's tool-calling message to the conversation
    conversationMessages.push({
      role: 'assistant',
      content: response.content || '',
      tool_calls: response.tool_calls,
    });

    // Execute each tool call
    const toolResults: ToolResult[] = [];
    for (const call of toolCalls) {
      if (signal?.aborted) {
        throw new DOMException('Agent loop aborted', 'AbortError');
      }
      const result = await registry.execute(call, signal);
      toolResults.push(result);

      // Feed the tool result back to the conversation
      conversationMessages.push({
        role: 'tool',
        content: result.success
          ? result.content
          : `Error: ${result.error ?? 'Unknown error'}`,
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
  const finalResponse = await sendAgentChatMessage(
    model,
    conversationMessages,
    [], // No tools → force text answer
    { host, signal, chatOptions: options.chatOptions },
  );

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
