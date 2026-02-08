// ============================================================================
// Memory API Route
// ============================================================================
// GET  → list memories (optional ?q=search query)
// POST → save a memory
// DELETE → delete a memory by id
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listMemories, searchMemories, saveMemory, deleteMemory } from '@/lib/memory/store';

export const dynamic = 'force-dynamic';

// GET /api/memory?q=optional_search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (query) {
      const results = await searchMemories(query);
      return NextResponse.json({ memories: results });
    }

    const memories = await listMemories();
    return NextResponse.json({ memories });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load memories' },
      { status: 500 },
    );
  }
}

// POST /api/memory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, category, tags, source } = body;

    if (!key || !value || !category) {
      return NextResponse.json(
        { error: 'key, value, and category are required' },
        { status: 400 },
      );
    }

    const entry = await saveMemory({ key, value, category, tags, source });
    return NextResponse.json({ success: true, entry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save memory' },
      { status: 500 },
    );
  }
}

// DELETE /api/memory?id={id}
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    }

    const deleted = await deleteMemory(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete memory' },
      { status: 500 },
    );
  }
}
