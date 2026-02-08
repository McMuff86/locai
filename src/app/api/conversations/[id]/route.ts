// ============================================================================
// Single Conversation API Route
// ============================================================================
// GET  /api/conversations/{id} → full conversation with messages
// PUT  /api/conversations/{id} → update metadata (title, tags)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { loadConversation, updateConversationMetadata } from '@/lib/conversations/store';

export const dynamic = 'force-dynamic';

// GET /api/conversations/{id}
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    const conversation = await loadConversation(id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (err) {
    console.error('[API] GET /api/conversations/[id] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load conversation' },
      { status: 500 },
    );
  }
}

// PUT /api/conversations/{id}
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    const body = await request.json();
    const updates: { title?: string; tags?: string[] } = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.tags !== undefined) updates.tags = body.tags;

    const success = await updateConversationMetadata(id, updates);
    if (!success) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] PUT /api/conversations/[id] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update conversation' },
      { status: 500 },
    );
  }
}
