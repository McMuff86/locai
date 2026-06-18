import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '../../../_utils/responses';
import {
  deleteArtifact,
  getArtifact,
  updateArtifact,
} from '@/lib/workspace/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const artifact = await getArtifact(id);
    if (!artifact) return apiError('Artifact not found', 404);
    return apiSuccess({ artifact });
  } catch (err) {
    console.error('[API] GET /api/workspace/artifacts/[id] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load artifact', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const artifact = await updateArtifact(id, body);
    if (!artifact) return apiError('Artifact not found', 404);
    return apiSuccess({ artifact });
  } catch (err) {
    console.error('[API] PATCH /api/workspace/artifacts/[id] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to update artifact', 400);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteArtifact(id);
    if (!deleted) return apiError('Artifact not found', 404);
    return apiSuccess();
  } catch (err) {
    console.error('[API] DELETE /api/workspace/artifacts/[id] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to delete artifact', 500);
  }
}
