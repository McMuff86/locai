// ============================================================================
// Conversations API Route
// ============================================================================
// GET  → list index (ConversationSummary[])
// POST → save a full conversation
// DELETE → delete one or clear all
// ============================================================================

import { NextRequest } from 'next/server';
import {
  loadIndex,
  saveConversation,
  deleteConversation,
  clearAllConversations,
} from '@/lib/conversations/store';
import { apiError, apiSuccess } from '../_utils/responses';

export const dynamic = 'force-dynamic';

// GET /api/conversations — list conversation summaries
export async function GET() {
  try {
    const conversations = await loadIndex();
    return apiSuccess({ conversations });
  } catch (err) {
    console.error('[API] GET /api/conversations error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load conversations', 500);
  }
}

// POST /api/conversations — save a conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation } = body;

    if (!conversation?.id) {
      return apiError('Conversation with id is required', 400);
    }

    await saveConversation(conversation);
    return apiSuccess({ id: conversation.id });
  } catch (err) {
    console.error('[API] POST /api/conversations error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to save conversation', 500);
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
      return apiSuccess();
    }

    if (!id) {
      return apiError('id or all=true parameter required', 400);
    }

    const deleted = await deleteConversation(id);
    if (!deleted) {
      return apiError('Conversation not found', 404);
    }

    return apiSuccess();
  } catch (err) {
    console.error('[API] DELETE /api/conversations error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to delete conversation', 500);
  }
}
