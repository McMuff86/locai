// ============================================================================
// Agent Chat API Route
// ============================================================================
// Streams NDJSON events for the agent tool-calling loop.
// POST /api/chat/agent
// ============================================================================

import { NextRequest } from 'next/server';
import { executeAgentLoop } from '@/lib/agents/executor';
import { ToolRegistry } from '@/lib/agents/registry';
import { registerBuiltinTools } from '@/lib/agents/tools';
import { getRelevantMemories, formatMemories } from '@/lib/memory/store';
import { getPresetById } from '@/lib/agents/presets';
import { resolveWorkspacePath } from '@/lib/settings/store';
import type { ChatMessage } from '@/lib/providers/types';
import type { ProviderType } from '@/lib/providers/types';
import type { AgentOptions } from '@/lib/agents/types';
import { createServerProvider, getDefaultServerProvider } from '@/lib/providers/server';
import { apiError } from '../../_utils/responses';

// ---------------------------------------------------------------------------
// Default agent system prompt (always injected in agent mode)
// ---------------------------------------------------------------------------

function buildDefaultAgentPrompt(enabledToolNames: string[]): string {
  const toolList = enabledToolNames.join(', ');
  const workspace = resolveWorkspacePath() || '~/.locai/workspace/';

  return (
    'Du bist ein hilfreicher KI-Agent mit Zugriff auf Werkzeuge (Tools). ' +
    'Du MUSST die bereitgestellten Werkzeuge verwenden, um Aufgaben zu erledigen. ' +
    'Schreibe KEINEN Code fuer den Benutzer zum Ausfuehren — fuehre die Aktionen selbst mit deinen Werkzeugen aus.\n\n' +
    'Verfuegbare Werkzeuge: ' + toolList + '\n\n' +
    'Wichtige Regeln:\n' +
    '- Wenn du eine Datei erstellen sollst, nutze write_file direkt. Schreibe KEINEN Python/JS-Code der Dateien erstellt.\n' +
    '- Wenn du eine Datei lesen sollst, nutze read_file direkt.\n' +
    '- Wenn du etwas suchen sollst, nutze search_documents oder web_search.\n' +
    '- Wenn du eine Notiz erstellen sollst, nutze create_note.\n' +
    '- Relative Dateipfade (z.B. "test.txt") werden automatisch im Workspace gespeichert: ' + workspace + '\n' +
    '- Fuehre die Werkzeuge Schritt fuer Schritt aus und erklaere kurz was du tust.\n' +
    '- Antworte auf Deutsch, es sei denn der Benutzer schreibt in einer anderen Sprache.\n\n' +
    'Beispiele fuer korrekte Werkzeug-Aufrufe:\n\n' +
    'Datei erstellen → write_file(path: "bericht.txt", content: "Hier steht der Inhalt")\n' +
    'Datei lesen → read_file(path: "bericht.txt")\n' +
    'Notiz erstellen → create_note(title: "Meine Notiz", content: "Notizinhalt hier")\n' +
    'Web-Suche → web_search(query: "Suchbegriff")\n' +
    'Dokumente durchsuchen → search_documents(query: "Suchbegriff")\n\n' +
    'WICHTIG:\n' +
    '- write_file braucht "path" (NICHT "title" oder "filename") und "content" (NICHT leer)\n' +
    '- read_file braucht "path" (NICHT "file" oder "filename")\n' +
    '- Fuehre die Werkzeuge direkt aus. Schreibe KEINEN JSON-Code als Text.'
  );
}

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
  /** Ollama chat options (e.g. temperature) */
  chatOptions?: Record<string, unknown>;
  /** Provider type to use (default: ollama) */
  provider?: ProviderType;
  /** API key override (env vars take precedence) */
  apiKey?: string;
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
      chatOptions,
      provider: providerType,
      apiKey,
    } = body;

    if (!message?.trim()) {
      return apiError('Message is required', 400);
    }

    // Resolve the ChatProvider
    let chatProvider;
    if (providerType && providerType !== 'ollama') {
      chatProvider = createServerProvider(providerType, {
        ...(apiKey ? { apiKey } : {}),
      });
      if (!chatProvider) {
        return apiError(
          `Provider "${providerType}" is not configured. Set the appropriate API key environment variable.`,
          400,
        );
      }
    } else {
      // Ollama (default) — pass host override if provided
      chatProvider = createServerProvider('ollama', {
        baseUrl: host || undefined,
      });
      if (!chatProvider) {
        chatProvider = getDefaultServerProvider();
      }
    }

    // Set up tool registry
    const registry = new ToolRegistry();
    registerBuiltinTools(registry);

    // Determine which tools will be available
    const resolvedTools = enabledTools ?? registry.listNames();

    // Build conversation messages (using provider-agnostic ChatMessage)
    const messages: ChatMessage[] = [
      ...conversationHistory.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Always inject default agent system prompt
    const defaultPrompt = buildDefaultAgentPrompt(resolvedTools);
    messages.unshift({
      role: 'system',
      content: defaultPrompt,
    });

    // Layer preset system prompt on top if a preset is selected
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
    let injectedMemories: Array<{ key: string; value: string; category: string }> = [];
    try {
      const relevantMemories = await getRelevantMemories(message, 10);
      if (relevantMemories.length > 0) {
        injectedMemories = relevantMemories.map(m => ({
          key: m.key,
          value: m.value,
          category: m.category,
        }));
        messages.unshift({
          role: 'system',
          content: `Bekannte Informationen über den Benutzer:\n${formatMemories(relevantMemories)}`,
        });
      }
    } catch {
      // Memory injection is best-effort
    }

    // RAG Auto-Inject: load relevant document context and prepend as system context
    try {
      const { buildRAGContext, injectRAGContext } = await import('@/lib/documents/rag');
      const ragContext = await buildRAGContext(message, 3, {
        threshold: 0.3,
        host: host || undefined,
        model: 'nomic-embed-text',
      });
      
      if (ragContext.chunks.length > 0) {
        // Convert to Message format for injection
        const messageFormat = messages.map(m => ({
          id: `temp-${Date.now()}-${Math.random()}`,
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(),
        }));
        
        const enhanced = injectRAGContext(messageFormat, ragContext, ragContext.searchResults);
        
        // Convert back to ChatMessage format
        const systemMessages = enhanced.filter(m => m.role === 'system').slice(-1); // Take only the RAG context
        if (systemMessages.length > 0) {
          messages.unshift({
            role: 'system',
            content: String(systemMessages[0].content),
          });
        }
      }
    } catch {
      // RAG injection is best-effort
    }

    // Default to temperature 0.3 for more reliable tool calling
    const agentChatOptions = chatOptions ?? { temperature: 0.3 };

    const options: AgentOptions = {
      maxIterations,
      enabledTools,
      enablePlanning,
      chatOptions: agentChatOptions,
    };

    // Create a ReadableStream for NDJSON streaming
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function emit(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        }

        // Emit memory metadata if memories were injected
        if (injectedMemories.length > 0) {
          emit({ type: 'memory_context', count: injectedMemories.length, memories: injectedMemories });
        }

        try {
          const generator = executeAgentLoop({
            messages,
            model,
            registry,
            options,
            provider: chatProvider,
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
    return apiError(errMsg, 500);
  }
}
