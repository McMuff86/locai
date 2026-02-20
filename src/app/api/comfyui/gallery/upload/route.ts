import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sanitizeBasePath } from '../../../_utils/security';
import { invalidateGalleryCache } from '@/lib/galleryCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB per file
const ALLOWED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg',
  '.mp4', '.webm', '.mov', '.mkv',
]);

function safeFilename(name: string) {
  const base = path.basename(name).trim();
  if (!base) return null;
  if (base.includes('\0') || base === '.' || base === '..') return null;
  return base;
}

function ensureUniquePath(targetDir: string, filename: string): string {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  let candidate = path.join(targetDir, filename);
  let counter = 1;

  while (fs.existsSync(candidate) && counter < 10000) {
    candidate = path.join(targetDir, `${base} (${counter})${ext}`);
    counter += 1;
  }

  return candidate;
}

export async function POST(req: NextRequest) {

  try {
    const formData = await req.formData();

    const outputPathValue = formData.get('outputPath');
    const comfyUIPathValue = formData.get('comfyUIPath');

    const outputPath = typeof outputPathValue === 'string' ? outputPathValue : '';
    const comfyUIPath = typeof comfyUIPathValue === 'string' ? comfyUIPathValue : '';

    let finalOutputPath = outputPath;
    if (!finalOutputPath && comfyUIPath) {
      finalOutputPath = path.join(comfyUIPath, 'ComfyUI', 'output');
    }

    if (!finalOutputPath) {
      return NextResponse.json(
        { success: false, error: 'Output path not provided' },
        { status: 400 },
      );
    }

    const safeOutputPath = sanitizeBasePath(finalOutputPath);
    if (!safeOutputPath) {
      return NextResponse.json(
        { success: false, error: 'Invalid output path' },
        { status: 400 },
      );
    }

    if (!fs.existsSync(safeOutputPath)) {
      fs.mkdirSync(safeOutputPath, { recursive: true });
    }

    const files = formData.getAll('files').filter((item): item is File => item instanceof File);
    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 },
      );
    }

    const uploaded = [] as Array<{ filename: string; relativePath: string }>;
    const rejected = [] as Array<{ filename: string; reason: string }>;

    for (const file of files) {
      const filename = safeFilename(file.name);
      if (!filename) {
        rejected.push({ filename: file.name || '(unknown)', reason: 'Invalid filename' });
        continue;
      }

      const ext = path.extname(filename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        rejected.push({ filename, reason: 'Unsupported file type' });
        continue;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push({ filename, reason: 'File exceeds 50MB limit' });
        continue;
      }

      const targetPath = ensureUniquePath(safeOutputPath, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(targetPath, buffer);

      uploaded.push({
        filename: path.basename(targetPath),
        relativePath: path.relative(safeOutputPath, targetPath).replace(/\\/g, '/'),
      });
    }

    if (uploaded.length > 0) {
      invalidateGalleryCache(safeOutputPath);
    }

    return NextResponse.json({
      success: uploaded.length > 0,
      uploaded,
      rejected,
      total: files.length,
    });
  } catch (error) {
    console.error('Gallery upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload media' },
      { status: 500 },
    );
  }
}
