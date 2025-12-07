"use client";

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { NoteSummary } from './types';

interface NotesListProps {
  notes: NoteSummary[];
  selectedId: string | null;
  loading: boolean;
  isNoteLoading: boolean;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onRefresh: () => void;
}

export function NotesList({
  notes,
  selectedId,
  loading,
  isNoteLoading,
  onSelectNote,
  onNewNote,
  onRefresh,
}: NotesListProps) {
  return (
    <div className="w-1/3 min-w-[200px] max-w-[350px] flex flex-col rounded-lg border border-border overflow-hidden flex-shrink-0">
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30 flex-shrink-0">
        <h2 className="text-sm font-medium">Notizen</h2>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading} className="h-7 px-2">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aktualisieren'}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {/* New Note Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 mb-2"
            onClick={onNewNote}
          >
            <span className="text-primary">+</span> Neue Notiz
          </Button>
          
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">Keine Notizen gefunden.</p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className={`rounded-md border p-2.5 cursor-pointer transition-colors ${
                  selectedId === note.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-transparent hover:bg-muted/50'
                }`}
                onClick={() => onSelectNote(note.id)}
              >
                <div className="text-sm font-medium truncate">{note.title}</div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {note.tags?.length ? note.tags.slice(0, 3).map(t => `#${t}`).join(' ') : 'Keine Tags'}
                </div>
                {selectedId === note.id && isNoteLoading && (
                  <Loader2 className="h-3 w-3 animate-spin mt-1 text-primary" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

