// ============================================================================
// Google Gemini Provider — REST wrapper for Gemini API with API key or OAuth
// ============================================================================

import type {
  ChatMessage,
  ChatOptions,
  ChatProvider,
  ChatResponse,
  ModelInfo,
  ProviderAuthMode,
  StreamChunk,
  ToolCallRequest,
  ToolDefinition,
} from './types';

interface GeminiProviderConfig {
  apiKey?: string;
  accessToken?: string;
  authMode?: ProviderAuthMode;
  baseUrl?: string;
  projectId?: string;
}

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
}

interface GeminiContent {
  role?: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiModel {
  name: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

interface GeminiModelsResponse {
  models?: GeminiModel[];
}

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const GEMINI_FALLBACK_MODELS: ModelInfo[] = [
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'google',
    contextLength: 1_048_576,
    capabilities: ['text', 'vision', 'tools', 'reasoning', 'long_context'],
    frontierTier: 'frontier',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'google',
    contextLength: 1_048_576,
    capabilities: ['text', 'vision', 'tools', 'reasoning', 'long_context'],
    frontierTier: 'balanced',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    contextLength: 1_048_576,
    capabilities: ['text', 'vision', 'tools', 'reasoning', 'long_context'],
    frontierTier: 'frontier',
  },
];

function normalizeModelName(model: string): string {
  const trimmed = model.trim();
  return trimmed.startsWith('models/') ? trimmed : `models/${trimmed}`;
}

function modelIdFromName(name: string): string {
  return name.startsWith('models/') ? name.slice('models/'.length) : name;
}

function toGeminiTools(tools?: ToolDefinition[]) {
  if (!tools || tools.length === 0) return undefined;

  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      })),
    },
  ];
}

function toGeminiContents(messages: ChatMessage[]): {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: GeminiContent[];
} {
  const systemMessages: string[] = [];
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemMessages.push(message.content);
      continue;
    }

    if (message.role === 'assistant') {
      const parts: GeminiPart[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const toolCall of message.tool_calls ?? []) {
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args: toolCall.function.arguments,
          },
        });
      }
      contents.push({ role: 'model', parts: parts.length > 0 ? parts : [{ text: '' }] });
      continue;
    }

    if (message.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [
          {
            text: [
              `Tool result${message.tool_call_id ? ` (${message.tool_call_id})` : ''}:`,
              message.content,
            ].join('\n'),
          },
        ],
      });
      continue;
    }

    contents.push({ role: 'user', parts: [{ text: message.content }] });
  }

  return {
    systemInstruction: systemMessages.length > 0
      ? { parts: [{ text: systemMessages.join('\n\n') }] }
      : undefined,
    contents,
  };
}

function extractGeminiResponse(response: GeminiGenerateResponse): Pick<ChatResponse, 'content' | 'toolCalls' | 'finishReason'> {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const textParts: string[] = [];
  const toolCalls: ToolCallRequest[] = [];

  for (const [index, part] of parts.entries()) {
    if (part.text) textParts.push(part.text);
    if (part.functionCall?.name) {
      toolCalls.push({
        id: `gemini_tc_${Date.now()}_${index}`,
        function: {
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        },
      });
    }
  }

  return {
    content: textParts.join(''),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
  };
}

export class GoogleGeminiProvider implements ChatProvider {
  readonly type = 'google' as const;
  readonly name = 'Google Gemini';
  private apiKey?: string;
  private accessToken?: string;
  private authMode: ProviderAuthMode;
  private baseUrl: string;
  private projectId?: string;

  constructor(config: GeminiProviderConfig) {
    this.apiKey = config.apiKey;
    this.accessToken = config.accessToken;
    this.authMode = config.authMode ?? (config.accessToken ? 'oauth' : 'api_key');
    this.baseUrl = config.baseUrl ?? DEFAULT_GEMINI_BASE_URL;
    this.projectId = config.projectId;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const modelName = normalizeModelName(options.model);
    const { systemInstruction, contents } = toGeminiContents(messages);
    const tools = toGeminiTools(options.tools);
    const response = await this.fetchGemini<GeminiGenerateResponse>(
      `/${modelName}:generateContent`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...(systemInstruction && { systemInstruction }),
          contents,
          ...(tools && { tools }),
          generationConfig: {
            ...(options.temperature !== undefined && { temperature: options.temperature }),
            ...(options.maxTokens && { maxOutputTokens: options.maxTokens }),
          },
        }),
        signal: options.signal,
      },
    );

    const extracted = extractGeminiResponse(response);
    return {
      ...extracted,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<StreamChunk> {
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
      const response = await this.fetchGemini<GeminiModelsResponse>('/models', { method: 'GET' });
      const models = (response.models ?? [])
        .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model) => ({
          id: modelIdFromName(model.name),
          name: model.displayName ?? modelIdFromName(model.name),
          provider: 'google' as const,
          contextLength: model.inputTokenLimit,
          description: model.description,
          authMode: this.authMode,
        }));

      return models.length > 0 ? models : this.fallbackModels();
    } catch {
      return this.fallbackModels();
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey && !this.accessToken) return false;
    try {
      const models = await this.listModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }

  private fallbackModels(): ModelInfo[] {
    return GEMINI_FALLBACK_MODELS.map((model) => ({ ...model, authMode: this.authMode }));
  }

  private async fetchGemini<T>(pathName: string, init: RequestInit): Promise<T> {
    if (!this.apiKey && !this.accessToken) {
      throw new Error('Google Gemini provider is not configured');
    }

    const url = new URL(`${this.baseUrl}${pathName}`);
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');

    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
      if (this.projectId) headers.set('x-goog-user-project', this.projectId);
    } else if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }

    const response = await fetch(url, { ...init, headers });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini request failed (${response.status}): ${errorText || response.statusText}`);
    }
    return response.json() as Promise<T>;
  }
}
