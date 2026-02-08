/**
 * PERF-1: In-memory gallery cache with chokidar file watcher.
 *
 * Singleton per watched directory. On first request the directory is scanned
 * and a chokidar watcher is attached. Subsequent requests serve from cache.
 * File-system changes invalidate the cache with a 500 ms debounce so that
 * burst writes (e.g. ComfyUI batch outputs) trigger only a single re-scan.
 *
 * Graceful degradation: if chokidar is unavailable the cache still works but
 * every request triggers a fresh scan (same behaviour as before).
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaInfo {
  id: string;
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  type: 'image' | 'video';
  dimensions?: { width: number; height: number };
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

const DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Singleton cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  media: MediaInfo[];
  /** Timestamp (epoch ms) of the last completed scan */
  scannedAt: number;
  /** chokidar FSWatcher instance – null when chokidar is unavailable */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watcher: any | null;
  /** Pending debounce timer */
  debounceTimer: ReturnType<typeof setTimeout> | null;
  /** True while a scan is in progress (prevents concurrent scans) */
  scanning: boolean;
}

/** directory → CacheEntry */
const cacheMap = new Map<string, CacheEntry>();

/** Lazy-loaded chokidar module (null = not yet tried, false = unavailable) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chokidarModule: any | null | false = null;

async function getChokidar() {
  if (chokidarModule === false) return null;
  if (chokidarModule) return chokidarModule;
  try {
    chokidarModule = await import('chokidar');
    return chokidarModule;
  } catch {
    console.warn('[GalleryCache] chokidar not available – falling back to direct scan');
    chokidarModule = false;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

function scanDirectory(dirPath: string): MediaInfo[] {
  const media: MediaInfo[] = [];

  function walk(currentPath: string, relativePath: string = '') {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return; // directory may have been removed
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          try {
            const stats = fs.statSync(fullPath);
            const isVideo = VIDEO_EXTENSIONS.includes(ext);

            media.push({
              id: Buffer.from(relPath).toString('base64url'),
              filename: entry.name,
              path: relPath,
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
              modifiedAt: stats.mtime.toISOString(),
              type: isVideo ? 'video' : 'image',
            });
          } catch {
            // skip unreadable files
          }
        }
      }
    }
  }

  walk(dirPath);
  return media;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the cached media list for `dirPath`, scanning on first call or after
 * invalidation. Attaches a chokidar watcher when available.
 */
export async function getGalleryMedia(dirPath: string): Promise<MediaInfo[]> {
  const resolved = path.resolve(dirPath);

  let entry = cacheMap.get(resolved);

  // First access – create entry, scan, and set up watcher
  if (!entry) {
    const media = scanDirectory(resolved);
    entry = {
      media,
      scannedAt: Date.now(),
      watcher: null,
      debounceTimer: null,
      scanning: false,
    };
    cacheMap.set(resolved, entry);

    // Set up watcher (async, fire-and-forget)
    setupWatcher(resolved, entry).catch(() => {
      /* watcher setup is best-effort */
    });

    return media;
  }

  // If the cache was invalidated (scannedAt === 0) or no watcher is active,
  // re-scan synchronously.
  if (entry.scannedAt === 0 || (!entry.watcher && !entry.scanning)) {
    entry.scanning = true;
    try {
      entry.media = scanDirectory(resolved);
      entry.scannedAt = Date.now();
    } finally {
      entry.scanning = false;
    }
  }

  return entry.media;
}

/**
 * Explicitly invalidate the cache for a directory (e.g. after a delete via API).
 */
export function invalidateGalleryCache(dirPath: string): void {
  const resolved = path.resolve(dirPath);
  const entry = cacheMap.get(resolved);
  if (entry) {
    entry.scannedAt = 0;
  }
}

/**
 * Shut down all watchers (useful for tests / hot-reload cleanup).
 */
export async function shutdownGalleryCache(): Promise<void> {
  for (const [, entry] of cacheMap) {
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    if (entry.watcher) {
      try {
        await entry.watcher.close();
      } catch {
        /* ignore */
      }
    }
  }
  cacheMap.clear();
}

// ---------------------------------------------------------------------------
// Watcher setup
// ---------------------------------------------------------------------------

async function setupWatcher(dirPath: string, entry: CacheEntry) {
  const chokidar = await getChokidar();
  if (!chokidar) return;

  // Build glob for supported extensions
  const extGlob = `**/*{${SUPPORTED_EXTENSIONS.join(',')}}`;

  const watcher = chokidar.watch(extGlob, {
    cwd: dirPath,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const invalidate = () => {
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = null;
      // Mark cache as stale; next request will re-scan
      entry.scannedAt = 0;
    }, DEBOUNCE_MS);
  };

  watcher
    .on('add', invalidate)
    .on('change', invalidate)
    .on('unlink', invalidate)
    .on('error', (err: Error) => {
      console.error('[GalleryCache] watcher error:', err.message);
    });

  entry.watcher = watcher;
}
