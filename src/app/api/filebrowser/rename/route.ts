import { NextRequest } from 'next/server';
import { renameEntry } from '@/lib/filebrowser/scanner';
import { apiError, apiSuccess } from '../../_utils/responses';

export const runtime = 'nodejs';

interface RenameBody {
  rootId?: string;
  path?: string;
  newName?: string;
}

export async function POST(req: NextRequest) {

  try {
    const body = (await req.json()) as RenameBody;
    const rootId = body.rootId;
    const relativePath = body.path;
    const newName = body.newName;

    if (!rootId || !relativePath || !newName) {
      return apiError('rootId, path und newName sind erforderlich', 400);
    }

    const entry = await renameEntry(rootId, relativePath, newName);

    return apiSuccess({ entry });
  } catch (err) {
    console.error('[FileBrowser] Rename error:', err);
    const message = err instanceof Error ? err.message : 'Fehler beim Umbenennen';
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
