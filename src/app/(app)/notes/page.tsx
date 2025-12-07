"use client";

import React from 'react';
import { NotesPanel } from '@/components/notes/NotesPanel';
import { useSettings } from '@/hooks/useSettings';
import { useModels } from '@/hooks/useModels';
import { FolderOpen, FileText, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotesPage() {
  const { settings } = useSettings();
  const { models, selectedModel } = useModels();

  // If no notes path is configured, show setup message
  if (!settings?.notesPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-muted/30 rounded-full p-6 mb-6">
          <FileText className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Notizen</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Um Notizen zu nutzen, konfiguriere bitte zuerst den Notizen-Pfad in den Einstellungen.
        </p>
        <Link href="/settings">
          <Button className="gap-2">
            <Settings className="h-4 w-4" />
            Einstellungen öffnen
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
          <FolderOpen className="h-4 w-4" />
          <span>Einstellungen → Notizen → Notizen Pfad</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <NotesPanel
        basePath={settings.notesPath}
        defaultModel={selectedModel}
        installedModels={models.map(m => m.name)}
      />
    </div>
  );
}

