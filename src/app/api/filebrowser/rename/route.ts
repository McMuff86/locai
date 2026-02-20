import { NextRequest, NextResponse } from 'next/server';
import { renameEntry } from '@/lib/filebrowser/scanner';

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
      return NextResponse.json(
        { success: false, error: 'rootId, path und newName sind erforderlich' },
        { status: 400 },
      );
    }

    const entry = await renameEntry(rootId, relativePath, newName);

    return NextResponse.json({ success: true, entry });
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

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
