import { NextRequest } from 'next/server';
import { writeFileContent, writeFileBinary } from '@/lib/filebrowser/scanner';
import { apiError, apiSuccess } from '../../_utils/responses';

export const runtime = 'nodejs';

interface WriteBody {
  rootId?: string;
  path?: string;
  content?: string;
  encoding?: 'utf-8' | 'base64';
}

export async function POST(req: NextRequest) {

  try {
    const body = (await req.json()) as WriteBody;
    const rootId = body.rootId;
    const relativePath = body.path;
    const content = body.content ?? '';

    if (!rootId || !relativePath) {
      return apiError('rootId und path sind erforderlich', 400);
    }

    const entry = body.encoding === 'base64'
      ? await writeFileBinary(rootId, relativePath, content)
      : await writeFileContent(rootId, relativePath, content);

    return apiSuccess({ entry });
  } catch (err) {
    console.error('[FileBrowser] Write error:', err);
    const message = err instanceof Error ? err.message : 'Fehler beim Speichern';
    const status =
      message.includes('nur im Workspace') ? 403
      : message.includes('Ungültig') || message.includes('erforderlich')
        ? 400
        : message.includes('nicht gefunden')
          ? 404
          : 500;

    return apiError(message, status);
  }
}
