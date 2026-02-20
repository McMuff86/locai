import { NextRequest } from 'next/server';
import { moveEntry } from '@/lib/filebrowser/scanner';
import { apiError, apiSuccess } from '../../_utils/responses';

export const runtime = 'nodejs';

interface MoveBody {
  rootId?: string;
  path?: string;
  targetPath?: string;
}

export async function POST(req: NextRequest) {

  try {
    const body = (await req.json()) as MoveBody;
    const rootId = body.rootId;
    const relativePath = body.path;
    const targetPath = body.targetPath;

    if (!rootId || !relativePath || targetPath === undefined) {
      return apiError('rootId, path und targetPath sind erforderlich', 400);
    }

    const entry = await moveEntry(rootId, relativePath, targetPath);

    return apiSuccess({ entry });
  } catch (err) {
    console.error('[FileBrowser] Move error:', err);
    const message = err instanceof Error ? err.message : 'Fehler beim Verschieben';
    const status =
      message.includes('nur im Workspace') ? 403
      : message.includes('Ungültig') || message.includes('nicht leer') || message.includes('erforderlich')
        ? 400
        : message.includes('existiert')
          ? 409
          : 500;

    return apiError(message, status);
  }
}
