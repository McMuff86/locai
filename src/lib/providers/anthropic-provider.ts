// ============================================================================
// Anthropic Provider — Claude API via @anthropic-ai/sdk
// ============================================================================

import {
  ChatProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ModelInfo,
  ToolCallRequest,
} from './types';

// ---------------------------------------------------------------------------
// Dynamic import to avoid bundling SDK when not used
// ---------------------------------------------------------------------------

async function getAnthropicClient(apiKey: string, baseUrl?: string) {
  // Dynamic import so the SDK is only loaded when actually needed
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({
    apiKey,
    ...(baseUrl && { baseURL: baseUrl }),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}

function toAnthropicMessages(messages: ChatMessage[]): {
  system?: string;
  messages: AnthropicMessage[];
} {
  let system: string | undefined;
  const converted: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content;
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      converted.push({
        role: msg.role,
        content: msg.content,
      });
    } else if (msg.role === 'tool') {
      // Tool results go as user messages with tool_result content
      converted.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id ?? 'unknown',
            content: msg.content,
          },
        ],
      });
    }
  }

  return { system, messages: converted };
}

function toAnthropicTools(tools?: ChatOptions['tools']) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: {
      type: 'object' as const,
      properties: t.function.parameters.properties,
      required: t.function.parameters.required ?? [],
    },
  }));
}

// ---------------------------------------------------------------------------
// Known Claude Models
// ---------------------------------------------------------------------------

const CLAUDE_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', contextLength: 200000 },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', contextLength: 200000 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextLength: 200000 },
];

// ---------------------------------------------------------------------------
// AnthropicProvider
// ---------------------------------------------------------------------------

export class AnthropicProvider implements ChatProvider {
  readonly type = 'anthropic' as const;
  readonly name = 'Anthropic (Claude)';
  private apiKey: string;
  private baseUrl?: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const client = await getAnthropicClient(this.apiKey, this.baseUrl);
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
    const tools = toAnthropicTools(options.tools);

    const response = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      ...(system && { system }),
      messages: anthropicMessages as Parameters<typeof client.messages.create>[0]['messages'],
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(tools && { tools: tools as Parameters<typeof client.messages.create>[0]['tools'] }),
      ...(options.signal && { signal: options.signal }),
    });

    // Extract text and tool calls from response
    let content = '';
    const toolCalls: ToolCallRequest[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          function: {
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          },
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    const client = await getAnthropicClient(this.apiKey, this.baseUrl);
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
    const tools = toAnthropicTools(options.tools);

    const stream = client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      ...(system && { system }),
      messages: anthropicMessages as Parameters<typeof client.messages.create>[0]['messages'],
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(tools && { tools: tools as Parameters<typeof client.messages.create>[0]['tools'] }),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as { type: string; text?: string };
        if (delta.type === 'text_delta' && delta.text) {
          yield { content: delta.text, done: false };
        }
      } else if (event.type === 'message_stop') {
        const finalMessage = await stream.finalMessage();
        const toolCalls: ToolCallRequest[] = [];
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              function: {
                name: block.name,
                arguments: block.input as Record<string, unknown>,
              },
            });
          }
        }
        yield {
          done: true,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          usage: {
            promptTokens: finalMessage.usage.input_tokens,
            completionTokens: finalMessage.usage.output_tokens,
            totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
          },
        };
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const client = await getAnthropicClient(this.apiKey, this.baseUrl);
      const response = await client.models.list({ limit: 100 });
      const models: ModelInfo[] = [];
      for await (const model of response) {
        models.push({
          id: model.id,
          name: model.display_name ?? model.id,
          provider: 'anthropic',
        });
      }
      if (models.length > 0) return models;
    } catch {
      // API may not support listing — fall back to known models
    }
    return CLAUDE_MODELS;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      // Quick check with a minimal request
      const client = await getAnthropicClient(this.apiKey, this.baseUrl);
      await client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
