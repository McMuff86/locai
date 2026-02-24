// ============================================================================
// Provider Fallback — automatic failover when Ollama is slow/unreachable
// ============================================================================
// Wraps a primary (Ollama) provider with timeout detection and automatic
// fallback to a configured cloud provider (Anthropic/OpenAI/OpenRouter).
// ============================================================================

import {
  ChatProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ModelInfo,
  ProviderType,
} from './types';

// ---------------------------------------------------------------------------
// Fallback Configuration
// ---------------------------------------------------------------------------

export interface FallbackConfig {
  /** Whether automatic fallback is enabled */
  enabled: boolean;
  /** Timeout in ms before falling back (default: 30000) */
  timeoutMs: number;
  /** The cloud provider to fall back to */
  fallbackProvider: ProviderType;
  /** The model to use on the fallback provider */
  fallbackModel: string;
}

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enabled: false,
  timeoutMs: 30000,
  fallbackProvider: 'openai',
  fallbackModel: 'gpt-4o-mini',
};

// ---------------------------------------------------------------------------
// Fallback result metadata
// ---------------------------------------------------------------------------

export interface FallbackResult<T> {
  result: T;
  /** True if the fallback provider was used */
  didFallback: boolean;
  /** Name of the provider that actually handled the request */
  actualProvider: ProviderType;
  /** Model used */
  actualModel: string;
  /** Reason for fallback, if any */
  fallbackReason?: string;
}

// ---------------------------------------------------------------------------
// FallbackProvider — wraps primary + fallback
// ---------------------------------------------------------------------------

export class FallbackProvider implements ChatProvider {
  readonly type: ProviderType;
  readonly name: string;

  private primary: ChatProvider;
  private fallback: ChatProvider;
  private config: FallbackConfig;
  private _lastFallbackResult: {
    didFallback: boolean;
    actualProvider: ProviderType;
    actualModel: string;
    fallbackReason?: string;
  } | null = null;

  constructor(
    primary: ChatProvider,
    fallback: ChatProvider,
    config: FallbackConfig,
  ) {
    this.primary = primary;
    this.fallback = fallback;
    this.config = config;
    this.type = primary.type;
    this.name = `${primary.name} (with fallback)`;
  }

  /** Access metadata about the last call (did it fall back?) */
  get lastFallbackInfo() {
    return this._lastFallbackResult;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    if (!this.config.enabled) {
      this._lastFallbackResult = {
        didFallback: false,
        actualProvider: this.primary.type,
        actualModel: options.model,
      };
      return this.primary.chat(messages, options);
    }

    try {
      const result = await this.withTimeout(
        () => this.primary.chat(messages, options),
        this.config.timeoutMs,
      );
      this._lastFallbackResult = {
        didFallback: false,
        actualProvider: this.primary.type,
        actualModel: options.model,
      };
      return result;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error';
      console.warn(
        `[FallbackProvider] Primary provider (${this.primary.type}) failed: ${reason}. Falling back to ${this.fallback.type}/${this.config.fallbackModel}`,
      );

      this._lastFallbackResult = {
        didFallback: true,
        actualProvider: this.fallback.type,
        actualModel: this.config.fallbackModel,
        fallbackReason: reason,
      };

      return this.fallback.chat(messages, {
        ...options,
        model: this.config.fallbackModel,
      });
    }
  }

  async *chatStream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk> {
    if (!this.config.enabled) {
      this._lastFallbackResult = {
        didFallback: false,
        actualProvider: this.primary.type,
        actualModel: options.model,
      };
      yield* this.primary.chatStream(messages, options);
      return;
    }

    // For streaming, we try to get the first chunk within timeout.
    // If it fails or times out, we fall back entirely.
    try {
      const gen = this.primary.chatStream(messages, options);
      const firstChunk = await this.withTimeout(
        () => gen.next(),
        this.config.timeoutMs,
      );

      this._lastFallbackResult = {
        didFallback: false,
        actualProvider: this.primary.type,
        actualModel: options.model,
      };

      if (!firstChunk.done) {
        yield firstChunk.value;
      }

      // Continue with remaining chunks (no timeout on subsequent chunks)
      yield* gen;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error';
      console.warn(
        `[FallbackProvider] Primary streaming failed: ${reason}. Falling back to ${this.fallback.type}/${this.config.fallbackModel}`,
      );

      this._lastFallbackResult = {
        didFallback: true,
        actualProvider: this.fallback.type,
        actualModel: this.config.fallbackModel,
        fallbackReason: reason,
      };

      yield* this.fallback.chatStream(messages, {
        ...options,
        model: this.config.fallbackModel,
      });
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.primary.listModels();
  }

  async isAvailable(): Promise<boolean> {
    return this.primary.isAvailable();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fn().then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
