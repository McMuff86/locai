import { NextRequest, NextResponse } from 'next/server';
import { FileNoteStorage } from '@/lib/notes/fileNoteStorage';
import { NoteInput } from '@/lib/notes/types';
import { sanitizeBasePath } from '../_utils/security';
import { apiError, apiSuccess } from '../_utils/responses';

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
    return { error: apiError('basePath is required', 400) };
  }
  // SEC-2: Validate basePath (no traversal)
  const basePath = sanitizeBasePath(raw);
  if (!basePath) {
    return { error: apiError('Invalid basePath', 400) };
  }
  return { storage: new FileNoteStorage(basePath) };
}

export async function GET(req: NextRequest) {
  const { storage, error } = buildStorage(req);
  if (error || !storage) return error;

  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const note = await storage.getNote(id);
    if (!note) return apiError('Note not found', 404);
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
    return apiError('title is required', 400);
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
  if (!id) return apiError('id is required', 400);

  const ok = await storage.deleteNote(id);
  if (!ok) return apiError('Note not found', 404);

  return apiSuccess();
}


