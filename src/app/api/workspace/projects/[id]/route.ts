import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '../../../_utils/responses';
import {
  deleteProject,
  getProject,
  listArtifacts,
  updateProject,
} from '@/lib/workspace/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) return apiError('Project not found', 404);

    const artifacts = await listArtifacts(id);
    return apiSuccess({ project, artifacts });
  } catch (err) {
    console.error('[API] GET /api/workspace/projects/[id] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load project', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const project = await updateProject(id, body);
    if (!project) return apiError('Project not found', 404);
    return apiSuccess({ project });
  } catch (err) {
    console.error('[API] PATCH /api/workspace/projects/[id] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to update project', 400);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteProject(id);
    if (!deleted) return apiError('Project not found', 404);
    return apiSuccess();
  } catch (err) {
    console.error('[API] DELETE /api/workspace/projects/[id] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to delete project', 500);
  }
}
