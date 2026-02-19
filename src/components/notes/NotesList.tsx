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
    <div className="w-1/3 min-w-[200px] max-w-[350px] flex flex-col rounded-xl border border-border/40 bg-background/60 backdrop-blur-sm shadow-sm overflow-hidden flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30 bg-muted/20 flex-shrink-0">
        <h2 className="text-xs font-semibold tracking-tight">Notizen</h2>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading} className="h-6 px-2 text-[11px] rounded-md">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aktualisieren'}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-1.5 space-y-px">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-1.5 mb-1.5 h-8 text-xs rounded-lg border-border/40 border-dashed"
            onClick={onNewNote}
          >
            <span className="text-primary font-bold">+</span> Neue Notiz
          </Button>

          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 p-3 text-center">Keine Notizen gefunden.</p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className={`rounded-lg px-2.5 py-2 cursor-pointer transition-all duration-150 ${
                  selectedId === note.id
                    ? 'bg-primary/10 text-foreground'
                    : 'hover:bg-muted/40'
                }`}
                onClick={() => onSelectNote(note.id)}
              >
                <div className="text-xs font-medium truncate leading-tight">{note.title}</div>
                <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5 leading-tight">
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

