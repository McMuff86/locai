import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '../../_utils/responses';
import { createArtifact, listArtifacts } from '@/lib/workspace/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
    const artifacts = await listArtifacts(projectId);
    return apiSuccess({ artifacts, count: artifacts.length });
  } catch (err) {
    console.error('[API] GET /api/workspace/artifacts error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load artifacts', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const artifact = await createArtifact(body);
    return apiSuccess({ artifact });
  } catch (err) {
    console.error('[API] POST /api/workspace/artifacts error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to create artifact', 400);
  }
}
