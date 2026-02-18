"use client";

import React from 'react';
import { FolderTree, Files } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DocumentManager } from '@/components/documents/DocumentManager';
import { FileBrowser } from '@/components/filebrowser';

export default function DocumentsPage() {
  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      <Tabs defaultValue="filebrowser" className="flex flex-col h-full">
        <TabsList className="flex-shrink-0 mb-4">
          <TabsTrigger value="filebrowser">
            <FolderTree className="h-4 w-4" />
            Dateibrowser
          </TabsTrigger>
          <TabsTrigger value="rag">
            <Files className="h-4 w-4" />
            RAG Dokumente
          </TabsTrigger>
        </TabsList>
        <TabsContent value="filebrowser" className="flex-1 min-h-0">
          <FileBrowser />
        </TabsContent>
        <TabsContent value="rag" className="flex-1 min-h-0">
          <DocumentManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
