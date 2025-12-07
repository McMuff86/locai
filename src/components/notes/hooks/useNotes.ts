"use client";

import { useState, useCallback } from 'react';
import { Note, NoteSummary, NoteForm } from '../types';

interface UseNotesOptions {
  basePath?: string;
}

interface UseNotesReturn {
  notes: NoteSummary[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  selectedId: string | null;
  isNoteLoading: boolean;
  form: NoteForm;
  setForm: React.Dispatch<React.SetStateAction<NoteForm>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  fetchNotes: () => Promise<void>;
  loadNote: (id: string) => Promise<Note | null>;
  upsertNote: () => Promise<boolean>;
  deleteNote: (id: string) => Promise<boolean>;
  createNewNote: () => void;
}

export function useNotes({ basePath }: UseNotesOptions): UseNotesReturn {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [form, setForm] = useState<NoteForm>({ title: '', content: '' });

  const fetchNotes = useCallback(async () => {
    if (!basePath) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notes?basePath=${encodeURIComponent(basePath)}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Fehler beim Laden der Notizen');
      }
      const data = (await res.json()) as NoteSummary[];
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  const loadNote = useCallback(async (id: string): Promise<Note | null> => {
    if (!basePath) return null;
    setIsNoteLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/notes?id=${encodeURIComponent(id)}&basePath=${encodeURIComponent(basePath)}`,
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Fehler beim Laden der Notiz');
      }
      const data = (await res.json()) as Note;
      setSelectedId(id);
      setForm({ title: data.title, content: data.content });
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      return null;
    } finally {
      setIsNoteLoading(false);
    }
  }, [basePath]);

  const upsertNote = useCallback(async (): Promise<boolean> => {
    if (!basePath) {
      setError('Bitte zuerst den Notizen-Pfad setzen.');
      return false;
    }
    if (!form.title.trim() && !form.content.trim()) {
      setError('Titel oder Inhalt erforderlich.');
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePath,
          id: selectedId || undefined,
          title: form.title || 'Untitled',
          content: form.content || '',
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Fehler beim Speichern');
      }
      await fetchNotes();
      if (!selectedId) {
        setForm({ title: '', content: '' });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      return false;
    } finally {
      setSaving(false);
    }
  }, [basePath, form, selectedId, fetchNotes]);

  const deleteNote = useCallback(async (id: string): Promise<boolean> => {
    if (!basePath) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/notes?id=${encodeURIComponent(id)}&basePath=${encodeURIComponent(basePath)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Fehler beim Löschen');
      }
      if (selectedId === id) {
        setSelectedId(null);
        setForm({ title: '', content: '' });
      }
      await fetchNotes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      return false;
    } finally {
      setSaving(false);
    }
  }, [basePath, selectedId, fetchNotes]);

  const createNewNote = useCallback(() => {
    setSelectedId(null);
    setForm({ title: '', content: '' });
  }, []);

  return {
    notes,
    loading,
    error,
    saving,
    selectedId,
    isNoteLoading,
    form,
    setForm,
    setSelectedId,
    setError,
    fetchNotes,
    loadNote,
    upsertNote,
    deleteNote,
    createNewNote,
  };
}

