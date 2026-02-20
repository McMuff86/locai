// ============================================================================
// Ollama Provider — wraps existing ollama.ts into ChatProvider interface
// ============================================================================

import {
  ChatProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ModelInfo,
  ToolDefinition,
  ToolCallRequest,
} from './types';
import {
  getOllamaModels,
  sendAgentChatMessage,
  OllamaChatMessage,
  OllamaTool,
  OllamaToolProperty,
} from '../ollama';

// ---------------------------------------------------------------------------
// Helpers: Convert between provider-agnostic and Ollama types
// ---------------------------------------------------------------------------

function toOllamaMessages(messages: ChatMessage[]): OllamaChatMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    ...(msg.tool_calls && {
      tool_calls: msg.tool_calls.map((tc) => ({
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    }),
    ...(msg.images && { images: msg.images }),
  }));
}

function toOllamaTools(tools?: ToolDefinition[]): OllamaTool[] {
  if (!tools || tools.length === 0) return [];
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: {
        type: t.function.parameters.type,
        properties: t.function.parameters.properties as Record<string, OllamaToolProperty>,
        required: t.function.parameters.required ?? [],
      },
    },
  }));
}

function fromOllamaToolCalls(
  toolCalls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>
): ToolCallRequest[] | undefined {
  if (!toolCalls || toolCalls.length === 0) return undefined;
  return toolCalls.map((tc, i) => ({
    id: `ollama_tc_${Date.now()}_${i}`,
    function: {
      name: tc.function.name,
      arguments: tc.function.arguments ?? {},
    },
  }));
}

// ---------------------------------------------------------------------------
// OllamaProvider
// ---------------------------------------------------------------------------

export class OllamaProvider implements ChatProvider {
  readonly type = 'ollama' as const;
  readonly name = 'Ollama';
  private host?: string;

  constructor(host?: string) {
    this.host = host;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const ollamaMessages = toOllamaMessages(messages);
    const ollamaTools = toOllamaTools(options.tools);

    // sendAgentChatMessage signature: (model, messages, tools, options)
    const response = await sendAgentChatMessage(
      options.model,
      ollamaMessages,
      ollamaTools,
      { host: this.host, signal: options.signal }
    );

    return {
      content: response.content,
      toolCalls: fromOllamaToolCalls(response.tool_calls),
      usage: response.tokenStats
        ? {
            promptTokens: response.tokenStats.promptTokens,
            completionTokens: response.tokenStats.completionTokens,
            totalTokens: response.tokenStats.totalTokens,
          }
        : undefined,
      finishReason: response.tool_calls?.length ? 'tool_calls' : 'stop',
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    // For now, Ollama streaming goes through the non-streaming path
    // and yields the complete response. Full streaming can be added later.
    const response = await this.chat(messages, options);
    yield {
      content: response.content,
      toolCalls: response.toolCalls,
      done: true,
      usage: response.usage,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const models = await getOllamaModels(this.host);
      return models.map((m) => ({
        id: m.name,
        name: m.name,
        provider: 'ollama' as const,
        size: m.size,
      }));
    } catch {
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const models = await getOllamaModels(this.host);
      return models.length > 0;
    } catch {
      return false;
    }
  }
}
