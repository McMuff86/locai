import { NextRequest, NextResponse } from 'next/server';
import { getFlowHistory } from '@/lib/flow/history';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Flow ID required' }, { status: 400 });
  }

  const history = await getFlowHistory(id);
  return NextResponse.json({ flowId: id, runs: history });
}
