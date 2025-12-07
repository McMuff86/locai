"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FolderOpen, FileText, Settings, Network } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  NotesList, 
  NoteEditor, 
  NoteSearch, 
  NoteAIActions,
  useNotes,
  useNoteSearch,
} from '@/components/notes';
import { useNotesContext } from './layout';

export default function NotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const noteIdFromUrl = searchParams.get('note');
  
  const { 
    basePath, 
    notes: contextNotes, 
    loading: contextLoading,
    fetchNotes: contextFetchNotes,
    selectedModel,
    installedModels,
    host,
  } = useNotesContext();
  
  // Local state for note editing
  const {
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
  } = useNotes({ basePath });
  
  // Search hook
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchFocused,
    setSearchFocused,
    clearSearch,
    highlightText,
  } = useNoteSearch({ basePath });
  
  // UI state
  const [isNoteMinimized, setIsNoteMinimized] = useState(false);
  const [highlightTerm, setHighlightTerm] = useState<string | null>(null);
  const [model, setModel] = useState(selectedModel || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch notes on mount and sync with context
  useEffect(() => {
    if (basePath) {
      fetchNotes();
    }
  }, [basePath, fetchNotes]);

  // Update model when selectedModel changes
  useEffect(() => {
    if (selectedModel) {
      setModel(selectedModel);
    }
  }, [selectedModel]);

  // Handle note ID from URL (from graph navigation)
  useEffect(() => {
    if (noteIdFromUrl && basePath && notes.length > 0) {
      const noteExists = notes.some(n => n.id === noteIdFromUrl);
      if (noteExists && selectedId !== noteIdFromUrl) {
        handleLoadNote(noteIdFromUrl);
      }
    }
  }, [noteIdFromUrl, basePath, notes, selectedId]);

  // Handle note selection with optional search term highlight
  const handleLoadNote = useCallback(async (noteId: string, searchTerm?: string) => {
    const note = await loadNote(noteId);
    if (note && searchTerm) {
      setHighlightTerm(searchTerm);
      setIsNoteMinimized(false);
      
      // Scroll to match in textarea
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea && note.content) {
          const lowerContent = note.content.toLowerCase();
          const lowerSearch = searchTerm.toLowerCase();
          const matchIndex = lowerContent.indexOf(lowerSearch);
          
          if (matchIndex !== -1) {
            const linesBefore = note.content.substring(0, matchIndex).split('\n').length - 1;
            const lineHeight = 20;
            textarea.scrollTop = Math.max(0, linesBefore * lineHeight - 60);
            textarea.focus();
            textarea.setSelectionRange(matchIndex, matchIndex + searchTerm.length);
          }
        }
      }, 100);
    } else {
      setHighlightTerm(null);
    }
  }, [loadNote]);

  // Handle search result selection
  const handleSearchSelect = useCallback((noteId: string, searchTerm: string) => {
    handleLoadNote(noteId, searchTerm);
    clearSearch();
  }, [handleLoadNote, clearSearch]);

  // Handle new note
  const handleNewNote = useCallback(() => {
    createNewNote();
    setHighlightTerm(null);
    setIsNoteMinimized(false);
  }, [createNewNote]);

  // Handle AI result application
  const handleApplyAiResult = useCallback((mode: 'append' | 'replace', result: string) => {
    if (mode === 'replace') {
      setForm(prev => ({ ...prev, content: result }));
    } else {
      setForm(prev => ({ ...prev, content: `${prev.content}\n\n${result}`.trim() }));
    }
  }, [setForm]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (selectedId) {
      await deleteNote(selectedId);
      setIsNoteMinimized(false);
    }
  }, [selectedId, deleteNote]);

  // If no notes path is configured, show setup message
  if (!basePath) {
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
    <div className="flex flex-col h-full overflow-hidden p-4">
      {/* Search Bar */}
      <NoteSearch
        searchQuery={searchQuery}
        searchResults={searchResults}
        isSearching={isSearching}
        searchFocused={searchFocused}
        onSearchChange={setSearchQuery}
        onFocusChange={setSearchFocused}
        onSelectResult={handleSearchSelect}
        highlightText={highlightText}
      />
      
      {/* Split View: Notes List + Editor */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left Panel: Notes List */}
        <NotesList
          notes={notes}
          selectedId={selectedId}
          loading={loading}
          isNoteLoading={isNoteLoading}
          onSelectNote={handleLoadNote}
          onNewNote={handleNewNote}
          onRefresh={fetchNotes}
        />
        
        {/* Right Panel: Editor */}
        <NoteEditor
          form={form}
          selectedId={selectedId}
          saving={saving}
          isMinimized={isNoteMinimized}
          highlightTerm={highlightTerm}
          onFormChange={setForm}
          onSave={upsertNote}
          onDelete={handleDelete}
          onToggleMinimize={() => setIsNoteMinimized(!isNoteMinimized)}
          onClearHighlight={() => setHighlightTerm(null)}
          textareaRef={textareaRef}
        >
          {/* AI Actions (inside editor slot) */}
          <NoteAIActions
            basePath={basePath}
            host={host}
            content={form.content}
            selectedNoteId={selectedId}
            model={model}
            installedModels={installedModels}
            onModelChange={setModel}
            onApplyResult={handleApplyAiResult}
          />
          
          {/* View in Graph Button */}
          {selectedId && (
            <div className="pt-3 border-t border-border/60 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-full"
                onClick={() => router.push('/notes/graph')}
              >
                <Network className="h-4 w-4" />
                Im Graph anzeigen
              </Button>
            </div>
          )}
        </NoteEditor>
      </div>
      
      {/* Error display */}
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </div>
  );
}
