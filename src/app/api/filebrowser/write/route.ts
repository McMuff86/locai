import { NextRequest, NextResponse } from 'next/server';
import { writeFileContent, writeFileBinary } from '@/lib/filebrowser/scanner';

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
      return NextResponse.json(
        { success: false, error: 'rootId und path sind erforderlich' },
        { status: 400 },
      );
    }

    const entry = body.encoding === 'base64'
      ? await writeFileBinary(rootId, relativePath, content)
      : await writeFileContent(rootId, relativePath, content);

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
