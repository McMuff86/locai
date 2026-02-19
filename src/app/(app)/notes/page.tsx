"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FolderOpen, FileText, Settings, Network, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
    searxngUrl,
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
    hasUnsavedChanges,
    setForm,
    setSelectedId,
    setError,
    fetchNotes,
    loadNote,
    upsertNote,
    deleteNote,
    createNewNote,
    discardChanges,
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
  
  // Unsaved changes dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [pendingSearchTerm, setPendingSearchTerm] = useState<string | undefined>(undefined);
  const [pendingAction, setPendingAction] = useState<'load' | 'new' | null>(null);
  
  // Track if we've handled the initial URL note
  const urlNoteHandledRef = useRef<string | null>(null);

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

  // Handle note ID from URL (from graph navigation) - only once per URL change
  useEffect(() => {
    // Only process if we have a new URL note that we haven't handled yet
    if (noteIdFromUrl && basePath && notes.length > 0 && urlNoteHandledRef.current !== noteIdFromUrl) {
      const noteExists = notes.some(n => n.id === noteIdFromUrl);
      if (noteExists) {
        urlNoteHandledRef.current = noteIdFromUrl;
        // Use loadNote directly to avoid unsaved changes dialog on initial load
        loadNote(noteIdFromUrl);
      }
    }
    // Reset when URL note is cleared
    if (!noteIdFromUrl) {
      urlNoteHandledRef.current = null;
    }
  }, [noteIdFromUrl, basePath, notes, loadNote]);

  // Actually load the note (internal)
  const doLoadNote = useCallback(async (noteId: string, searchTerm?: string) => {
    // Clear URL parameter if it exists to prevent interference
    if (noteIdFromUrl && noteIdFromUrl !== noteId) {
      router.replace('/notes', { scroll: false });
      urlNoteHandledRef.current = null;
    }
    
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
  }, [loadNote, noteIdFromUrl, router]);

  // Handle note selection with unsaved changes check
  const handleLoadNote = useCallback(async (noteId: string, searchTerm?: string) => {
    // Skip if trying to load the already selected note
    if (noteId === selectedId) return;
    
    // Check for unsaved changes
    if (hasUnsavedChanges) {
      setPendingNoteId(noteId);
      setPendingSearchTerm(searchTerm);
      setPendingAction('load');
      setShowUnsavedDialog(true);
      return;
    }
    
    await doLoadNote(noteId, searchTerm);
  }, [selectedId, hasUnsavedChanges, doLoadNote]);

  // Handle dialog actions
  const handleSaveAndContinue = useCallback(async () => {
    const saved = await upsertNote();
    if (saved) {
      setShowUnsavedDialog(false);
      if (pendingAction === 'load' && pendingNoteId) {
        await doLoadNote(pendingNoteId, pendingSearchTerm);
      } else if (pendingAction === 'new') {
        createNewNote();
        setHighlightTerm(null);
        setIsNoteMinimized(false);
      }
      setPendingNoteId(null);
      setPendingSearchTerm(undefined);
      setPendingAction(null);
    }
  }, [upsertNote, pendingAction, pendingNoteId, pendingSearchTerm, doLoadNote, createNewNote]);

  const handleDiscardAndContinue = useCallback(async () => {
    discardChanges();
    setShowUnsavedDialog(false);
    if (pendingAction === 'load' && pendingNoteId) {
      await doLoadNote(pendingNoteId, pendingSearchTerm);
    } else if (pendingAction === 'new') {
      createNewNote();
      setHighlightTerm(null);
      setIsNoteMinimized(false);
    }
    setPendingNoteId(null);
    setPendingSearchTerm(undefined);
    setPendingAction(null);
  }, [discardChanges, pendingAction, pendingNoteId, pendingSearchTerm, doLoadNote, createNewNote]);

  const handleCancelDialog = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingNoteId(null);
    setPendingSearchTerm(undefined);
    setPendingAction(null);
  }, []);

  // Handle search result selection
  const handleSearchSelect = useCallback((noteId: string, searchTerm: string) => {
    handleLoadNote(noteId, searchTerm);
    clearSearch();
  }, [handleLoadNote, clearSearch]);

  // Handle new note with unsaved changes check
  const handleNewNote = useCallback(() => {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
      setPendingAction('new');
      setShowUnsavedDialog(true);
      return;
    }
    
    createNewNote();
    setHighlightTerm(null);
    setIsNoteMinimized(false);
  }, [hasUnsavedChanges, createNewNote]);

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
    <div className="flex flex-col h-full overflow-hidden p-3 md:p-4 gap-0">
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
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
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
            searxngUrl={searxngUrl}
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
      
      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Ungespeicherte Änderungen
            </DialogTitle>
            <DialogDescription>
              Du hast ungespeicherte Änderungen in der aktuellen Notiz. Was möchtest du tun?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCancelDialog}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDiscardAndContinue}
            >
              Verwerfen
            </Button>
            <Button
              onClick={handleSaveAndContinue}
              disabled={saving}
            >
              {saving ? 'Speichere...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

