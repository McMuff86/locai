// ============================================================================
// Server-side Provider Creation
// ============================================================================
// Reads API keys from process.env to create providers on the server (API routes).
// Never exposes keys to the client.
// ============================================================================

import {
  ChatProvider,
  ProviderType,
  ProviderConfig,
} from './types';
import { createProvider } from './index';
import { FallbackProvider, FallbackConfig } from './fallback';

// ---------------------------------------------------------------------------
// Environment variable mapping
// ---------------------------------------------------------------------------

const ENV_KEY_MAP: Record<ProviderType, string | null> = {
  ollama: null, // No key needed
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

const ENV_BASE_URL_MAP: Record<ProviderType, string | null> = {
  ollama: 'OLLAMA_HOST',
  anthropic: 'ANTHROPIC_BASE_URL',
  openai: 'OPENAI_BASE_URL',
  openrouter: 'OPENROUTER_BASE_URL',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a provider from environment variables, with optional overrides.
 * Returns null if required API key is missing.
 */
export function createServerProvider(
  type: ProviderType,
  overrides?: Partial<ProviderConfig>,
): ChatProvider | null {
  const envKey = ENV_KEY_MAP[type];
  const envBaseUrl = ENV_BASE_URL_MAP[type];

  const apiKey = overrides?.apiKey || (envKey ? process.env[envKey] : undefined);
  const baseUrl = overrides?.baseUrl || (envBaseUrl ? process.env[envBaseUrl] : undefined);

  // Non-Ollama providers require an API key
  if (type !== 'ollama' && !apiKey) return null;

  const config: ProviderConfig = {
    type,
    enabled: true,
    apiKey: apiKey || undefined,
    baseUrl: baseUrl || undefined,
    ...overrides,
  };

  const ollamaHost = type === 'ollama' ? (baseUrl || process.env.OLLAMA_HOST) : undefined;
  return createProvider(config, ollamaHost);
}

/**
 * Get the default server provider (Ollama fallback).
 */
export function getDefaultServerProvider(): ChatProvider {
  const provider = createServerProvider('ollama');
  // Ollama always succeeds (no key required)
  return provider!;
}

/**
 * Wrap a primary provider with automatic fallback if configured.
 * Returns a FallbackProvider if fallback is enabled and the fallback provider is available,
 * otherwise returns the primary provider as-is.
 */
export function wrapWithFallback(
  primary: ChatProvider,
  fallbackConfig: FallbackConfig,
): ChatProvider | FallbackProvider {
  if (!fallbackConfig.enabled) return primary;

  const fallback = createServerProvider(fallbackConfig.fallbackProvider);
  if (!fallback) {
    console.warn(
      `[Fallback] Fallback provider "${fallbackConfig.fallbackProvider}" is not configured. Skipping fallback.`,
    );
    return primary;
  }

  return new FallbackProvider(primary, fallback, fallbackConfig);
}

/**
 * Get all providers that are configured (have API keys or are Ollama).
 */
export function getAvailableServerProviders(): ChatProvider[] {
  const types: ProviderType[] = ['ollama', 'anthropic', 'openai', 'openrouter'];
  const providers: ChatProvider[] = [];

  for (const type of types) {
    const provider = createServerProvider(type);
    if (provider) providers.push(provider);
  }

  return providers;
}
