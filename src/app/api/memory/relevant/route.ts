// ============================================================================
// Memory Relevant API Route
// ============================================================================
// GET /api/memory/relevant?message=... → context-based relevant memories
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getRelevantMemories } from '@/lib/memory/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const message = searchParams.get('message');
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 10, 50) : 10;

    if (!message) {
      return NextResponse.json({ error: 'message parameter required' }, { status: 400 });
    }

    const memories = await getRelevantMemories(message, limit);
    return NextResponse.json({ memories });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get relevant memories' },
      { status: 500 },
    );
  }
}
