// ============================================================================
// Agent Chat API Route
// ============================================================================
// POST /api/chat/agent
//
// Accepts messages + model + enabledTools, runs the agent executor loop,
// and streams results back as NDJSON (newline-delimited JSON).
//
// Event types:
//   { type: "tool_call",     data: { index, toolCalls } }
//   { type: "tool_result",   data: { index, toolResults } }
//   { type: "final_response", data: { content, index } }
//   { type: "error",         data: { message } }
// ============================================================================

import { NextRequest } from 'next/server';
import { OllamaChatMessage } from '@/lib/ollama';
import { ToolRegistry } from '@/lib/agents/registry';
import { registerBuiltinTools } from '@/lib/agents/tools';
import { executeAgentLoop } from '@/lib/agents/executor';
import { AgentOptions } from '@/lib/agents/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AgentChatBody {
  messages: OllamaChatMessage[];
  model: string;
  enabledTools?: string[];
  maxIterations?: number;
  host?: string;
}

export async function POST(req: NextRequest) {
  let body: AgentChatBody;

  try {
    body = (await req.json()) as AgentChatBody;
  } catch {
    return new Response(
      JSON.stringify({ type: 'error', data: { message: 'Invalid JSON body' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { messages, model, enabledTools, maxIterations, host } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ type: 'error', data: { message: 'messages array is required' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!model || typeof model !== 'string') {
    return new Response(
      JSON.stringify({ type: 'error', data: { message: 'model is required' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Build a fresh registry with built-in tools
  const registry = new ToolRegistry();
  registerBuiltinTools(registry);

  const abortController = new AbortController();

  const agentOptions: AgentOptions = {
    maxIterations: maxIterations ?? 8,
    enabledTools,
    signal: abortController.signal,
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const agentLoop = executeAgentLoop({
          messages,
          model,
          registry,
          options: agentOptions,
          host,
        });

        for await (const turn of agentLoop) {
          // Emit tool calls (if any)
          if (turn.toolCalls.length > 0) {
            const toolCallEvent = JSON.stringify({
              type: 'tool_call',
              data: {
                index: turn.index,
                toolCalls: turn.toolCalls.map((tc) => ({
                  id: tc.id,
                  name: tc.name,
                  arguments: tc.arguments,
                })),
              },
            });
            controller.enqueue(encoder.encode(toolCallEvent + '\n'));
          }

          // Emit tool results (if any)
          if (turn.toolResults.length > 0) {
            const toolResultEvent = JSON.stringify({
              type: 'tool_result',
              data: {
                index: turn.index,
                toolResults: turn.toolResults.map((tr) => ({
                  callId: tr.callId,
                  success: tr.success,
                  content: tr.content.slice(0, 2000), // Limit for streaming
                  error: tr.error,
                })),
              },
            });
            controller.enqueue(encoder.encode(toolResultEvent + '\n'));
          }

          // Emit final response (if present)
          if (turn.assistantMessage !== undefined) {
            const finalEvent = JSON.stringify({
              type: 'final_response',
              data: {
                content: turn.assistantMessage,
                index: turn.index,
              },
            });
            controller.enqueue(encoder.encode(finalEvent + '\n'));
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Agent execution failed';
        const errorEvent = JSON.stringify({
          type: 'error',
          data: { message },
        });
        controller.enqueue(encoder.encode(errorEvent + '\n'));
      } finally {
        controller.close();
      }
    },

    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
