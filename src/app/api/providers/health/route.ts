// ============================================================================
// Provider Health Check API
// ============================================================================

import { NextResponse } from 'next/server';
import { ProviderType } from '@/lib/providers/types';
import { createServerProvider } from '@/lib/providers/server';

export interface ProviderHealth {
  name: string;
  type: ProviderType;
  status: 'online' | 'offline' | 'degraded';
  latencyMs: number;
  models: string[];
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

  const labels: Record<ProviderType, string> = {
    ollama: 'Ollama',
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
  };

  if (!provider) {
    return {
      name: labels[type],
      type,
      status: 'offline',
      latencyMs: -1,
      models: [],
      error: type === 'ollama' ? 'Not reachable' : 'No API key configured',
    };
  }

  const start = performance.now();
  try {
    const models = await provider.listModels();
    const latencyMs = Math.round(performance.now() - start);

    return {
      name: labels[type],
      type,
      status: models.length > 0 ? 'online' : 'degraded',
      latencyMs,
      models: models.map((m) => m.name || m.id),
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      name: labels[type],
      type,
      status: 'offline',
      latencyMs,
      models: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function GET() {
  const types: ProviderType[] = ['ollama', 'anthropic', 'openai', 'openrouter'];

  const providers = await Promise.all(types.map(checkProvider));

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
