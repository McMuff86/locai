import { NextRequest, NextResponse } from 'next/server';
import { assertLocalRequest } from '@/app/api/_utils/security';
import { saveUploadedFile } from '@/lib/filebrowser/scanner';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB per file

export async function POST(req: NextRequest) {
  const forbidden = assertLocalRequest(req);
  if (forbidden) return forbidden;

  try {
    const formData = await req.formData();
    const rootIdValue = formData.get('rootId');
    const pathValue = formData.get('path');

    const rootId = typeof rootIdValue === 'string' ? rootIdValue : '';
    const targetPath = typeof pathValue === 'string' ? pathValue : '';

    const files = formData.getAll('files').filter((item): item is File => item instanceof File);

    if (!rootId || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'rootId und mindestens eine Datei sind erforderlich' },
        { status: 400 },
      );
    }

    const uploaded = [] as Array<{ name: string; relativePath: string }>;
    const rejected = [] as Array<{ name: string; reason: string }>;

    for (const file of files) {
      if (!file.name) {
        rejected.push({ name: '(ohne Name)', reason: 'Dateiname fehlt' });
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push({ name: file.name, reason: `Datei zu groß (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)` });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      try {
        const entry = await saveUploadedFile(rootId, targetPath, file.name, buffer);
        uploaded.push({ name: entry.name, relativePath: entry.relativePath });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload fehlgeschlagen';
        rejected.push({ name: file.name, reason: message });
      }
    }

    return NextResponse.json({
      success: uploaded.length > 0,
      uploaded,
      rejected,
      total: files.length,
    });
  } catch (err) {
    console.error('[FileBrowser] Upload error:', err);
    const message = err instanceof Error ? err.message : 'Fehler beim Upload';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
