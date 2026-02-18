import { NextRequest, NextResponse } from 'next/server';
import { assertLocalRequest } from '@/app/api/_utils/security';
import { writeFileContent } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

interface WriteBody {
  rootId?: string;
  path?: string;
  content?: string;
}

export async function POST(req: NextRequest) {
  const forbidden = assertLocalRequest(req);
  if (forbidden) return forbidden;

  try {
    const body = (await req.json()) as WriteBody;
    const rootId = body.rootId;
    const relativePath = body.path;
    const content = body.content ?? '';

    if (!rootId || !relativePath) {
      return NextResponse.json(
        { success: false, error: 'rootId und path sind erforderlich' },
        { status: 400 },
      );
    }

    const entry = await writeFileContent(rootId, relativePath, content);

    return NextResponse.json({ success: true, entry });
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

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
