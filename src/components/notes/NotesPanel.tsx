"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Note, NoteSummary } from '@/lib/notes';
import { 
  Search, X, Hash, Link2, Bold, Italic, 
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  ChevronDown, ChevronUp, Sparkles, Loader2
} from 'lucide-react';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

// Markdown toolbar button component
interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function ToolbarButton({ icon, label, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
      title={label}
    >
      {icon}
    </button>
  );
}

export interface NotesPanelProps {
  basePath?: string;
  defaultModel?: string;
  host?: string;
  installedModels?: string[];
  className?: string;
}

export function NotesPanel({ basePath, defaultModel, host, installedModels = [], className }: NotesPanelProps) {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; content: string }>({ title: '', content: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<'complete' | 'summarize'>('complete');
  const [model, setModel] = useState<string>(defaultModel || '');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    noteId: string;
    title: string;
    tags: string[];
    score: number;
    snippet: string;
    matchType: 'title' | 'content' | 'tag';
  }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // UI state
  const [isNoteMinimized, setIsNoteMinimized] = useState(false);
  const [highlightTerm, setHighlightTerm] = useState<string | null>(null);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [embeddingsStatus, setEmbeddingsStatus] = useState<string | null>(null);
  
  // Textarea ref for markdown toolbar
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  const fetchNotes = async () => {
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
  };

  const loadNote = async (id: string, searchTerm?: string) => {
    if (!basePath) return;
    setIsNoteLoading(true);
    setError(null);
    setIsNoteMinimized(false); // Expand note when loading
    
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
      
      // Set highlight term and scroll to match
      if (searchTerm) {
        setHighlightTerm(searchTerm);
        
        // Scroll textarea to the match position after a short delay
        setTimeout(() => {
          const textarea = textareaRef.current;
          if (textarea && data.content) {
            const lowerContent = data.content.toLowerCase();
            const lowerSearch = searchTerm.toLowerCase();
            const matchIndex = lowerContent.indexOf(lowerSearch);
            
            if (matchIndex !== -1) {
              // Calculate approximate scroll position
              const linesBefore = data.content.substring(0, matchIndex).split('\n').length - 1;
              const lineHeight = 20; // Approximate line height
              textarea.scrollTop = Math.max(0, linesBefore * lineHeight - 60);
              
              // Select the matched text
              textarea.focus();
              textarea.setSelectionRange(matchIndex, matchIndex + searchTerm.length);
            }
          }
        }, 100);
      } else {
        setHighlightTerm(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsNoteLoading(false);
    }
  };

  const upsertNote = async () => {
    if (!basePath) {
      setError('Bitte zuerst den Notizen-Pfad setzen.');
      return;
    }
    if (!form.title.trim() && !form.content.trim()) {
      setError('Titel oder Inhalt erforderlich.');
      return;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id: string) => {
    if (!basePath) return;
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
        setIsNoteMinimized(false); // Reset minimized state
      }
      await fetchNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  };

  const stopAi = useCallback(() => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setAiLoading(false);
    // Keep the current aiResult so user can still use it
  }, []);

  const runAi = async (action: 'complete' | 'summarize') => {
    if (!basePath) {
      setError('Bitte zuerst den Notizen-Pfad setzen.');
      return;
    }
    if (!model.trim()) {
      setError('Bitte ein Modell auswählen.');
      return;
    }
    const content = form.content || '';
    if (!content.trim()) {
      setError('Für KI-Aktionen wird Inhalt benötigt.');
      return;
    }
    
    // Cancel any existing request
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    
    // Create new abort controller
    const abortController = new AbortController();
    aiAbortControllerRef.current = abortController;
    
    setAiLoading(true);
    setAiAction(action);
    setAiResult(''); // Start with empty string for streaming
    setError(null);
    
    try {
      const res = await fetch('/api/notes/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePath,
          noteId: selectedId || undefined,
          content,
          action,
          model,
          host,
        }),
        signal: abortController.signal,
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Fehler bei der KI-Aktion');
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('Stream nicht verfügbar');
      }

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        // Check if aborted
        if (abortController.signal.aborted) {
          reader.cancel();
          break;
        }
        
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const jsonStr = line.replace('data: ', '');
            const data = JSON.parse(jsonStr);
            
            if (data.token) {
              accumulated += data.token;
              setAiResult(accumulated);
            }
            
            if (data.done) {
              // Streaming complete
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch (err) {
      // Don't show error if aborted by user
      if (err instanceof Error && err.name === 'AbortError') {
        // User stopped - keep current result
        return;
      }
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setAiResult(null);
    } finally {
      setAiLoading(false);
      aiAbortControllerRef.current = null;
    }
  };

  const applyAiResult = (mode: 'append' | 'replace') => {
    if (!aiResult) return;
    if (mode === 'replace') {
      setForm((prev) => ({ ...prev, content: aiResult }));
    } else {
      setForm((prev) => ({ ...prev, content: `${prev.content}\n\n${aiResult}`.trim() }));
    }
    // Hide suggestion after applying
    setAiResult(null);
  };

  useEffect(() => {
    if (basePath) {
      fetchNotes();
    }
  }, [basePath]);

  useEffect(() => {
    setModel(defaultModel || '');
  }, [defaultModel]);

  // Search with debounce
  const performSearch = useCallback(async (query: string) => {
    if (!basePath || !query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await fetch('/api/notes/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePath,
          query,
          topK: 8,
          useEmbeddings: false, // Fast lexical search only
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.lexical || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [basePath]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (searchQuery.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 200);
    } else {
      setSearchResults([]);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // Highlight search term in text
  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-primary/30 text-foreground px-0.5 rounded">$1</mark>');
  }, []);

  // Markdown toolbar actions
  const insertMarkdown = useCallback((before: string, after: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = form.content.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newContent = 
      form.content.substring(0, start) + 
      before + textToInsert + after + 
      form.content.substring(end);
    
    setForm((prev) => ({ ...prev, content: newContent }));

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + textToInsert.length;
      textarea.setSelectionRange(
        selectedText ? start + before.length : newCursorPos,
        selectedText ? start + before.length + selectedText.length : newCursorPos
      );
    }, 0);
  }, [form.content]);

  const insertAtLineStart = useCallback((prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const content = form.content;
    
    // Find the start of the current line
    let lineStart = start;
    while (lineStart > 0 && content[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    const newContent = 
      content.substring(0, lineStart) + 
      prefix + 
      content.substring(lineStart);
    
    setForm((prev) => ({ ...prev, content: newContent }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  }, [form.content]);

  // Generate embeddings for all notes with streaming progress
  const generateEmbeddings = async () => {
    if (!basePath) {
      setError('Bitte zuerst den Notizen-Pfad setzen.');
      return;
    }
    
    setIsGeneratingEmbeddings(true);
    setEmbeddingsStatus('Verbinde mit Ollama...');
    setError(null);
    
    try {
      const res = await fetch('/api/notes/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePath,
          model: 'nomic-embed-text', // Embedding model
          host,
          streaming: true,
        }),
      });
      
      if (!res.ok) {
        // Try to parse error from response
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await res.json();
          throw new Error(data.error || 'Fehler bei Embedding-Generierung');
        }
        throw new Error(await res.text() || 'Fehler bei Embedding-Generierung');
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('Stream nicht verfügbar');
      }

      const decoder = new TextDecoder();
      let finalProcessed = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const jsonStr = line.replace('data: ', '');
            const data = JSON.parse(jsonStr);
            
            if (data.type === 'start') {
              setEmbeddingsStatus(`Starte... (${data.total} Notizen)`);
            } else if (data.type === 'progress') {
              setEmbeddingsStatus(`${data.current}/${data.total}: ${data.noteTitle}`);
            } else if (data.type === 'note_done') {
              // Optional: show completed note
            } else if (data.type === 'note_error') {
              console.error('Embedding error:', data.error);
              // Show the specific error
              setEmbeddingsStatus(`⚠ ${data.noteTitle}: ${data.error}`);
            } else if (data.type === 'done') {
              finalProcessed = data.processed;
              if (data.errors && data.errors.length > 0) {
                // Show detailed errors
                const errorDetails = data.errors.slice(0, 2).join(' | ');
                setEmbeddingsStatus(`⚠ ${data.processed}/${data.total} OK - Fehler: ${errorDetails}`);
                setError(`Embedding-Fehler: ${data.errors.join('\n')}`);
              } else {
                setEmbeddingsStatus(`✓ ${data.processed} Notizen verarbeitet`);
              }
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
      
      // Refresh notes to update graph
      await fetchNotes();
      
      // Clear status after delay (only if successful)
      if (finalProcessed > 0) {
        setTimeout(() => setEmbeddingsStatus(null), 4000);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      // Parse JSON error if present
      try {
        const parsed = JSON.parse(errorMsg);
        setError(parsed.error || errorMsg);
      } catch {
        setError(errorMsg);
      }
      setEmbeddingsStatus(null);
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  const graphData = useMemo(() => {
    const nodes = notes.map((note) => ({
      id: note.id,
      name: note.title,
      val: Math.max(1, (note.links?.length || 0) + 1),
      tags: note.tags,
    }));

    const edges: { source: string; target: string }[] = [];
    for (const note of notes) {
      for (const link of note.links || []) {
        const target = notes.find((n) => n.id === link || n.title === link);
        if (target) {
          edges.push({ source: note.id, target: target.id });
        }
      }
    }

    return { nodes, links: edges };
  }, [notes]);

  return (
    <div className={className}>
      {/* Search Bar */}
      <div className="relative mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Notizen durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            className="pl-10 pr-10 bg-muted/30 border-muted focus:bg-background"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Search Results Dropdown */}
        {searchFocused && searchQuery.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            <ScrollArea className="max-h-[350px]">
              {isSearching ? (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm">Suche...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Keine Notizen für &quot;{searchQuery}&quot;</p>
                </div>
              ) : (
                <div className="p-2">
                  <p className="text-xs text-muted-foreground px-2 mb-2">
                    {searchResults.length} Notiz{searchResults.length !== 1 ? 'en' : ''} gefunden
                  </p>
                  {searchResults.map((result) => (
                    <div
                      key={result.noteId}
                      className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                      onClick={() => {
                        const term = searchQuery;
                        loadNote(result.noteId, term);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                    >
                      {/* Title with match indicator */}
                      <div className="flex items-center gap-2">
                        <div 
                          className="font-medium text-sm flex-1"
                          dangerouslySetInnerHTML={{ 
                            __html: highlightText(result.title, searchQuery) 
                          }}
                        />
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          result.matchType === 'title' 
                            ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                            : result.matchType === 'tag'
                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {result.matchType === 'title' ? 'Titel' : result.matchType === 'tag' ? 'Tag' : 'Inhalt'}
                        </span>
                      </div>
                      
                      {/* Content snippet with highlighted match */}
                      {result.snippet && (
                        <div 
                          className="text-xs text-muted-foreground mt-1.5 line-clamp-2 border-l-2 border-primary/30 pl-2"
                          dangerouslySetInnerHTML={{ 
                            __html: highlightText(result.snippet, searchQuery) 
                          }}
                        />
                      )}
                      
                      {/* Tags */}
                      {result.tags && result.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {result.tags.slice(0, 4).map((tag) => (
                            <span 
                              key={tag} 
                              className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded"
                              dangerouslySetInnerHTML={{ 
                                __html: '#' + highlightText(tag, searchQuery) 
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
      
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            {selectedId ? 'Notiz bearbeiten' : 'Neue Notiz'}
          </h2>
          <div className="flex items-center gap-1">
            {selectedId && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => setIsNoteMinimized(!isNoteMinimized)}
                  title={isNoteMinimized ? 'Erweitern' : 'Minimieren'}
                >
                  {isNoteMinimized ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedId(null);
                    setForm({ title: '', content: '' });
                    setHighlightTerm(null);
                    setIsNoteMinimized(false); // Reset minimized state
                  }}
                >
                  Neu
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Highlight indicator */}
        {highlightTerm && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              Gefunden: <strong>&quot;{highlightTerm}&quot;</strong> - Text ist im Editor markiert
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-yellow-600 dark:text-yellow-400"
              onClick={() => setHighlightTerm(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        
        <Input
          placeholder="Titel"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
        />
        
        {/* Collapsible content */}
        {!isNoteMinimized && (
          <>
        {/* Markdown Toolbar */}
        <div className="flex items-center gap-0.5 p-1 bg-muted/30 rounded-md border border-border/60">
          <ToolbarButton 
            icon={<Heading1 className="h-4 w-4" />} 
            label="Überschrift 1" 
            onClick={() => insertAtLineStart('# ')} 
          />
          <ToolbarButton 
            icon={<Heading2 className="h-4 w-4" />} 
            label="Überschrift 2" 
            onClick={() => insertAtLineStart('## ')} 
          />
          <ToolbarButton 
            icon={<Heading3 className="h-4 w-4" />} 
            label="Überschrift 3" 
            onClick={() => insertAtLineStart('### ')} 
          />
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton 
            icon={<Bold className="h-4 w-4" />} 
            label="Fett (Ctrl+B)" 
            onClick={() => insertMarkdown('**', '**', 'fett')} 
          />
          <ToolbarButton 
            icon={<Italic className="h-4 w-4" />} 
            label="Kursiv (Ctrl+I)" 
            onClick={() => insertMarkdown('*', '*', 'kursiv')} 
          />
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton 
            icon={<List className="h-4 w-4" />} 
            label="Liste" 
            onClick={() => insertAtLineStart('- ')} 
          />
          <ToolbarButton 
            icon={<ListOrdered className="h-4 w-4" />} 
            label="Nummerierte Liste" 
            onClick={() => insertAtLineStart('1. ')} 
          />
          <ToolbarButton 
            icon={<Quote className="h-4 w-4" />} 
            label="Zitat" 
            onClick={() => insertAtLineStart('> ')} 
          />
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton 
            icon={<Link2 className="h-4 w-4" />} 
            label="[[Wikilink]]" 
            onClick={() => insertMarkdown('[[', ']]', 'Notiz-Titel')} 
          />
          <ToolbarButton 
            icon={<Hash className="h-4 w-4" />} 
            label="#Tag" 
            onClick={() => insertMarkdown('#', '', 'tag')} 
          />
        </div>
        
        <Textarea
          ref={textareaRef}
          placeholder="Inhalt (Markdown, [[Links]], #tags)"
          value={form.content}
          onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
          className="min-h-[140px] font-mono text-sm"
          onKeyDown={(e) => {
            // Keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
              if (e.key === 'b') {
                e.preventDefault();
                insertMarkdown('**', '**', 'fett');
              } else if (e.key === 'i') {
                e.preventDefault();
                insertMarkdown('*', '*', 'kursiv');
              }
            }
          }}
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={upsertNote} disabled={saving}>
              {saving ? 'Speichere...' : selectedId ? 'Änderungen speichern' : 'Notiz speichern'}
            </Button>
            {selectedId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedId && deleteNote(selectedId)}
                disabled={saving}
              >
                Löschen
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">Modell</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[180px]"
            >
              <option value="">Modell wählen</option>
              {installedModels.length > 0 ? (
                installedModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))
              ) : (
                <>
                  {defaultModel && <option value={defaultModel}>{defaultModel}</option>}
                  <option value="llama3">llama3</option>
                  <option value="qwen2.5-coder">qwen2.5-coder</option>
                </>
              )}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runAi('complete')}
              disabled={aiLoading}
            >
              {aiLoading && aiAction === 'complete' ? 'KI ergänzt...' : 'KI ergänzt'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runAi('summarize')}
              disabled={aiLoading}
            >
              {aiLoading && aiAction === 'summarize' ? 'KI fasst...' : 'KI fasst zusammen'}
            </Button>
          </div>
        </div>
        
        {/* AI Streaming / Result Area */}
        {(aiLoading || aiResult) && (
          <div className={`rounded-md border p-3 space-y-2 transition-colors ${
            aiLoading 
              ? 'border-primary/40 bg-primary/5' 
              : 'border-green-500/40 bg-green-500/5'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className={`text-xs font-medium flex items-center gap-2 ${
                aiLoading ? 'text-primary' : 'text-green-600 dark:text-green-400'
              }`}>
                {aiLoading ? (
                  <>
                    <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>{aiAction === 'complete' ? 'KI ergänzt...' : 'KI fasst zusammen...'}</span>
                    <span className="text-muted-foreground font-normal">({model})</span>
                  </>
                ) : (
                  <>✓ KI-Vorschlag ({aiAction === 'complete' ? 'Ergänzung' : 'Zusammenfassung'})</>
                )}
              </div>
              <div className="flex items-center gap-1">
                {aiLoading && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-6 px-2 text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
                    onClick={stopAi}
                  >
                    Stop
                  </Button>
                )}
                {!aiLoading && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setAiResult(null)}
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
            
            {/* Streaming text with blinking cursor */}
            <div className={`text-sm whitespace-pre-wrap border-l-2 pl-3 py-1 ${
              aiLoading ? 'border-primary/30' : 'border-green-500/30'
            }`}>
              {aiResult}
              {aiLoading && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse" 
                      style={{ animation: 'cursor-blink 0.8s ease-in-out infinite' }} />
              )}
            </div>
            
            {/* Action buttons (only when done) */}
            {!aiLoading && aiResult && (
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={() => applyAiResult('append')}>
                  Anhängen
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyAiResult('replace')}>
                  Ersetzen
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAiResult(null)}>
                  Verwerfen
                </Button>
              </div>
            )}
          </div>
        )}
          </>
        )}
        
        {/* Minimized state indicator */}
        {isNoteMinimized && selectedId && (
          <div className="text-xs text-muted-foreground text-center py-2 border-t border-border/60">
            Notiz minimiert • Klicke ↓ zum Erweitern
          </div>
        )}
        
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!basePath && (
          <p className="text-xs text-destructive">
            Bitte Notizen-Pfad in den Einstellungen setzen.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3 mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Notizen Übersicht</h2>
          <Button size="sm" variant="outline" onClick={fetchNotes} disabled={loading}>
            {loading ? 'Lädt...' : 'Aktualisieren'}
          </Button>
        </div>
        <ScrollArea className="h-[280px] pr-3">
          <div className="space-y-2">
            {notes.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine Notizen gefunden.</p>
            )}
            {notes.map((note) => (
              <div
                key={note.id}
                className={`rounded-md border border-border/60 p-3 hover:border-primary/60 transition-colors cursor-pointer ${
                  selectedId === note.id ? 'border-primary' : ''
                }`}
                onClick={() => loadNote(note.id)}
              >
                <div className="text-sm font-medium">{note.title}</div>
                <div className="text-xs text-muted-foreground">
                  {note.tags?.length ? `Tags: ${note.tags.join(', ')}` : 'Keine Tags'}
                </div>
                {selectedId === note.id && isNoteLoading && (
                  <div className="text-xs text-muted-foreground">Lädt...</div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3 mt-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-medium">Verknüpfungen (3D Graph)</h2>
            <p className="text-xs text-muted-foreground">
              {graphData.nodes.length} Notes / {graphData.links.length} Links
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={generateEmbeddings}
            disabled={isGeneratingEmbeddings || !basePath}
            className="gap-1.5"
          >
            {isGeneratingEmbeddings ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Embeddings
              </>
            )}
          </Button>
        </div>
        
        {/* Embedding Status/Progress */}
        {(isGeneratingEmbeddings || embeddingsStatus) && (
          <div className={`rounded-md border p-3 transition-colors ${
            isGeneratingEmbeddings 
              ? 'border-primary/40 bg-primary/5' 
              : embeddingsStatus?.startsWith('✓')
              ? 'border-green-500/40 bg-green-500/5'
              : 'border-yellow-500/40 bg-yellow-500/5'
          }`}>
            <div className="flex items-center gap-2">
              {isGeneratingEmbeddings && (
                <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
              <span className={`text-xs ${
                isGeneratingEmbeddings 
                  ? 'text-primary' 
                  : embeddingsStatus?.startsWith('✓')
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                {embeddingsStatus || 'Embeddings werden generiert...'}
              </span>
              {!isGeneratingEmbeddings && embeddingsStatus && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 ml-auto"
                  onClick={() => setEmbeddingsStatus(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground">
          Linien zeigen [[Wikilinks]] zwischen Notizen. Klicke &quot;Embeddings&quot; um nomic-embed-text Vektoren zu generieren.
        </p>
        
        <div className="h-[360px] rounded-md border border-border/60 overflow-hidden bg-muted/30">
          <ForceGraph3D
            graphData={graphData}
            nodeLabel="name"
            nodeAutoColorBy="tags"
            linkOpacity={0.4}
            linkWidth={1}
            enableNodeDrag={false}
            backgroundColor="transparent"
          />
        </div>
      </div>
    </div>
  );
}


