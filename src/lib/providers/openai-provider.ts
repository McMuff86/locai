// ============================================================================
// OpenAI-Compatible Provider — works with OpenAI, OpenRouter, and any
// OpenAI-compatible API (LM Studio, text-generation-webui, etc.)
// ============================================================================

import {
  ChatProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ModelInfo,
  ProviderType,
  ToolCallRequest,
} from './types';

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------

async function getOpenAIClient(apiKey: string, baseUrl: string) {
  const { default: OpenAI } = await import('openai');
  return new OpenAI({
    apiKey,
    baseURL: baseUrl,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toOpenAIMessages(
  messages: ChatMessage[]
): Array<{
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}> {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    ...(msg.tool_calls && {
      tool_calls: msg.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: JSON.stringify(tc.function.arguments),
        },
      })),
    }),
    ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
  }));
}

function toOpenAITools(tools?: ChatOptions['tools']) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: {
        type: 'object' as const,
        properties: t.function.parameters.properties,
        required: t.function.parameters.required ?? [],
      },
    },
  }));
}

function extractToolCalls(
  toolCalls?: Array<{ id: string; function: { name: string; arguments: string } }>
): ToolCallRequest[] | undefined {
  if (!toolCalls || toolCalls.length === 0) return undefined;
  return toolCalls.map((tc) => ({
    id: tc.id,
    function: {
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}'),
    },
  }));
}

// ---------------------------------------------------------------------------
// Provider Presets
// ---------------------------------------------------------------------------

const PROVIDER_PRESETS: Record<
  string,
  { baseUrl: string; name: string; modelsEndpoint: boolean }
> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    name: 'OpenAI',
    modelsEndpoint: true,
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    name: 'OpenRouter',
    modelsEndpoint: true,
  },
};

// ---------------------------------------------------------------------------
// OpenAICompatibleProvider
// ---------------------------------------------------------------------------

export class OpenAICompatibleProvider implements ChatProvider {
  readonly type: ProviderType;
  readonly name: string;
  private apiKey: string;
  private baseUrl: string;
  private hasModelsEndpoint: boolean;

  constructor(
    type: ProviderType,
    apiKey: string,
    baseUrl?: string
  ) {
    const preset = PROVIDER_PRESETS[type];
    this.type = type;
    this.name = preset?.name ?? `OpenAI-Compatible (${type})`;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? preset?.baseUrl ?? 'https://api.openai.com/v1';
    this.hasModelsEndpoint = preset?.modelsEndpoint ?? true;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const client = await getOpenAIClient(this.apiKey, this.baseUrl);
    const openaiMessages = toOpenAIMessages(messages);
    const tools = toOpenAITools(options.tools);

    const response = await client.chat.completions.create({
      model: options.model,
      messages: openaiMessages as Parameters<typeof client.chat.completions.create>[0]['messages'],
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.maxTokens && { max_tokens: options.maxTokens }),
      ...(tools && { tools }),
      ...(options.signal && { signal: options.signal }),
      stream: false,
    });

    const choice = response.choices[0];

    return {
      content: choice?.message?.content ?? '',
      toolCalls: extractToolCalls(
        choice?.message?.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined
      ),
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      finishReason:
        choice?.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    const client = await getOpenAIClient(this.apiKey, this.baseUrl);
    const openaiMessages = toOpenAIMessages(messages);
    const tools = toOpenAITools(options.tools);

    const stream = await client.chat.completions.create({
      model: options.model,
      messages: openaiMessages as Parameters<typeof client.chat.completions.create>[0]['messages'],
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.maxTokens && { max_tokens: options.maxTokens }),
      ...(tools && { tools }),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield { content: delta.content, done: false };
      }
      if (chunk.choices[0]?.finish_reason) {
        yield { done: true };
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.hasModelsEndpoint) return [];
    try {
      const client = await getOpenAIClient(this.apiKey, this.baseUrl);
      const response = await client.models.list();
      const models: ModelInfo[] = [];
      for await (const model of response) {
        models.push({
          id: model.id,
          name: model.id,
          provider: this.type,
        });
      }
      return models;
    } catch {
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const models = await this.listModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }
}
