// ============================================================================
// Provider Registry — manages all configured ChatProviders
// ============================================================================

export * from './types';
export { OllamaProvider } from './ollama-provider';
export { AnthropicProvider } from './anthropic-provider';
export { OpenAICompatibleProvider } from './openai-provider';

import {
  ChatProvider,
  ProviderType,
  ProviderConfig,
  ModelInfo,
} from './types';
import { OllamaProvider } from './ollama-provider';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAICompatibleProvider } from './openai-provider';

// ---------------------------------------------------------------------------
// Settings key for provider configs (stored alongside other LocAI settings)
// ---------------------------------------------------------------------------

const PROVIDER_SETTINGS_KEY = 'locai-provider-settings';

export interface ProviderSettings {
  providers: Record<ProviderType, ProviderConfig>;
}

const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  providers: {
    ollama: { type: 'ollama', enabled: true },
    anthropic: { type: 'anthropic', enabled: false },
    openai: { type: 'openai', enabled: false },
    openrouter: { type: 'openrouter', enabled: false },
  },
};

// ---------------------------------------------------------------------------
// Load/Save provider settings (client-side localStorage)
// ---------------------------------------------------------------------------

export function loadProviderSettings(): ProviderSettings {
  if (typeof window === 'undefined') return DEFAULT_PROVIDER_SETTINGS;
  try {
    const stored = window.localStorage.getItem(PROVIDER_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_PROVIDER_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PROVIDER_SETTINGS;
}

export function saveProviderSettings(settings: ProviderSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(settings));
}

// ---------------------------------------------------------------------------
// Create provider instance from config
// ---------------------------------------------------------------------------

export function createProvider(
  config: ProviderConfig,
  ollamaHost?: string
): ChatProvider | null {
  if (!config.enabled) return null;

  switch (config.type) {
    case 'ollama':
      return new OllamaProvider(ollamaHost);

    case 'anthropic':
      if (!config.apiKey) return null;
      return new AnthropicProvider(config.apiKey, config.baseUrl);

    case 'openai':
      if (!config.apiKey) return null;
      return new OpenAICompatibleProvider('openai', config.apiKey, config.baseUrl);

    case 'openrouter':
      if (!config.apiKey) return null;
      return new OpenAICompatibleProvider('openrouter', config.apiKey, config.baseUrl);

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Provider Registry — singleton that manages all active providers
// ---------------------------------------------------------------------------

export class ProviderRegistry {
  private providers: Map<ProviderType, ChatProvider> = new Map();
  private ollamaHost?: string;

  constructor(ollamaHost?: string) {
    this.ollamaHost = ollamaHost;
    this.refresh();
  }

  /** Reload providers from settings */
  refresh(): void {
    const settings = loadProviderSettings();
    this.providers.clear();

    for (const [type, config] of Object.entries(settings.providers)) {
      const provider = createProvider(config, this.ollamaHost);
      if (provider) {
        this.providers.set(type as ProviderType, provider);
      }
    }

    // Always ensure Ollama is available as fallback
    if (!this.providers.has('ollama')) {
      this.providers.set('ollama', new OllamaProvider(this.ollamaHost));
    }
  }

  /** Get a specific provider */
  get(type: ProviderType): ChatProvider | undefined {
    return this.providers.get(type);
  }

  /** Get provider or fallback to Ollama */
  getOrFallback(type: ProviderType): ChatProvider {
    return this.providers.get(type) ?? this.providers.get('ollama')!;
  }

  /** List all active providers */
  listActive(): ChatProvider[] {
    return Array.from(this.providers.values());
  }

  /** List all active provider types */
  listActiveTypes(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /** Get all models across all active providers */
  async listAllModels(): Promise<ModelInfo[]> {
    const results = await Promise.allSettled(
      this.listActive().map((p) => p.listModels())
    );
    const models: ModelInfo[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        models.push(...result.value);
      }
    }
    return models;
  }
}
