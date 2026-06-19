// ============================================================================
// Provider Health Check API
// ============================================================================

import { NextResponse } from 'next/server';
import { ProviderAuthMode, ProviderCredentialSource, ProviderType } from '@/lib/providers/types';
import {
  createServerProvider,
  getProviderLabel,
  getServerProviderCredentialStatus,
} from '@/lib/providers/server';
import { PROVIDER_TYPES } from '@/lib/providers';

export interface ProviderHealth {
  name: string;
  type: ProviderType;
  status: 'online' | 'offline' | 'degraded';
  latencyMs: number;
  models: string[];
  authMode: ProviderAuthMode;
  credentialSource: ProviderCredentialSource;
  supportsOAuth: boolean;
  error?: string;
}

export interface HealthResponse {
  providers: ProviderHealth[];
  recommendation: {
    fast: string | null;
    complex: string | null;
  };
}

async function checkProvider(type: ProviderType): Promise<ProviderHealth> {
  const provider = createServerProvider(type);
  const auth = getServerProviderCredentialStatus(type);

  if (!provider) {
    return {
      name: getProviderLabel(type),
      type,
      status: 'offline',
      latencyMs: -1,
      models: [],
      authMode: auth.authMode,
      credentialSource: auth.source,
      supportsOAuth: auth.supportsOAuth,
      error: type === 'ollama' ? 'Not reachable' : auth.note || 'No provider credential configured',
    };
  }

  const start = performance.now();
  try {
    const models = await provider.listModels();
    const latencyMs = Math.round(performance.now() - start);

    return {
      name: getProviderLabel(type),
      type,
      status: models.length > 0 ? 'online' : 'degraded',
      latencyMs,
      models: models.map((m) => m.name || m.id),
      authMode: auth.authMode,
      credentialSource: auth.source,
      supportsOAuth: auth.supportsOAuth,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      name: getProviderLabel(type),
      type,
      status: 'offline',
      latencyMs,
      models: [],
      authMode: auth.authMode,
      credentialSource: auth.source,
      supportsOAuth: auth.supportsOAuth,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function GET() {
  const providers = await Promise.all(PROVIDER_TYPES.map(checkProvider));

  // Recommendations: fast = lowest latency online provider's first model
  const online = providers.filter((p) => p.status === 'online' && p.models.length > 0);
  const sorted = [...online].sort((a, b) => a.latencyMs - b.latencyMs);

  const fast = sorted[0]?.models[0] ?? null;
  // Complex = largest Ollama model (by name heuristic) or last model of biggest provider
  const ollamaProvider = online.find((p) => p.type === 'ollama');
  const complex =
    ollamaProvider?.models[ollamaProvider.models.length - 1] ??
    online[0]?.models[online[0].models.length - 1] ??
    null;

  const response: HealthResponse = {
    providers,
    recommendation: { fast, complex },
  };

  return NextResponse.json(response);
}
