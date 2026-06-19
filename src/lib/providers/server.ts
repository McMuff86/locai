// ============================================================================
// Server-side Provider Creation
// ============================================================================
// Reads API keys from process.env to create providers on the server (API routes).
// Never exposes keys to the client.
// ============================================================================

import {
  ChatProvider,
  ProviderAuthMode,
  ProviderType,
  ProviderConfig,
  ProviderCredentialStatus,
} from './types';
import { createProvider, PROVIDER_LABELS, PROVIDER_TYPES } from './index';
import { FallbackProvider, FallbackConfig } from './fallback';
import { readStoredProviderCredential, ResolvedProviderCredential } from './credentials';

// ---------------------------------------------------------------------------
// Environment variable mapping
// ---------------------------------------------------------------------------

const ENV_CREDENTIAL_MAP: Record<
  ProviderType,
  Array<{ envVar: string; authMode: Exclude<ProviderAuthMode, 'none'> }>
> = {
  ollama: [],
  anthropic: [{ envVar: 'ANTHROPIC_API_KEY', authMode: 'api_key' }],
  openai: [
    { envVar: 'OPENAI_API_KEY', authMode: 'api_key' },
    { envVar: 'OPENAI_ACCESS_TOKEN', authMode: 'workload_identity' },
    { envVar: 'OPENAI_OAUTH_ACCESS_TOKEN', authMode: 'workload_identity' },
  ],
  openrouter: [
    { envVar: 'OPENROUTER_API_KEY', authMode: 'api_key' },
    { envVar: 'OPENROUTER_OAUTH_KEY', authMode: 'oauth' },
    { envVar: 'OPENROUTER_ACCESS_TOKEN', authMode: 'oauth' },
  ],
  google: [
    { envVar: 'GEMINI_API_KEY', authMode: 'api_key' },
    { envVar: 'GOOGLE_API_KEY', authMode: 'api_key' },
    { envVar: 'GEMINI_OAUTH_ACCESS_TOKEN', authMode: 'oauth' },
    { envVar: 'GOOGLE_OAUTH_ACCESS_TOKEN', authMode: 'oauth' },
    { envVar: 'GOOGLE_CLOUD_ACCESS_TOKEN', authMode: 'oauth' },
  ],
};

const ENV_BASE_URL_MAP: Record<ProviderType, string | null> = {
  ollama: 'OLLAMA_HOST',
  anthropic: 'ANTHROPIC_BASE_URL',
  openai: 'OPENAI_BASE_URL',
  openrouter: 'OPENROUTER_BASE_URL',
  google: 'GEMINI_BASE_URL',
};

const PROVIDER_OAUTH_NOTES: Record<ProviderType, { supportsOAuth: boolean; note?: string }> = {
  ollama: { supportsOAuth: false, note: 'Local provider; no credential required.' },
  anthropic: {
    supportsOAuth: false,
    note: 'Claude.ai/Claude Code OAuth is not permitted for third-party product routing; use Anthropic API keys or cloud provider auth.',
  },
  openai: {
    supportsOAuth: true,
    note: 'OpenAI API supports API keys and workload identity access tokens; consumer ChatGPT OAuth is not a general API credential.',
  },
  openrouter: {
    supportsOAuth: true,
    note: 'OpenRouter PKCE returns a user-controlled API key that LocAI can store locally.',
  },
  google: {
    supportsOAuth: true,
    note: 'Gemini API supports OAuth bearer tokens and API keys.',
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function resolveServerProviderCredential(
  type: ProviderType,
  overrides?: Partial<ProviderConfig>,
): ResolvedProviderCredential {
  if (type === 'ollama') {
    return {
      provider: type,
      authMode: 'none',
      source: 'none',
    };
  }

  const overrideCredential = overrides?.accessToken || overrides?.apiKey;
  if (overrideCredential) {
    return {
      provider: type,
      credential: overrideCredential,
      projectId: overrides?.projectId,
      authMode: overrides?.authMode ?? (overrides.accessToken ? 'oauth' : 'api_key'),
      source: 'override',
    };
  }

  for (const candidate of ENV_CREDENTIAL_MAP[type]) {
    const credential = process.env[candidate.envVar];
    if (credential) {
      return {
        provider: type,
        credential,
        projectId: resolveProjectId(type, overrides),
        authMode: candidate.authMode,
        source: 'env',
        envVar: candidate.envVar,
      };
    }
  }

  const stored = readStoredProviderCredential(type);
  if (stored) {
    return {
      provider: type,
      credential: stored.credential,
      projectId: stored.projectId || resolveProjectId(type, overrides),
      authMode: stored.authMode,
      source: 'local_store',
    };
  }

  return {
    provider: type,
    projectId: resolveProjectId(type, overrides),
    authMode: 'none',
    source: 'none',
  };
}

export function getServerProviderCredentialStatus(type: ProviderType): ProviderCredentialStatus {
  const resolved = resolveServerProviderCredential(type);
  const oauth = PROVIDER_OAUTH_NOTES[type];
  return {
    type,
    configured: type === 'ollama' || !!resolved.credential,
    authMode: resolved.authMode,
    source: resolved.source,
    envVar: resolved.envVar,
    supportsOAuth: oauth.supportsOAuth,
    note: oauth.note,
  };
}

export function getServerProviderCredentialStatuses(): Record<ProviderType, ProviderCredentialStatus> {
  return PROVIDER_TYPES.reduce((acc, type) => {
    acc[type] = getServerProviderCredentialStatus(type);
    return acc;
  }, {} as Record<ProviderType, ProviderCredentialStatus>);
}

/**
 * Create a provider from environment variables, with optional overrides.
 * Returns null if required credential is missing.
 */
export function createServerProvider(
  type: ProviderType,
  overrides?: Partial<ProviderConfig>,
): ChatProvider | null {
  const envBaseUrl = ENV_BASE_URL_MAP[type];

  const baseUrl = overrides?.baseUrl || (envBaseUrl ? process.env[envBaseUrl] : undefined);
  const resolvedCredential = resolveServerProviderCredential(type, overrides);

  // Non-Ollama providers require a server-side credential
  if (type !== 'ollama' && !resolvedCredential.credential) return null;

  const config: ProviderConfig = {
    type,
    enabled: true,
    baseUrl: baseUrl || undefined,
    authMode: resolvedCredential.authMode,
    projectId: resolvedCredential.projectId,
    ...overrides,
  };

  if (type !== 'ollama' && resolvedCredential.credential) {
    if (type === 'google' && resolvedCredential.authMode !== 'api_key') {
      config.accessToken = resolvedCredential.credential;
    } else {
      config.apiKey = resolvedCredential.credential;
    }
  }

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
  const providers: ChatProvider[] = [];

  for (const type of PROVIDER_TYPES) {
    const provider = createServerProvider(type);
    if (provider) providers.push(provider);
  }

  return providers;
}

function resolveProjectId(type: ProviderType, overrides?: Partial<ProviderConfig>): string | undefined {
  if (overrides?.projectId) return overrides.projectId;
  if (type !== 'google') return undefined;
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_PROJECT_ID || process.env.GEMINI_PROJECT_ID;
}

export function getProviderLabel(type: ProviderType): string {
  return PROVIDER_LABELS[type];
}
