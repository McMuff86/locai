import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '../../../_utils/responses';
import {
  completeRunLedgerEntry,
  getRunLedgerEntry,
} from '@/lib/workspace/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const run = await getRunLedgerEntry(id);
    if (!run) return apiError('Run ledger entry not found', 404);
    return apiSuccess({ run });
  } catch (err) {
    console.error('[API] GET /api/workspace/runs/[id] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load run ledger entry', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const run = await completeRunLedgerEntry(id, body);
    if (!run) return apiError('Run ledger entry not found', 404);
    return apiSuccess({ run });
  } catch (err) {
    console.error('[API] PATCH /api/workspace/runs/[id] error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to update run ledger entry', 400);
  }
}
