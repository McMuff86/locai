import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '../../../../_utils/responses';
import {
  createSavepoint,
  listSavepoints,
} from '@/lib/workspace/store';
import type { ArtifactSavepoint } from '@/lib/workspace/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateSavepointBody {
  reason?: string;
  createdBy?: ArtifactSavepoint['createdBy'];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const savepoints = await listSavepoints(id);
    return apiSuccess({ savepoints, count: savepoints.length });
  } catch (err) {
    console.error('[API] GET /api/workspace/artifacts/[id]/savepoints error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load savepoints', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as CreateSavepointBody;
    const savepoint = await createSavepoint(
      id,
      body.reason || 'Manual savepoint',
      body.createdBy || 'user',
    );
    if (!savepoint) return apiError('Artifact not found', 404);
    return apiSuccess({ savepoint });
  } catch (err) {
    console.error('[API] POST /api/workspace/artifacts/[id]/savepoints error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to create savepoint', 400);
  }
}
