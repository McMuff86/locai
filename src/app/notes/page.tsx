"use client";

import { NotesPanel } from '@/components/notes/NotesPanel';
import useSettings from '@/hooks/useSettings';

export default function NotesPage() {
  const { settings } = useSettings();
  const basePath = settings.notesPath;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl w-full mx-auto px-3 md:px-4 space-y-4">
        <header className="border-b border-border py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Notizen</h1>
            <p className="text-sm text-muted-foreground">
              Lokale Notizen mit Links und 3D-Graph-Übersicht.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs md:text-sm text-muted-foreground text-right truncate">
              Pfad: {basePath || 'nicht gesetzt'}
            </div>
          </div>
        </header>

        <NotesPanel
          basePath={basePath}
          defaultModel={settings.notesEmbeddingModel}
          host={settings.ollamaHost}
          className="space-y-4"
        />
      </div>
    </div>
  );
}


