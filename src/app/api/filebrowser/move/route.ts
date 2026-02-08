import { NextRequest, NextResponse } from 'next/server';
import { assertLocalRequest } from '@/app/api/_utils/security';
import { moveEntry } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

interface MoveBody {
  rootId?: string;
  path?: string;
  targetPath?: string;
}

export async function POST(req: NextRequest) {
  const forbidden = assertLocalRequest(req);
  if (forbidden) return forbidden;

  try {
    const body = (await req.json()) as MoveBody;
    const rootId = body.rootId;
    const relativePath = body.path;
    const targetPath = body.targetPath;

    if (!rootId || !relativePath || targetPath === undefined) {
      return NextResponse.json(
        { success: false, error: 'rootId, path und targetPath sind erforderlich' },
        { status: 400 },
      );
    }

    const entry = await moveEntry(rootId, relativePath, targetPath);

    return NextResponse.json({ success: true, entry });
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

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
