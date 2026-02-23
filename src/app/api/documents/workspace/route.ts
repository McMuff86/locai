// ============================================================================
// POST /api/documents/workspace - Workspace Auto-Indexing Control
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { apiError, apiSuccess } from '../../_utils/responses';

// Note: Workspace indexer will be imported dynamically to avoid build issues

export const runtime = 'nodejs';

interface WorkspaceActionRequest {
  action: 'start' | 'stop' | 'status' | 'add-path' | 'remove-path';
  path?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: WorkspaceActionRequest = await req.json();
    const { action, path } = body;

    // Dynamic import to avoid build issues
    const { getWorkspaceIndexer, startWorkspaceIndexer, stopWorkspaceIndexer } = await import('@/lib/documents/workspace-indexer');
    const indexer = getWorkspaceIndexer();

    switch (action) {
      case 'start':
        await startWorkspaceIndexer();
        return apiSuccess({ 
          message: 'Workspace indexer started',
          status: 'running'
        });

      case 'stop':
        stopWorkspaceIndexer();
        return apiSuccess({ 
          message: 'Workspace indexer stopped',
          status: 'stopped'
        });

      case 'status':
        return apiSuccess({ 
          status: (indexer as any).enabled ? 'running' : 'stopped',
          workspacePaths: (indexer as any).workspacePaths
        });

      case 'add-path':
        if (!path) {
          return apiError('Path required for add-path action', 400);
        }
        indexer.addWorkspacePath(path);
        return apiSuccess({ 
          message: `Added workspace path: ${path}`,
          workspacePaths: (indexer as any).workspacePaths
        });

      case 'remove-path':
        if (!path) {
          return apiError('Path required for remove-path action', 400);
        }
        indexer.removeWorkspacePath(path);
        return apiSuccess({ 
          message: `Removed workspace path: ${path}`,
          workspacePaths: (indexer as any).workspacePaths
        });

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('[Workspace] API error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Workspace action failed',
      500
    );
  }
}