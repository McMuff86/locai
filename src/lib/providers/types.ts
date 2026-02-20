// ============================================================================
// Chat Provider Abstraction Layer
// ============================================================================
// Unified interface for LLM providers (Ollama, Anthropic, OpenAI, OpenRouter).
// Each provider implements ChatProvider to enable model-per-node in Flow.
// ============================================================================

// ---------------------------------------------------------------------------
// Core Message Types (provider-agnostic)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCallRequest[];
  tool_call_id?: string;
  images?: string[]; // base64 encoded
}

export interface ToolCallRequest {
  id: string;
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

// ---------------------------------------------------------------------------
// Chat Options
// ---------------------------------------------------------------------------

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Chat Response
// ---------------------------------------------------------------------------

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCallRequest[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface StreamChunk {
  content?: string;
  toolCalls?: ToolCallRequest[];
  done: boolean;
  usage?: ChatResponse['usage'];
}

// ---------------------------------------------------------------------------
// Model Info
// ---------------------------------------------------------------------------

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderType;
  size?: number;
  contextLength?: number;
  description?: string;
}

// ---------------------------------------------------------------------------
// Provider Types
// ---------------------------------------------------------------------------

export type ProviderType = 'ollama' | 'anthropic' | 'openai' | 'openrouter';

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Chat Provider Interface
// ---------------------------------------------------------------------------

export interface ChatProvider {
  readonly type: ProviderType;
  readonly name: string;

  /** Send a chat message and get a complete response */
  chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse>;

  /** Send a chat message and stream the response */
  chatStream(
    messages: ChatMessage[],
    options: ChatOptions
  ): AsyncGenerator<StreamChunk>;

  /** List available models for this provider */
  listModels(): Promise<ModelInfo[]>;

  /** Check if the provider is configured and reachable */
  isAvailable(): Promise<boolean>;
}
