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
    <div className="flex flex-col h-full p-4 md:p-6">
      <Tabs defaultValue="filebrowser" className="flex flex-col h-full">
        <TabsList className="flex-shrink-0 mb-4">
          <TabsTrigger value="filebrowser">
            <FolderTree className="h-4 w-4 mr-1.5" />
            Dateibrowser
          </TabsTrigger>
          <TabsTrigger value="rag">
            <Files className="h-4 w-4 mr-1.5" />
            RAG Dokumente
          </TabsTrigger>
        </TabsList>

        {/* ── Filebrowser + Canvas ─────────────────────────────── */}
        <TabsContent value="filebrowser" className="flex-1 min-h-0 mt-0">
          <div className="flex h-full gap-3">
            {/* Left sidebar: FileBrowser */}
            <div className="w-80 flex-shrink-0 overflow-y-auto overflow-x-hidden rounded-lg border border-border/60 p-3">
              <FileBrowser onOpenFile={handleOpenFile} />
            </div>

            {/* Right: File Canvas */}
            <div className="flex-1 min-w-0 rounded-lg overflow-hidden border border-border/60">
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
