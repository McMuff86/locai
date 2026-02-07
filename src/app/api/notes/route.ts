import { NextRequest, NextResponse } from 'next/server';
import { FileNoteStorage } from '@/lib/notes/fileNoteStorage';
import { NoteInput } from '@/lib/notes/types';
import { sanitizeBasePath } from '../_utils/security';

export const runtime = 'nodejs';

function getBasePath(req: NextRequest, bodyBasePath?: string | null): string | null {
  return (
    bodyBasePath ||
    req.nextUrl.searchParams.get('basePath') ||
    req.headers.get('x-notes-path') ||
    process.env.LOCAL_NOTES_PATH ||
    null
  );
}

function buildStorage(req: NextRequest, bodyBasePath?: string | null) {
  const raw = getBasePath(req, bodyBasePath);
  if (!raw) {
    return { error: NextResponse.json({ error: 'basePath is required' }, { status: 400 }) };
  }
  // SEC-2: Validate basePath (no traversal)
  const basePath = sanitizeBasePath(raw);
  if (!basePath) {
    return { error: NextResponse.json({ error: 'Invalid basePath' }, { status: 400 }) };
  }
  return { storage: new FileNoteStorage(basePath) };
}

export async function GET(req: NextRequest) {
  const { storage, error } = buildStorage(req);
  if (error || !storage) return error;

  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const note = await storage.getNote(id);
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    return NextResponse.json(note);
  }

  const notes = await storage.listNotes();
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as NoteInput & { basePath?: string };
  const { storage, error } = buildStorage(req, body.basePath || null);
  if (error || !storage) return error;

  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const saved = await storage.saveNote({
    id: body.id,
    title: body.title,
    content: body.content || '',
    tags: body.tags || [],
    links: body.links || [],
  });

  return NextResponse.json(saved);
}

export async function DELETE(req: NextRequest) {
  const { storage, error } = buildStorage(req);
  if (error || !storage) return error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const ok = await storage.deleteNote(id);
  if (!ok) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}


