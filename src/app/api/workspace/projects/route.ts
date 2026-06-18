import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '../../_utils/responses';
import { createProject, listProjects } from '@/lib/workspace/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await listProjects();
    return apiSuccess({ projects, count: projects.length });
  } catch (err) {
    console.error('[API] GET /api/workspace/projects error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load projects', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const project = await createProject(body);
    return apiSuccess({ project });
  } catch (err) {
    console.error('[API] POST /api/workspace/projects error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to create project', 400);
  }
}
