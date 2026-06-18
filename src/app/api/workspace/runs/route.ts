import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '../../_utils/responses';
import {
  createRunLedgerEntry,
  listRunLedgerEntries,
} from '@/lib/workspace/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
    const artifactId = request.nextUrl.searchParams.get('artifactId') || undefined;
    const runs = await listRunLedgerEntries(projectId, artifactId);
    return apiSuccess({ runs, count: runs.length });
  } catch (err) {
    console.error('[API] GET /api/workspace/runs error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to load runs', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const run = await createRunLedgerEntry(body);
    return apiSuccess({ run });
  } catch (err) {
    console.error('[API] POST /api/workspace/runs error:', err);
    return apiError(err instanceof Error ? err.message : 'Failed to create run ledger entry', 400);
  }
}
