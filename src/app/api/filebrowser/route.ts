import { NextResponse } from 'next/server';
import { getBrowseableRoots } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const roots = await getBrowseableRoots();
    return NextResponse.json({ success: true, roots });
  } catch (err) {
    console.error('[FileBrowser] Roots error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler beim Laden der Roots' },
      { status: 500 },
    );
  }
}
