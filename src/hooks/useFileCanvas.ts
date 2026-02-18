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
  // Use a ref for zIndex counter so it never causes extra re-renders
  const zIndexCounterRef = useRef(1);

  const nextZIndex = useCallback(() => {
    zIndexCounterRef.current += 1;
    return zIndexCounterRef.current;
  }, []);

  const openFile = useCallback(
    (file: FileEntry, rootId: string) => {
      // If this file is already open, bring it to front and un-minimize
      const existing = windows.find(
        (w) => w.file.relativePath === file.relativePath && w.rootId === rootId,
      );

      if (existing) {
        const newZ = nextZIndex();
        setWindows((ws) =>
          ws.map((w) =>
            w.id === existing.id ? { ...w, zIndex: newZ, isMinimized: false } : w,
          ),
        );
        return;
      }

      // Cascade position: cycle through 10 positions
      const cascadeIndex = windows.length % 10;
      const position = {
        x: 20 + cascadeIndex * CASCADE_OFFSET,
        y: 20 + cascadeIndex * CASCADE_OFFSET,
      };

      const newWindow: CanvasWindow = {
        id: uuid(),
        file,
        rootId,
        position,
        size: { ...DEFAULT_WINDOW_SIZE },
        zIndex: nextZIndex(),
        isMinimized: false,
      };
      setWindows((ws) => [...ws, newWindow]);
    },
    [windows, nextZIndex],
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((ws) => ws.filter((w) => w.id !== id));
  }, []);

  const bringToFront = useCallback((id: string) => {
    const newZ = nextZIndex();
    setWindows((ws) =>
      ws.map((w) => (w.id === id ? { ...w, zIndex: newZ } : w)),
    );
  }, [nextZIndex]);

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
