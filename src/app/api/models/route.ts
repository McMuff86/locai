// ============================================================================
// Models API Route
// ============================================================================
// GET /api/models — list available models across all configured providers
// GET /api/models?provider=anthropic — list models for a specific provider
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAvailableServerProviders, createServerProvider } from '@/lib/providers/server';
import type { ProviderType, ModelInfo } from '@/lib/providers/types';

export async function GET(request: NextRequest) {
  try {
    const providerParam = request.nextUrl.searchParams.get('provider') as ProviderType | null;

    if (providerParam) {
      // Single provider
      const provider = createServerProvider(providerParam);
      if (!provider) {
        return NextResponse.json(
          { error: `Provider "${providerParam}" is not configured` },
          { status: 400 },
        );
      }
      const models = await provider.listModels();
      return NextResponse.json({ provider: providerParam, models });
    }

    // All configured providers
    const providers = getAvailableServerProviders();
    const results = await Promise.allSettled(
      providers.map(async (p) => {
        const models = await p.listModels();
        return { provider: p.type, models };
      }),
    );

    const allModels: ModelInfo[] = [];
    const byProvider: Record<string, ModelInfo[]> = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allModels.push(...result.value.models);
        byProvider[result.value.provider] = result.value.models;
      }
    }

    return NextResponse.json({
      providers: providers.map((p) => p.type),
      byProvider,
      models: allModels,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
