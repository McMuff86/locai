import { NextResponse } from 'next/server';
import archiver from 'archiver';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';

const LOCAI_DIR = path.join(os.homedir(), '.locai');

function countFiles(dir: string): number {
  let count = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

export async function GET() {
  try {
    if (!fs.existsSync(LOCAI_DIR)) {
      return NextResponse.json(
        { success: false, error: 'Kein .locai Verzeichnis gefunden' },
        { status: 404 }
      );
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = `locai-backup-${date}.zip`;
    const fileCount = countFiles(LOCAI_DIR);

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });

    // Add manifest
    const manifest = {
      version: '1.0',
      locaiVersion: '0.1.0',
      date: new Date().toISOString(),
      fileCount,
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Add all files from ~/.locai/
    archive.directory(LOCAI_DIR, 'data');

    await archive.finalize();
    const buffer = await done;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('Backup export error:', error);
    return NextResponse.json(
      { success: false, error: 'Backup-Export fehlgeschlagen' },
      { status: 500 }
    );
  }
}
