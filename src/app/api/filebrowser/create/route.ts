import { NextRequest, NextResponse } from 'next/server';
import { createDirectory, createFile } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

interface CreateBody {
  rootId?: string;
  path?: string;
  name?: string;
  type?: 'file' | 'directory';
  content?: string;
}

export async function POST(req: NextRequest) {

  try {
    const body = (await req.json()) as CreateBody;
    const rootId = body.rootId;
    const parentPath = body.path || '';
    const name = body.name;
    const type = body.type || 'file';

    if (!rootId || !name) {
      return NextResponse.json(
        { success: false, error: 'rootId und name sind erforderlich' },
        { status: 400 },
      );
    }

    const entry =
      type === 'directory'
        ? await createDirectory(rootId, parentPath, name)
        : await createFile(rootId, parentPath, name, body.content ?? '');

    return NextResponse.json({ success: true, entry });
  } catch (err) {
    console.error('[FileBrowser] Create error:', err);
    const message = err instanceof Error ? err.message : 'Fehler beim Erstellen';
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
