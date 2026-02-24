import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';

const LOCAI_DIR = path.join(os.homedir(), '.locai');
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB

interface Manifest {
  version: string;
  locaiVersion: string;
  date: string;
  fileCount: number;
}

/** Create a pre-import backup of current data */
async function createPreImportBackup(): Promise<string | null> {
  if (!fs.existsSync(LOCAI_DIR)) return null;

  const backupDir = path.join(os.tmpdir(), 'locai-pre-import-backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `pre-import-${timestamp}.zip`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  const output = fs.createWriteStream(backupPath);

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(backupPath));
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(LOCAI_DIR, 'data');
    archive.finalize();
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Keine ZIP-Datei hochgeladen' },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Datei zu gross (max. 500MB)' },
        { status: 400 }
      );
    }

    // Read ZIP into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Ungültige ZIP-Datei' },
        { status: 400 }
      );
    }

    // Validate manifest
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
      return NextResponse.json(
        { success: false, error: 'Kein manifest.json in der ZIP-Datei gefunden. Ungültiges Backup.' },
        { status: 400 }
      );
    }

    let manifest: Manifest;
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    } catch {
      return NextResponse.json(
        { success: false, error: 'manifest.json ist ungültig' },
        { status: 400 }
      );
    }

    // Version compatibility check
    const supportedVersions = ['1.0'];
    if (!supportedVersions.includes(manifest.version)) {
      return NextResponse.json(
        {
          success: false,
          error: `Inkompatible Backup-Version: ${manifest.version}. Unterstützt: ${supportedVersions.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Create pre-import backup
    const preImportBackup = await createPreImportBackup();

    // Extract files
    const entries = zip.getEntries();
    let restoredCount = 0;
    const restoredFiles: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory || entry.entryName === 'manifest.json') continue;

      // Files are stored under data/ prefix
      if (!entry.entryName.startsWith('data/')) continue;

      const relativePath = entry.entryName.slice('data/'.length);
      if (!relativePath) continue;

      // Security: prevent path traversal
      const targetPath = path.join(LOCAI_DIR, relativePath);
      const resolved = path.resolve(targetPath);
      if (!resolved.startsWith(path.resolve(LOCAI_DIR))) continue;

      // Ensure directory exists
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, entry.getData());
      restoredFiles.push(relativePath);
      restoredCount++;
    }

    // Save last import date
    const metaDir = path.join(LOCAI_DIR, '.backup-meta');
    fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(
      path.join(metaDir, 'last-import.json'),
      JSON.stringify({
        date: new Date().toISOString(),
        manifestDate: manifest.date,
        fileCount: restoredCount,
        preImportBackup,
      }, null, 2)
    );

    return NextResponse.json({
      success: true,
      restoredCount,
      restoredFiles: restoredFiles.slice(0, 50), // limit response size
      totalFiles: restoredFiles.length,
      backupDate: manifest.date,
      preImportBackup: preImportBackup ? 'erstellt' : 'nicht nötig (kein bestehendes Verzeichnis)',
    });
  } catch (error) {
    console.error('Backup import error:', error);
    return NextResponse.json(
      { success: false, error: 'Backup-Import fehlgeschlagen' },
      { status: 500 }
    );
  }
}
