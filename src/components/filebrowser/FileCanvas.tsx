"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Files } from 'lucide-react';
import type { CanvasWindow, CanvasTransform } from '@/hooks/useFileCanvas';
import { FileWindow } from './FileWindow';

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4.0;
// Dots grid spacing in world units
const GRID_SPACING = 30;

// ── Props ─────────────────────────────────────────────────────────────────────

interface FileCanvasProps {
  windows: CanvasWindow[];
  transform: CanvasTransform;
  onTransformChange: (t: CanvasTransform) => void;
  onCloseWindow: (id: string) => void;
  onBringToFront: (id: string) => void;
  onUpdatePosition: (id: string, position: { x: number; y: number }) => void;
  onUpdateSize: (id: string, size: { w: number; h: number }) => void;
  onToggleMinimize: (id: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FileCanvas({
  windows,
  transform,
  onTransformChange,
  onCloseWindow,
  onBringToFront,
  onUpdatePosition,
  onUpdateSize,
  onToggleMinimize,
}: FileCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  // Ref shadow of transform so document-level handlers always see current values
  const transformRef = useRef(transform);
  useEffect(() => { transformRef.current = transform; }, [transform]);

  // ── Pan state ──────────────────────────────────────────────────
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);

  // ── Non-passive wheel listener for zoom ──────────────────────────
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const { x, y, zoom } = transformRef.current;

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Determine zoom delta – support trackpad pinch (ctrlKey) and wheel
      const rawDelta = e.deltaY;
      const zoomFactor = e.ctrlKey
        ? 1 - rawDelta * 0.01          // Pinch gesture (ctrlKey = true on trackpads)
        : 1 - rawDelta * 0.001;        // Normal wheel

      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * zoomFactor));

      // Zoom-to-cursor: keep the point under the cursor fixed
      const newX = mouseX - (mouseX - x) * (newZoom / zoom);
      const newY = mouseY - (mouseY - y) * (newZoom / zoom);

      onTransformChange({ x: newX, y: newY, zoom: newZoom });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [onTransformChange]);

  // ── Document-level pan listeners ─────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      const { zoom } = transformRef.current;
      onTransformChange({
        zoom,
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsDraggingCanvas(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onTransformChange]);

  // ── Viewport mousedown: start pan (only on canvas background) ────
  const handleViewportMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only react if the direct click target is the viewport or world div
      // (FileWindows call e.stopPropagation so their clicks don't bubble here)
      if (
        e.target !== viewportRef.current &&
        e.target !== worldRef.current
      ) {
        return;
      }
      if (e.button !== 0 && e.button !== 1) return;
      e.preventDefault();

      isPanningRef.current = true;
      setIsDraggingCanvas(true);
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: transform.x,
        panY: transform.y,
      };
    },
    [transform.x, transform.y],
  );

  // ── Computed grid ─────────────────────────────────────────────────
  const { x: panX, y: panY, zoom } = transform;
  const scaledSpacing = GRID_SPACING * zoom;
  // Offset wraps so the grid tiles repeat seamlessly
  const bgOffsetX = ((panX % scaledSpacing) + scaledSpacing) % scaledSpacing;
  const bgOffsetY = ((panY % scaledSpacing) + scaledSpacing) % scaledSpacing;

  return (
    <div
      ref={viewportRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        background: 'hsl(var(--background))',
        backgroundImage: `radial-gradient(circle, rgba(128,128,128,0.15) 1px, transparent 1px)`,
        backgroundSize: `${scaledSpacing}px ${scaledSpacing}px`,
        backgroundPosition: `${bgOffsetX}px ${bgOffsetY}px`,
        cursor: isDraggingCanvas ? 'grabbing' : 'default',
      }}
      onMouseDown={handleViewportMouseDown}
    >
      {/* ── World (transformed) ─────────────────────────────────── */}
      <div
        ref={worldRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {windows.map((win) => (
          <FileWindow
            key={win.id}
            window={win}
            zoom={zoom}
            onClose={() => onCloseWindow(win.id)}
            onBringToFront={() => onBringToFront(win.id)}
            onUpdatePosition={(pos) => onUpdatePosition(win.id, pos)}
            onUpdateSize={(size) => onUpdateSize(win.id, size)}
            onToggleMinimize={() => onToggleMinimize(win.id)}
          />
        ))}
      </div>

      {/* ── Empty state ──────────────────────────────────────────── */}
      {windows.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="rounded-2xl p-4 bg-muted/30 border border-border/20">
                <Files className="h-10 w-10 text-muted-foreground/30" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground/40">
                Canvas ist leer
              </p>
              <p className="text-xs text-muted-foreground/30">
                Klicke auf eine Datei im Browser, um sie hier zu öffnen
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Controls overlay ─────────────────────────────────────── */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 pointer-events-auto">
        <button
          className="text-[10px] text-muted-foreground/50 font-mono bg-background/70 backdrop-blur-sm px-2 py-1 rounded-lg border border-border/30 hover:text-muted-foreground/80 hover:bg-background/90 transition-colors"
          onClick={() => onTransformChange({ x: 0, y: 0, zoom: 1 })}
          title="Ansicht zurücksetzen"
        >
          Reset
        </button>
        <span className="text-[10px] text-muted-foreground/50 font-mono bg-background/70 backdrop-blur-sm px-2 py-1 rounded-lg border border-border/30">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
