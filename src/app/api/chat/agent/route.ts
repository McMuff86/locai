// ============================================================================
// Agent Chat API Route
// ============================================================================
// Streams NDJSON events for the agent tool-calling loop.
// POST /api/chat/agent
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { executeAgentLoop } from '@/lib/agents/executor';
import { ToolRegistry } from '@/lib/agents/registry';
import { registerBuiltinTools } from '@/lib/agents/tools';
import { getRelevantMemories, formatMemories } from '@/lib/memory/store';
import { getPresetById } from '@/lib/agents/presets';
import type { OllamaChatMessage } from '@/lib/ollama';
import type { AgentOptions } from '@/lib/agents/types';

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

interface AgentRequestBody {
  /** User message content */
  message: string;
  /** Model to use */
  model?: string;
  /** Enabled tool names */
  enabledTools?: string[];
  /** Max agent iterations */
  maxIterations?: number;
  /** Conversation history */
  conversationHistory?: Array<{ role: string; content: string }>;
  /** Ollama host override */
  host?: string;
  /** Preset ID for agent configuration */
  presetId?: string;
  /** Whether to enable the planning step */
  enablePlanning?: boolean;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequestBody;

    const {
      message,
      model = 'llama3',
      enabledTools,
      maxIterations = 8,
      conversationHistory = [],
      host,
      presetId,
      enablePlanning = false,
    } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Set up tool registry
    const registry = new ToolRegistry();
    registerBuiltinTools(registry);

    // Build conversation messages
    const messages: OllamaChatMessage[] = [
      ...conversationHistory.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Inject preset system prompt if a preset is selected
    if (presetId) {
      const preset = getPresetById(presetId);
      if (preset) {
        messages.unshift({
          role: 'system',
          content: preset.systemPrompt,
        });
      }
    }

    // Memory Auto-Inject: load relevant memories and prepend as system context
    try {
      const relevantMemories = await getRelevantMemories(message, 10);
      if (relevantMemories.length > 0) {
        messages.unshift({
          role: 'system',
          content: `Bekannte Informationen über den Benutzer:\n${formatMemories(relevantMemories)}`,
        });
      }
    } catch {
      // Memory injection is best-effort
    }

    const options: AgentOptions = {
      maxIterations,
      enabledTools,
      enablePlanning,
    };

    // Create a ReadableStream for NDJSON streaming
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function emit(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        }

        try {
          const generator = executeAgentLoop({
            messages,
            model,
            registry,
            options,
            host,
          });

          for await (const turn of generator) {
            // Handle planning turn (index -1)
            if (turn.index === -1 && turn.plan) {
              emit({ type: 'plan', content: turn.plan });
              continue;
            }

            // Emit turn start
            emit({ type: 'turn_start', turn: turn.index });

            // Emit tool calls
            for (const call of turn.toolCalls) {
              emit({ type: 'tool_call', turn: turn.index, call });
            }

            // Emit tool results
            for (const result of turn.toolResults) {
              emit({ type: 'tool_result', turn: turn.index, result });
            }

            // Emit turn end
            emit({ type: 'turn_end', turn: turn.index });

            // If this turn has the final assistant message, stream it
            if (turn.assistantMessage) {
              emit({
                type: 'message',
                content: turn.assistantMessage,
                done: true,
              });
            }
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown agent error';
          emit({ type: 'error', message: errMsg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
