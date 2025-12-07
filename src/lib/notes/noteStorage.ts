import { Note, NoteInput, NoteSummary } from './types';

export interface NoteStorage {
  listNotes(): Promise<NoteSummary[]>;
  getNote(id: string): Promise<Note | null>;
  saveNote(input: NoteInput): Promise<Note>;
  deleteNote(id: string): Promise<boolean>;
}

export function sortByUpdatedDesc(notes: NoteSummary[]): NoteSummary[] {
  return [...notes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}


