"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Files, FolderTree } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DocumentManager } from '@/components/documents/DocumentManager';
import { FileBrowser } from '@/components/filebrowser';
import { FileCanvas } from '@/components/filebrowser/FileCanvas';
import { useFileCanvas } from '@/hooks/useFileCanvas';
import type { FileEntry } from '@/lib/filebrowser/types';

const SIDEBAR_MIN = 280;
const SIDEBAR_MAX = 700;
const SIDEBAR_DEFAULT = 380;
const SIDEBAR_STORAGE_KEY = 'filebrowser-sidebar-width';

export default function DocumentsPage() {
  const canvas = useFileCanvas();

  // ── Resizable sidebar state ──────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT;
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= SIDEBAR_MIN && parsed <= SIDEBAR_MAX) return parsed;
    }
    return SIDEBAR_DEFAULT;
  });
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(SIDEBAR_DEFAULT);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidthRef.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Persist width
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const handleOpenFile = (entry: FileEntry) => {
    canvas.openFile(entry, entry.rootId);
  };

  return (
    <div className="flex flex-col h-full p-3 md:p-4 gap-3">
      <Tabs defaultValue="filebrowser" className="flex flex-col h-full gap-3">
        <TabsList className="flex-shrink-0 h-10 p-1 bg-muted/40 border border-border/30 rounded-lg">
          <TabsTrigger value="filebrowser" className="gap-1.5 data-[state=active]:shadow-sm">
            <FolderTree className="h-4 w-4" />
            Dateibrowser
          </TabsTrigger>
          <TabsTrigger value="rag" className="gap-1.5 data-[state=active]:shadow-sm">
            <Files className="h-4 w-4" />
            RAG Dokumente
          </TabsTrigger>
        </TabsList>

        {/* ── Filebrowser + Canvas ─────────────────────────────── */}
        <TabsContent value="filebrowser" className="flex-1 min-h-0 mt-0">
          <div className="flex h-full">
            {/* Left sidebar: FileBrowser (resizable) */}
            <div
              className="flex-shrink-0 overflow-y-auto overflow-x-hidden rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm shadow-sm p-3"
              style={{ width: sidebarWidth }}
            >
              <FileBrowser onOpenFile={handleOpenFile} />
            </div>

            {/* Resize handle */}
            <div
              className="flex-shrink-0 w-3 flex items-center justify-center cursor-col-resize group hover:bg-primary/5 transition-colors relative"
              onMouseDown={handleResizeStart}
              title="Breite anpassen"
            >
              <div className="w-0.5 h-8 rounded-full bg-border/50 group-hover:bg-primary/40 group-hover:h-12 transition-all" />
            </div>

            {/* Right: File Canvas */}
            <div className="flex-1 min-w-0 rounded-xl overflow-hidden border border-border/40 shadow-sm">
              <FileCanvas
                windows={canvas.windows}
                transform={canvas.transform}
                onTransformChange={canvas.updateTransform}
                onCloseWindow={canvas.closeWindow}
                onBringToFront={canvas.bringToFront}
                onUpdatePosition={canvas.updatePosition}
                onUpdateSize={canvas.updateSize}
                onToggleMinimize={canvas.toggleMinimize}
              />
            </div>
          </div>
        </TabsContent>

        {/* ── RAG Documents ────────────────────────────────────── */}
        <TabsContent value="rag" className="flex-1 min-h-0 mt-0">
          <DocumentManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
