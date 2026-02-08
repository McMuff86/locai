import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getGalleryMedia,
  invalidateGalleryCache,
  shutdownGalleryCache,
} from './galleryCache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'galleryCache-test-'));
}

function touch(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '');
}

function rmrf(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('galleryCache', () => {
  let tmpDir: string | null = null;

  afterEach(async () => {
    await shutdownGalleryCache();
    if (tmpDir) {
      rmrf(tmpDir);
      tmpDir = null;
    }
  });

  it('returns empty array when directory does not exist', async () => {
    const result = await getGalleryMedia('/tmp/non-existent-gallery-dir-abc123');
    expect(result).toEqual([]);
  });

  it('scans directory and returns image files', async () => {
    tmpDir = makeTmpDir();
    touch(path.join(tmpDir, 'photo.png'));
    touch(path.join(tmpDir, 'pic.jpg'));
    touch(path.join(tmpDir, 'render.webp'));

    const result = await getGalleryMedia(tmpDir);

    expect(result).toHaveLength(3);
    const filenames = result.map((m) => m.filename).sort();
    expect(filenames).toEqual(['photo.png', 'pic.jpg', 'render.webp']);
    // All should be typed as image
    expect(result.every((m) => m.type === 'image')).toBe(true);
  });

  it('returns cached results on second call (no re-scan)', async () => {
    tmpDir = makeTmpDir();
    touch(path.join(tmpDir, 'a.png'));

    const first = await getGalleryMedia(tmpDir);
    expect(first).toHaveLength(1);

    // Spy on readdirSync to verify no re-scan happens
    const spy = vi.spyOn(fs, 'readdirSync');

    const second = await getGalleryMedia(tmpDir);
    expect(spy).not.toHaveBeenCalled();
    expect(second).toHaveLength(1);
    expect(second).toStrictEqual(first);

    spy.mockRestore();
  });

  it('invalidateGalleryCache() forces a re-scan on next call', async () => {
    tmpDir = makeTmpDir();
    touch(path.join(tmpDir, 'a.png'));

    const first = await getGalleryMedia(tmpDir);
    expect(first).toHaveLength(1);

    // Add file and invalidate
    touch(path.join(tmpDir, 'b.png'));
    invalidateGalleryCache(tmpDir);

    const second = await getGalleryMedia(tmpDir);
    expect(second).toHaveLength(2);
  });

  it('shutdownGalleryCache() clears cache completely', async () => {
    tmpDir = makeTmpDir();
    touch(path.join(tmpDir, 'a.png'));

    await getGalleryMedia(tmpDir);
    await shutdownGalleryCache();

    // After shutdown + adding a new file, a fresh scan should happen
    touch(path.join(tmpDir, 'b.png'));
    const result = await getGalleryMedia(tmpDir);
    expect(result).toHaveLength(2);
  });

  it('recognises all supported image extensions (.png, .jpg, .jpeg, .webp, .gif)', async () => {
    tmpDir = makeTmpDir();
    const exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    for (const ext of exts) {
      touch(path.join(tmpDir, `file${ext}`));
    }

    const result = await getGalleryMedia(tmpDir);
    expect(result).toHaveLength(exts.length);

    const returnedExts = result.map((m) => path.extname(m.filename)).sort();
    expect(returnedExts).toEqual(exts.sort());
  });

  it('ignores non-image files (.txt, .md)', async () => {
    tmpDir = makeTmpDir();
    touch(path.join(tmpDir, 'readme.txt'));
    touch(path.join(tmpDir, 'notes.md'));
    touch(path.join(tmpDir, 'photo.png'));

    const result = await getGalleryMedia(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('photo.png');
  });

  it('returns correct MediaInfo fields', async () => {
    tmpDir = makeTmpDir();
    touch(path.join(tmpDir, 'test.png'));

    const result = await getGalleryMedia(tmpDir);
    expect(result).toHaveLength(1);

    const media = result[0];
    expect(media.id).toBeDefined();
    expect(media.filename).toBe('test.png');
    expect(media.path).toBe('test.png');
    expect(typeof media.size).toBe('number');
    expect(media.createdAt).toBeDefined();
    expect(media.modifiedAt).toBeDefined();
    expect(media.type).toBe('image');
  });

  it('scans subdirectories recursively', async () => {
    tmpDir = makeTmpDir();
    touch(path.join(tmpDir, 'root.png'));
    touch(path.join(tmpDir, 'sub', 'nested.jpg'));
    touch(path.join(tmpDir, 'sub', 'deep', 'deep.webp'));

    const result = await getGalleryMedia(tmpDir);
    expect(result).toHaveLength(3);

    const paths = result.map((m) => m.path).sort();
    expect(paths).toEqual(['root.png', 'sub/deep/deep.webp', 'sub/nested.jpg']);
  });
});
