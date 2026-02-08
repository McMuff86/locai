// ============================================================================
// Conversation Search API Route
// ============================================================================
// GET /api/conversations/search?q=query&limit=20
// Full-text search through message content across all conversations.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { loadIndex, loadConversation } from '@/lib/conversations/store';
import { MessageContent } from '@/types/chat';

export const dynamic = 'force-dynamic';

interface SearchMatch {
  role: 'user' | 'assistant';
  excerpt: string;
}

interface SearchResultItem {
  conversationId: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  matches: SearchMatch[];
}

/** Extract plain text from MessageContent */
function extractText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((item): item is string => typeof item === 'string')
      .join(' ');
  }
  return '';
}

/** Build a short excerpt around the first match */
function buildExcerpt(text: string, query: string, maxLen = 120): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen);

  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);
  let excerpt = text.slice(start, end).trim();
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';
  return excerpt;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const queryLower = query.toLowerCase();
    const index = await loadIndex();
    const results: SearchResultItem[] = [];

    for (const summary of index) {
      if (results.length >= limit) break;

      const conversation = await loadConversation(summary.id);
      if (!conversation) continue;

      const matches: SearchMatch[] = [];

      for (const msg of conversation.messages) {
        if (msg.role === 'system') continue;

        const text = extractText(msg.content);
        if (text.toLowerCase().includes(queryLower)) {
          matches.push({
            role: msg.role as 'user' | 'assistant',
            excerpt: buildExcerpt(text, query),
          });
          if (matches.length >= 3) break; // Max 3 matches per conversation
        }
      }

      if (matches.length > 0) {
        results.push({
          conversationId: summary.id,
          title: summary.title,
          updatedAt: summary.updatedAt,
          messageCount: summary.messageCount,
          matches,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[API] GET /api/conversations/search error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 },
    );
  }
}
