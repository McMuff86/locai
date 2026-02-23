import { NextRequest, NextResponse } from 'next/server';
import { getFlowRun, deleteFlowRun } from '@/lib/flow/history';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  if (!runId) {
    return NextResponse.json({ error: 'Run ID required' }, { status: 400 });
  }

  const run = await getFlowRun(runId);
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  return NextResponse.json(run);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  if (!runId) {
    return NextResponse.json({ error: 'Run ID required' }, { status: 400 });
  }

  const deleted = await deleteFlowRun(runId);
  if (!deleted) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
