import { NextResponse } from 'next/server';

/**
 * ARCH-1: Unified API error response.
 * Always returns `{ success: false, error: string, ...details }` with the given HTTP status.
 */
export function apiError(message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error: message, ...details }, { status });
}

/**
 * ARCH-1: Unified API success response.
 * Always returns `{ success: true, ...data }` with HTTP 200.
 */
export function apiSuccess(data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: true, ...data });
}
