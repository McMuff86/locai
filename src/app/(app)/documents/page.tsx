"use client";

import React from 'react';
import { Files, FolderTree } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DocumentManager } from '@/components/documents/DocumentManager';
import { FileBrowser } from '@/components/filebrowser';
import { FileCanvas } from '@/components/filebrowser/FileCanvas';
import { useFileCanvas } from '@/hooks/useFileCanvas';
import type { FileEntry } from '@/lib/filebrowser/types';

export default function DocumentsPage() {
  const canvas = useFileCanvas();

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
          <div className="flex h-full gap-3">
            {/* Left sidebar: FileBrowser */}
            <div className="w-80 flex-shrink-0 overflow-y-auto overflow-x-hidden rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm shadow-sm p-3">
              <FileBrowser onOpenFile={handleOpenFile} />
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
