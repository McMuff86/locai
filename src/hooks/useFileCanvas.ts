"use client";

import { useCallback, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { FileEntry } from '@/lib/filebrowser/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CanvasWindow {
  id: string;
  file: FileEntry;
  rootId: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  zIndex: number;
  isMinimized: boolean;
}

export interface CanvasTransform {
  x: number;
  y: number;
  zoom: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_WINDOW_SIZE = { w: 500, h: 400 };
const IMAGE_WINDOW_SIZE = { w: 700, h: 500 };
const PDF_WINDOW_SIZE = { w: 800, h: 600 };
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];
const PDF_EXTENSIONS = ['.pdf'];
export const MIN_WINDOW_SIZE = { w: 300, h: 200 };
const INITIAL_ZOOM = 1;
const CASCADE_OFFSET = 30;

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseFileCanvasReturn {
  windows: CanvasWindow[];
  transform: CanvasTransform;
  openFile: (file: FileEntry, rootId: string) => void;
  closeWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  updatePosition: (id: string, position: { x: number; y: number }) => void;
  updateSize: (id: string, size: { w: number; h: number }) => void;
  toggleMinimize: (id: string) => void;
  updateTransform: (transform: CanvasTransform) => void;
}

export function useFileCanvas(): UseFileCanvasReturn {
  const [windows, setWindows] = useState<CanvasWindow[]>([]);
  const [transform, setTransform] = useState<CanvasTransform>({
    x: 0,
    y: 0,
    zoom: INITIAL_ZOOM,
  });

  // ── zIndex counter via ref (no extra re-renders, no stale state) ─
  const zIndexCounterRef = useRef(1);
  const nextZIndex = useCallback(() => {
    zIndexCounterRef.current += 1;
    return zIndexCounterRef.current;
  }, []);

  // ── openFile ─────────────────────────────────────────────────────
  // BUG FIX: Deduplication check is now INSIDE the functional updater
  // so it always sees the LATEST windows state, not a stale closure.
  // This prevents double-open on rapid clicks / double-click.
  const openFile = useCallback(
    (file: FileEntry, rootId: string) => {
      // Pre-compute side-effectful values before the updater runs
      const newZ = nextZIndex();
      const newId = uuid();

      setWindows((currentWindows) => {
        // Always operates on latest state → no duplicate windows
        const existing = currentWindows.find(
          (w) => w.file.relativePath === file.relativePath && w.rootId === rootId,
        );

        if (existing) {
          // Already open → bring to front + un-minimize
          return currentWindows.map((w) =>
            w.id === existing.id ? { ...w, zIndex: newZ, isMinimized: false } : w,
          );
        }

        // Cascade position: cycle through 10 positions
        const cascadeIndex = currentWindows.length % 10;
        const position = {
          x: 20 + cascadeIndex * CASCADE_OFFSET,
          y: 20 + cascadeIndex * CASCADE_OFFSET,
        };

        const newWindow: CanvasWindow = {
          id: newId,
          file,
          rootId,
          position,
          size: IMAGE_EXTENSIONS.includes(file.extension?.toLowerCase() ?? '') ? { ...IMAGE_WINDOW_SIZE }
              : PDF_EXTENSIONS.includes(file.extension?.toLowerCase() ?? '') ? { ...PDF_WINDOW_SIZE }
              : { ...DEFAULT_WINDOW_SIZE },
          zIndex: newZ,
          isMinimized: false,
        };
        return [...currentWindows, newWindow];
      });
    },
    [nextZIndex],
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((ws) => ws.filter((w) => w.id !== id));
  }, []);

  const bringToFront = useCallback(
    (id: string) => {
      const newZ = nextZIndex();
      setWindows((ws) =>
        ws.map((w) => (w.id === id ? { ...w, zIndex: newZ } : w)),
      );
    },
    [nextZIndex],
  );

  const updatePosition = useCallback(
    (id: string, position: { x: number; y: number }) => {
      setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, position } : w)));
    },
    [],
  );

  const updateSize = useCallback((id: string, size: { w: number; h: number }) => {
    const clamped = {
      w: Math.max(MIN_WINDOW_SIZE.w, size.w),
      h: Math.max(MIN_WINDOW_SIZE.h, size.h),
    };
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, size: clamped } : w)));
  }, []);

  const toggleMinimize = useCallback((id: string) => {
    setWindows((ws) =>
      ws.map((w) => (w.id === id ? { ...w, isMinimized: !w.isMinimized } : w)),
    );
  }, []);

  const updateTransform = useCallback((newTransform: CanvasTransform) => {
    setTransform(newTransform);
  }, []);

  return {
    windows,
    transform,
    openFile,
    closeWindow,
    bringToFront,
    updatePosition,
    updateSize,
    toggleMinimize,
    updateTransform,
  };
}
