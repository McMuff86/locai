// ============================================================================
// Conversations API Route
// ============================================================================
// GET  → list index (ConversationSummary[])
// POST → save a full conversation
// DELETE → delete one or clear all
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  loadIndex,
  saveConversation,
  deleteConversation,
  clearAllConversations,
} from '@/lib/conversations/store';

export const dynamic = 'force-dynamic';

// GET /api/conversations — list conversation summaries
export async function GET() {
  try {
    const conversations = await loadIndex();
    return NextResponse.json({ conversations });
  } catch (err) {
    console.error('[API] GET /api/conversations error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load conversations' },
      { status: 500 },
    );
  }
}

// POST /api/conversations — save a conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation } = body;

    if (!conversation?.id) {
      return NextResponse.json({ error: 'Conversation with id is required' }, { status: 400 });
    }

    await saveConversation(conversation);
    return NextResponse.json({ success: true, id: conversation.id });
  } catch (err) {
    console.error('[API] POST /api/conversations error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save conversation' },
      { status: 500 },
    );
  }
}

// DELETE /api/conversations?id={id} or DELETE /api/conversations?all=true
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all');

    if (all === 'true') {
      await clearAllConversations();
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: 'id or all=true parameter required' }, { status: 400 });
    }

    const deleted = await deleteConversation(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /api/conversations error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete conversation' },
      { status: 500 },
    );
  }
}
