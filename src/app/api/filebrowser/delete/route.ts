import { NextRequest } from 'next/server';
import { deleteFile } from '@/lib/filebrowser/scanner';
import { apiError, apiSuccess } from '../../_utils/responses';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest) {

  try {
    const rootId = req.nextUrl.searchParams.get('rootId');
    const relativePath = req.nextUrl.searchParams.get('path') || '';

    if (!rootId || !relativePath) {
      return apiError('rootId und path sind erforderlich', 400);
    }

    if (rootId !== 'workspace') {
      return apiError('Löschen ist nur im Workspace erlaubt', 403);
    }

    await deleteFile(rootId, relativePath);

    return apiSuccess();
  } catch (err) {
    console.error('[FileBrowser] Delete error:', err);
    return apiError(err instanceof Error ? err.message : 'Fehler beim Löschen', 500);
  }
}
