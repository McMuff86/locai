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
  ChevronDown, ChevronUp, Sparkles, Loader2, Eye, LayoutList, ArrowRight,
  Settings, Palette, Zap, ZapOff, Box, Circle, Hexagon, Triangle,
  ZoomIn, ZoomOut, Download, Focus, RotateCcw, Maximize2, Minimize2,
  Pause, Play
} from 'lucide-react';

const ForceGraph3D = dynamic(
  () => import('react-force-graph-3d').catch(() => {
    console.error('Failed to load react-force-graph-3d');
    return null;
  }),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-muted-foreground">Lade 3D Graph...</div>
  }
);

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
  const [semanticLinks, setSemanticLinks] = useState<{ source: string; target: string; similarity: number }[]>([]);
  const [semanticThreshold, setSemanticThreshold] = useState(0.75); // Higher default for cleaner graph
  const [graphViewMode, setGraphViewMode] = useState<'text' | 'visual'>('text');
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 500 });
  const threeJsRef = useRef<any>(null);
  const graphRef = useRef<any>(null);
  
  // Graph visual settings
  const [showLabels, setShowLabels] = useState(false);
  const [graphTheme, setGraphTheme] = useState<'cyber' | 'obsidian' | 'neon' | 'minimal'>('cyber');
  const [nodeGlow, setNodeGlow] = useState(true);
  const [linkGlow, setLinkGlow] = useState(true);
  // Default values based on user's preferred settings
  const [nodeOpacity, setNodeOpacity] = useState(0.9);
  const [linkOpacity, setLinkOpacity] = useState(0.45);
  const [glowIntensity, setGlowIntensity] = useState(0.5);
  const [nodeGeometry, setNodeGeometry] = useState<'sphere' | 'box' | 'octahedron' | 'tetrahedron' | 'icon'>('sphere');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(true); // Show by default
  const [labelSize, setLabelSize] = useState(1.0); // 1.0 = 100% (current 250% visual size), up to 2.5 = 250%
  const [labelGlow, setLabelGlow] = useState(true); // Toggle for label glow effect
  const [nodeSize, setNodeSize] = useState(0.5); // 50% = nice compact size, can go 10%-150%
  const [metalness, setMetalness] = useState(0.3);
  const [roughness, setRoughness] = useState(0.2);
  const [linkWidth, setLinkWidth] = useState(0.4);
  const [showArrows, setShowArrows] = useState(true);
  const [bloomStrength, setBloomStrength] = useState(0.8);
  const [curvedLinks, setCurvedLinks] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [labelColor, setLabelColor] = useState('#ffffff');
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [physicsPaused, setPhysicsPaused] = useState(false);
  
  // Predefined label colors for quick selection
  const labelColorPresets = [
    { name: 'Weiß', color: '#ffffff' },
    { name: 'Schwarz', color: '#1a1a1a' },
    { name: 'Cyan', color: '#00ffff' },
    { name: 'Gold', color: '#ffd700' },
    { name: 'Grün', color: '#00ff88' },
    { name: 'Pink', color: '#ff69b4' },
    { name: 'Orange', color: '#ff8c00' },
  ];
  
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

  // Fetch semantic links from embeddings
  const fetchSemanticLinks = async () => {
    if (!basePath) return;
    try {
      const res = await fetch(
        `/api/notes/semantic-links?basePath=${encodeURIComponent(basePath)}&threshold=${semanticThreshold}`
      );
      if (res.ok) {
        const data = await res.json();
        setSemanticLinks(data.links || []);
      }
    } catch {
      // Silently fail - semantic links are optional
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
      fetchSemanticLinks();
    }
  }, [basePath, semanticThreshold]);

  // Load Three.js once
  useEffect(() => {
    if (typeof window !== 'undefined' && !threeJsRef.current) {
      import('three').then((THREE) => {
        threeJsRef.current = THREE;
      });
    }
  }, []);

  // Update graph dimensions when container size changes - using ResizeObserver
  useEffect(() => {
    const container = graphContainerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setGraphDimensions({ width: rect.width, height: rect.height });
      }
    };

    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setGraphDimensions({ width, height });
        }
      }
    });

    resizeObserver.observe(container);
    updateDimensions(); // Initial update
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [graphViewMode, graphExpanded]);

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
            
            console.log('[Embeddings UI] Received:', data.type, data);
            
            if (data.type === 'start') {
              setEmbeddingsStatus(`Starte Embedding-Generierung für ${data.total} Notizen mit ${data.model}...`);
            } else if (data.type === 'progress') {
              const contentInfo = data.contentLength ? ` (${data.contentLength} Zeichen)` : '';
              setEmbeddingsStatus(`📝 ${data.current}/${data.total}: "${data.noteTitle}"${contentInfo}`);
            } else if (data.type === 'note_done') {
              setEmbeddingsStatus(`✓ ${data.noteTitle} erfolgreich`);
            } else if (data.type === 'note_error') {
              console.error('[Embeddings UI] Note error:', data.noteTitle, data.error);
              setEmbeddingsStatus(`❌ ${data.noteTitle}: ${data.error}`);
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
      
      // Refresh notes and semantic links to update graph
      await fetchNotes();
      await fetchSemanticLinks();
      
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

  // Theme color definitions
  const getThemeColors = useCallback(() => {
    const themes = {
      cyber: {
        // Professional sci-fi palette - white/blue nodes, golden connections
        nodeColors: ['#88d4ff', '#a8ffcc', '#ffd866', '#ffaa66', '#88ffff', '#ff88cc', '#ccff88', '#ffcc88'],
        wikiLink: '#88ccff',
        semanticLink: '#ffd700', // Golden semantic links like reference
        background: 'linear-gradient(135deg, rgba(5,12,25,0.98) 0%, rgba(0,8,18,0.99) 100%)',
        glow: true,
      },
      obsidian: {
        nodeColors: ['#a78bfa', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#f472b6', '#22d3d8', '#a3e635'],
        wikiLink: '#a78bfa',
        semanticLink: '#34d399',
        background: 'linear-gradient(135deg, rgba(15,15,22,0.98) 0%, rgba(10,10,16,0.99) 100%)',
        glow: true,
      },
      neon: {
        nodeColors: ['#ff44ff', '#44ffff', '#ffff44', '#ff8844', '#44ff88', '#ff4488', '#8844ff', '#44ff44'],
        wikiLink: '#ff66ff',
        semanticLink: '#66ffff',
        background: 'linear-gradient(135deg, rgba(20,5,35,0.98) 0%, rgba(12,0,22,0.99) 100%)',
        glow: true,
      },
      minimal: {
        // Subtle monochrome palette
        nodeColors: ['#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#9ca3af', '#d1d5db', '#a1a1aa', '#d4d4d8'],
        wikiLink: '#94a3b8',
        semanticLink: '#64748b',
        background: 'rgba(0, 0, 0, 0.02)',
        glow: false,
      },
    };
    return themes[graphTheme];
  }, [graphTheme]);

  // Color function for graph nodes based on first tag
  const getNodeColor = useCallback((node: { tags?: string[] }) => {
    const theme = getThemeColors();
    const colors = theme.nodeColors;
    
    if (!node.tags || node.tags.length === 0) return '#6b7280'; // gray
    
    // Simple hash based on first tag
    const firstTag = node.tags[0] || '';
    let hash = 0;
    for (let i = 0; i < firstTag.length; i++) {
      hash = firstTag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, [getThemeColors]);

  // Mix color with white for neon glow effect
  const mixWithWhite = useCallback((hexColor: string, whiteAmount: number) => {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Mix with white
    const mixedR = Math.round(r + (255 - r) * whiteAmount);
    const mixedG = Math.round(g + (255 - g) * whiteAmount);
    const mixedB = Math.round(b + (255 - b) * whiteAmount);
    
    return `#${mixedR.toString(16).padStart(2, '0')}${mixedG.toString(16).padStart(2, '0')}${mixedB.toString(16).padStart(2, '0')}`;
  }, []);

  const graphData = useMemo(() => {
    const nodes = notes.map((note) => ({
      id: note.id,
      name: note.title,
      val: Math.max(2, (note.links?.length || 0) + (semanticLinks.filter(l => l.source === note.id || l.target === note.id).length || 0) + 1),
      tags: note.tags || [],
    }));

    // Wikilinks (explicit links) - type: 'wiki'
    const wikiEdges: { source: string; target: string; type: string; similarity?: number }[] = [];
    for (const note of notes) {
      for (const link of note.links || []) {
        const target = notes.find((n) => n.id === link || n.title === link);
        if (target) {
          wikiEdges.push({ source: note.id, target: target.id, type: 'wiki' });
        }
      }
    }

    // Semantic links (from embeddings) - type: 'semantic'
    // Limit to top 50 links by similarity to avoid visual clutter
    const maxSemanticLinks = 50;
    const sortedSemanticLinks = [...semanticLinks]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxSemanticLinks);
    
    const semanticEdges = sortedSemanticLinks.map(link => ({
      source: link.source,
      target: link.target,
      type: 'semantic',
      similarity: link.similarity
    }));

    // Combine edges, avoiding duplicates
    const allEdges = [...wikiEdges];
    for (const semEdge of semanticEdges) {
      const isDuplicate = wikiEdges.some(
        w => (w.source === semEdge.source && w.target === semEdge.target) ||
             (w.source === semEdge.target && w.target === semEdge.source)
      );
      if (!isDuplicate) {
        allEdges.push(semEdge);
      }
    }

    const result = { nodes, links: allEdges };
    
    // Debug logging
    if (graphViewMode === 'visual') {
      console.log('[Graph] Data:', {
        nodes: result.nodes.length,
        links: result.links.length,
        nodeIds: result.nodes.map(n => n.id),
        linkSources: result.links.map(l => l.source),
        linkTargets: result.links.map(l => l.target),
      });
    }
    
    return result;
  }, [notes, semanticLinks, graphViewMode]);

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
            <h2 className="text-sm font-medium">Verknüpfungen</h2>
            <p className="text-xs text-muted-foreground">
              {graphData.nodes.length} Notes / {graphData.links.filter((l: { type?: string }) => l.type === 'wiki').length} Wiki-Links / {semanticLinks.length} Semantische Links
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setGraphViewMode('text')}
                className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                  graphViewMode === 'text' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <LayoutList className="h-3 w-3" />
                Text
              </button>
              <button
                onClick={() => setGraphViewMode('visual')}
                className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                  graphViewMode === 'visual' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <Eye className="h-3 w-3" />
                3D
              </button>
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
            
            {/* Expand/Collapse Button */}
            <Button
              size="sm"
              variant={graphExpanded ? "default" : "outline"}
              onClick={() => setGraphExpanded(!graphExpanded)}
              className="gap-1.5"
              title={graphExpanded ? "Verkleinern" : "Vergrößern"}
            >
              {graphExpanded ? (
                <>
                  <ChevronDown className="h-3 w-3" />
                  <span className="hidden sm:inline">Klein</span>
                </>
              ) : (
                <>
                  <ChevronUp className="h-3 w-3" />
                  <span className="hidden sm:inline">Groß</span>
                </>
              )}
            </Button>
          </div>
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
        
        {/* Legend, Controls and Graph Settings */}
        <div className="space-y-3">
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5" style={{ backgroundColor: getThemeColors().wikiLink }} />
              <span className="text-muted-foreground">[[Wikilinks]]</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5" style={{ borderTop: '2px dashed', borderColor: getThemeColors().semanticLink }} />
              <span className="text-muted-foreground">Semantisch ähnlich ({semanticLinks.length})</span>
            </div>
          </div>
          
          {/* Controls Row */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Threshold Slider */}
            {semanticLinks.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Schwellenwert:</span>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={semanticThreshold}
                  onChange={(e) => setSemanticThreshold(parseFloat(e.target.value))}
                  className="w-24 h-1.5"
                  style={{ accentColor: getThemeColors().semanticLink }}
                />
                <span className="text-xs font-mono text-muted-foreground">{Math.round(semanticThreshold * 100)}%</span>
              </div>
            )}
            
            {/* Graph Settings (only in visual mode) */}
            {graphViewMode === 'visual' && (
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {/* Show Labels Toggle */}
                <button
                  onClick={() => setShowLabels(!showLabels)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1 ${
                    showLabels 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  title="Labels immer anzeigen"
                >
                  <Hash className="h-3 w-3" />
                  Labels
                </button>
                
                {/* Theme Selector */}
                <select
                  value={graphTheme}
                  onChange={(e) => setGraphTheme(e.target.value as typeof graphTheme)}
                  className="px-2 py-1 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                >
                  <option value="cyber">Cyber</option>
                  <option value="obsidian">Obsidian</option>
                  <option value="neon">Neon</option>
                  <option value="minimal">Minimal</option>
                </select>
                
                {/* Geometry Selector */}
                <select
                  value={nodeGeometry}
                  onChange={(e) => setNodeGeometry(e.target.value as typeof nodeGeometry)}
                  className="px-2 py-1 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                  title="Node Geometrie"
                >
                  <option value="sphere">Kugel</option>
                  <option value="box">Würfel</option>
                  <option value="octahedron">Oktaeder</option>
                  <option value="tetrahedron">Tetraeder</option>
                  <option value="icon">Icon</option>
                </select>
                
                {/* Glow Toggle */}
                <button
                  onClick={() => setNodeGlow(!nodeGlow)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    nodeGlow 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  title="Node Glow"
                >
                  {nodeGlow ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
                </button>
                
                {/* Advanced Settings Toggle */}
                <button
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    showAdvancedSettings 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  title="Erweiterte Einstellungen"
                >
                  <Settings className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          
          {/* Advanced Graph Settings */}
          {graphViewMode === 'visual' && showAdvancedSettings && (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {/* Node Opacity */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Node Transparenz</span>
                    <span className="text-xs font-mono text-muted-foreground">{Math.round(nodeOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={nodeOpacity}
                    onChange={(e) => setNodeOpacity(parseFloat(e.target.value))}
                    className="w-full h-1.5"
                    style={{ accentColor: getThemeColors().wikiLink }}
                  />
                </div>
                
                {/* Link Opacity - scaled internally so 100% = 50% real opacity */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Link Sichtbarkeit</span>
                    <span className="text-xs font-mono text-muted-foreground">{Math.round(linkOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={linkOpacity}
                    onChange={(e) => setLinkOpacity(parseFloat(e.target.value))}
                    className="w-full h-1.5"
                    style={{ accentColor: getThemeColors().semanticLink }}
                  />
                </div>
                
                {/* Glow Intensity */}
                {nodeGlow && (
                  <div className="space-y-1 col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Glow Intensität
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">{Math.round(glowIntensity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={glowIntensity}
                      onChange={(e) => setGlowIntensity(parseFloat(e.target.value))}
                      className="w-full h-1.5"
                      style={{ accentColor: getThemeColors().wikiLink }}
                    />
                  </div>
                )}
                
                {/* Node Size - 100% = current small size, can go down to 10% */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Node Größe</span>
                    <span className="text-xs font-mono text-muted-foreground">{Math.round(nodeSize * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.05"
                    value={nodeSize}
                    onChange={(e) => setNodeSize(parseFloat(e.target.value))}
                    className="w-full h-1.5"
                    style={{ accentColor: getThemeColors().wikiLink }}
                  />
                </div>
                
                {/* Label Size - linear scaling, 100% = current size */}
                {showLabels && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Label Größe
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">{Math.round(labelSize * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={labelSize}
                      onChange={(e) => setLabelSize(parseFloat(e.target.value))}
                      className="w-full h-1.5"
                      style={{ accentColor: getThemeColors().semanticLink }}
                    />
                  </div>
                )}
                
                {/* Label Color - Quick presets + custom picker */}
                {showLabels && (
                  <div className="space-y-2 col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Palette className="h-3 w-3" />
                        Label Farbe
                      </span>
                      <div className="flex items-center gap-1">
                        {/* Color presets */}
                        {labelColorPresets.map((preset) => (
                          <button
                            key={preset.color}
                            onClick={() => setLabelColor(preset.color)}
                            className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${
                              labelColor === preset.color ? 'border-white shadow-lg scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: preset.color }}
                            title={preset.name}
                          />
                        ))}
                        {/* Custom color picker */}
                        <div className="relative ml-2">
                          <input
                            type="color"
                            value={labelColor}
                            onChange={(e) => setLabelColor(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border border-border"
                            title="Eigene Farbe"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Label Glow Toggle */}
                {showLabels && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Label Glow
                      </span>
                      <button
                        onClick={() => setLabelGlow(!labelGlow)}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          labelGlow 
                            ? 'bg-primary/20 text-primary border border-primary/30' 
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {labelGlow ? 'An' : 'Aus'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Link Width */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Link Dicke</span>
                    <span className="text-xs font-mono text-muted-foreground">{Math.round(linkWidth * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2"
                    step="0.1"
                    value={linkWidth}
                    onChange={(e) => setLinkWidth(parseFloat(e.target.value))}
                    className="w-full h-1.5"
                    style={{ accentColor: getThemeColors().semanticLink }}
                  />
                </div>
                
                {/* Bloom Strength */}
                {nodeGlow && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Bloom
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">{Math.round(bloomStrength * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2"
                      step="0.1"
                      value={bloomStrength}
                      onChange={(e) => setBloomStrength(parseFloat(e.target.value))}
                      className="w-full h-1.5"
                      style={{ accentColor: getThemeColors().wikiLink }}
                    />
                  </div>
                )}
                
                {/* Show Arrows Toggle */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Pfeile</span>
                    <button
                      onClick={() => setShowArrows(!showArrows)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        showArrows 
                          ? 'bg-primary/20 text-primary border border-primary/30' 
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {showArrows ? 'An' : 'Aus'}
                    </button>
                  </div>
                </div>
                
                {/* Curved Links Toggle */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Linien</span>
                    <button
                      onClick={() => setCurvedLinks(!curvedLinks)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        curvedLinks 
                          ? 'bg-primary/20 text-primary border border-primary/30' 
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {curvedLinks ? 'Kurvig' : 'Gerade'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* TEXT VIEW */}
        {graphViewMode === 'text' && (
          <div className={`rounded-md border border-border/60 bg-muted/20 p-3 overflow-y-auto space-y-4 ${
            graphExpanded ? 'max-h-[70vh]' : 'max-h-[500px]'
          }`}>
            {/* Semantic Links Section */}
            <div>
              <h3 className="text-xs font-semibold text-emerald-500 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Semantische Ähnlichkeiten ({semanticLinks.length})
              </h3>
              {semanticLinks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Keine semantischen Links. Klicke &quot;Embeddings&quot; um Vektoren zu generieren.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {semanticLinks.map((link, idx) => {
                    const sourceNote = notes.find(n => n.id === link.source);
                    const targetNote = notes.find(n => n.id === link.target);
                    return (
                      <div 
                        key={idx}
                        className="flex items-center gap-2 text-xs p-2 rounded bg-emerald-500/10 border border-emerald-500/20"
                      >
                        <span 
                          className="text-foreground font-medium cursor-pointer hover:text-emerald-400 transition-colors"
                          onClick={() => sourceNote && loadNote(sourceNote.id)}
                        >
                          {sourceNote?.title || link.source}
                        </span>
                        <ArrowRight className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                        <span 
                          className="text-foreground font-medium cursor-pointer hover:text-emerald-400 transition-colors"
                          onClick={() => targetNote && loadNote(targetNote.id)}
                        >
                          {targetNote?.title || link.target}
                        </span>
                        <span className="ml-auto text-emerald-500 font-mono text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded">
                          {Math.round(link.similarity * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Wiki Links Section */}
            <div>
              <h3 className="text-xs font-semibold text-blue-500 mb-2 flex items-center gap-1.5">
                <Link2 className="h-3 w-3" />
                Wiki-Links ({graphData.links.filter((l: { type?: string }) => l.type === 'wiki').length})
              </h3>
              {graphData.links.filter((l: { type?: string }) => l.type === 'wiki').length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Keine Wiki-Links. Verwende [[Notizname]] in deinen Notizen um Verknüpfungen zu erstellen.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {graphData.links
                    .filter((l: { type?: string }) => l.type === 'wiki')
                    .map((link: { source: string; target: string }, idx: number) => {
                      const sourceNote = notes.find(n => n.id === link.source);
                      const targetNote = notes.find(n => n.id === link.target);
                      return (
                        <div 
                          key={idx}
                          className="flex items-center gap-2 text-xs p-2 rounded bg-blue-500/10 border border-blue-500/20"
                        >
                          <span 
                            className="text-foreground font-medium cursor-pointer hover:text-blue-400 transition-colors"
                            onClick={() => sourceNote && loadNote(sourceNote.id)}
                          >
                            {sourceNote?.title || link.source}
                          </span>
                          <ArrowRight className="h-3 w-3 text-blue-500 flex-shrink-0" />
                          <span 
                            className="text-foreground font-medium cursor-pointer hover:text-blue-400 transition-colors"
                            onClick={() => targetNote && loadNote(targetNote.id)}
                          >
                            {targetNote?.title || link.target}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* All Notes Overview */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                Alle Notizen ({notes.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {notes.map(note => (
                  <span
                    key={note.id}
                    className="text-[10px] px-2 py-1 rounded-full border cursor-pointer hover:border-primary transition-colors"
                    style={{ 
                      borderColor: getNodeColor({ tags: note.tags }) + '60',
                      backgroundColor: getNodeColor({ tags: note.tags }) + '15'
                    }}
                    onClick={() => loadNote(note.id)}
                  >
                    {note.title}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* VISUAL 3D VIEW */}
        {graphViewMode === 'visual' && (
          <div 
            ref={graphContainerRef}
            className={`w-full rounded-md border overflow-hidden relative transition-all duration-300 ${
              graphExpanded ? 'h-[70vh] min-h-[500px]' : 'h-[500px]'
            } ${
              graphTheme === 'cyber' 
                ? 'graph-container-cyber border-cyan-500/30' 
                : graphTheme === 'neon'
                ? 'graph-container-neon border-purple-500/30'
                : 'bg-muted/30 border-border/60'
            } ${showLabels ? 'graph-labels-visible' : ''}`}
            style={{ 
              minHeight: '360px',
              background: getThemeColors().background !== 'rgba(0, 0, 0, 0)' 
                ? getThemeColors().background 
                : undefined
            }}
          >
            {graphData.nodes.length > 0 ? (
              ForceGraph3D ? (
                <ForceGraph3D
                  graphData={graphData}
                  width={graphDimensions.width}
                  height={graphDimensions.height}
                  nodeLabel={(node: { name?: string }) => {
                    // Always return label - will be shown on hover or always if showLabels
                    return node.name || 'Node';
                  }}
                  nodeLabelOpacity={showLabels ? 1 : 0.8}
                  nodeLabelPosition="top"
                  nodeColor={getNodeColor}
                  nodeVal={(node: { val?: number }) => (node.val || 2) * nodeSize}
                  nodeResolution={nodeGlow ? 32 : 16}
                  nodeOpacity={nodeOpacity}
                  linkOpacity={linkGlow ? (linkOpacity * 0.5) + 0.15 : linkOpacity * 0.5}
                  linkWidth={(link: { type?: string }) => {
                    const baseWidth = link.type === 'wiki' ? 1.2 : 0.8;
                    return baseWidth * linkWidth;
                  }}
                  linkColor={(link: { type?: string }) => {
                    const theme = getThemeColors();
                    return link.type === 'wiki' ? theme.wikiLink : theme.semanticLink;
                  }}
                  linkLineDash={(link: { type?: string }) => link.type === 'semantic' ? [3, 3] : null}
                  linkDirectionalArrowLength={showArrows ? 3 * linkWidth : 0}
                  linkDirectionalArrowRelPos={1}
                  linkDirectionalArrowColor={(link: { type?: string }) => {
                    const theme = getThemeColors();
                    return link.type === 'wiki' ? theme.wikiLink : theme.semanticLink;
                  }}
                  linkCurvature={curvedLinks ? 0.15 : 0}
                  nodeThreeObject={(node: any) => {
                    // Use default sphere if Three.js not loaded
                    if (!threeJsRef.current) return null;
                    
                    // Always use custom object if we need labels or glow
                    // For spheres without glow and without labels, use default
                    if (nodeGeometry === 'sphere' && !nodeGlow && !showLabels) return null;
                    
                    const THREE = threeJsRef.current;
                    const baseSize = (node.val || 2) * 0.5;
                    const size = baseSize * nodeSize; // Apply node size multiplier
                    let geometry: any;
                    
                    try {
                      switch (nodeGeometry) {
                        case 'sphere':
                          geometry = new THREE.SphereGeometry(size, 32, 32);
                          break;
                        case 'box':
                          geometry = new THREE.BoxGeometry(size, size, size);
                          break;
                        case 'octahedron':
                          geometry = new THREE.OctahedronGeometry(size);
                          break;
                        case 'tetrahedron':
                          geometry = new THREE.TetrahedronGeometry(size);
                          break;
                        case 'icon':
                          const shape = new THREE.Shape();
                          const radius = size;
                          const sides = 6;
                          for (let i = 0; i < sides; i++) {
                            const angle = (i / sides) * Math.PI * 2;
                            const x = Math.cos(angle) * radius;
                            const y = Math.sin(angle) * radius;
                            if (i === 0) shape.moveTo(x, y);
                            else shape.lineTo(x, y);
                          }
                          shape.closePath();
                          geometry = new THREE.ExtrudeGeometry(shape, { depth: size * 0.3, bevelEnabled: true, bevelThickness: size * 0.1 });
                          break;
                        default:
                          geometry = new THREE.SphereGeometry(size, 32, 32);
                      }
                      
                      const color = getNodeColor(node);
                      
                      // Professional bloom/glow effect with white core
                      const coreColor = mixWithWhite(color, 0.85); // Almost white core
                      const midColor = mixWithWhite(color, 0.5);
                      const outerColor = color;
                      
                      // Create main mesh - bright white core
                      const material = new THREE.MeshBasicMaterial({
                        color: nodeGlow ? coreColor : color,
                        transparent: true,
                        opacity: nodeOpacity,
                      });
                      
                      const mesh = new THREE.Mesh(geometry, material);
                      
                      // Add professional bloom layers
                      if (nodeGlow) {
                        // Layer 1: Outermost diffuse glow
                        const glowGeometry1 = geometry.clone();
                        const glowMaterial1 = new THREE.MeshBasicMaterial({
                          color: outerColor,
                          transparent: true,
                          opacity: glowIntensity * bloomStrength * 0.15,
                          side: THREE.BackSide,
                        });
                        const glowMesh1 = new THREE.Mesh(glowGeometry1, glowMaterial1);
                        glowMesh1.scale.multiplyScalar(3.0);
                        mesh.add(glowMesh1);
                        
                        // Layer 2: Mid glow
                        const glowGeometry2 = geometry.clone();
                        const glowMaterial2 = new THREE.MeshBasicMaterial({
                          color: outerColor,
                          transparent: true,
                          opacity: glowIntensity * bloomStrength * 0.25,
                          side: THREE.BackSide,
                        });
                        const glowMesh2 = new THREE.Mesh(glowGeometry2, glowMaterial2);
                        glowMesh2.scale.multiplyScalar(2.2);
                        mesh.add(glowMesh2);
                        
                        // Layer 3: Inner colored glow
                        const glowGeometry3 = geometry.clone();
                        const glowMaterial3 = new THREE.MeshBasicMaterial({
                          color: midColor,
                          transparent: true,
                          opacity: glowIntensity * bloomStrength * 0.4,
                        });
                        const glowMesh3 = new THREE.Mesh(glowGeometry3, glowMaterial3);
                        glowMesh3.scale.multiplyScalar(1.6);
                        mesh.add(glowMesh3);
                        
                        // Layer 4: Bright inner halo
                        const glowGeometry4 = geometry.clone();
                        const glowMaterial4 = new THREE.MeshBasicMaterial({
                          color: coreColor,
                          transparent: true,
                          opacity: glowIntensity * bloomStrength * 0.6,
                        });
                        const glowMesh4 = new THREE.Mesh(glowGeometry4, glowMaterial4);
                        glowMesh4.scale.multiplyScalar(1.25);
                        mesh.add(glowMesh4);
                      }
                      
                      // Add label sprite - NO BOX, just pure glowing text
                      if (showLabels && node.name) {
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        if (context) {
                          const text = node.name;
                          // Base font size 120px at 100%, scalable to 250% (300px)
                          const baseFontSize = 120;
                          const scaledFontSize = Math.round(baseFontSize * labelSize);
                          // Use customizable label color
                          const glowPadding = scaledFontSize * 1.5; // Extra space for glow
                          
                          // Measure text
                          context.font = `500 ${scaledFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                          const textMetrics = context.measureText(text);
                          const textWidth = textMetrics.width;
                          
                          // Canvas size with padding for glow bloom
                          canvas.width = Math.ceil(textWidth + glowPadding * 2);
                          canvas.height = Math.ceil(scaledFontSize * 2 + glowPadding);
                          
                          // Transparent background
                          context.clearRect(0, 0, canvas.width, canvas.height);
                          
                          // Re-set font after resize
                          context.font = `500 ${scaledFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                          context.textAlign = 'center';
                          context.textBaseline = 'middle';
                          
                          const centerX = canvas.width / 2;
                          const centerY = canvas.height / 2;
                          
                          // Use custom label color for glow and text
                          const glowColor = labelColor === '#ffffff' ? color : labelColor;
                          
                          // Only draw glow layers if labelGlow is enabled
                          if (labelGlow) {
                            // Multiple bloom layers for professional glow
                            const bloomLayers = [
                              { blur: scaledFontSize * 1.0 * bloomStrength, alpha: 0.15, color: glowColor },
                              { blur: scaledFontSize * 0.6 * bloomStrength, alpha: 0.25, color: mixWithWhite(glowColor, 0.3) },
                              { blur: scaledFontSize * 0.35 * bloomStrength, alpha: 0.4, color: mixWithWhite(glowColor, 0.5) },
                              { blur: scaledFontSize * 0.15 * bloomStrength, alpha: 0.7, color: mixWithWhite(glowColor, 0.7) },
                            ];
                            
                            // Draw bloom layers
                            bloomLayers.forEach(layer => {
                              context.shadowColor = layer.color;
                              context.shadowBlur = layer.blur;
                              context.shadowOffsetX = 0;
                              context.shadowOffsetY = 0;
                              context.fillStyle = `rgba(255, 255, 255, ${layer.alpha})`;
                              context.fillText(text, centerX, centerY);
                            });
                          }
                          
                          // Final crisp text with custom color (always drawn)
                          context.shadowBlur = 0;
                          context.fillStyle = labelColor;
                          context.fillText(text, centerX, centerY);
                          
                          const texture = new THREE.CanvasTexture(canvas);
                          texture.needsUpdate = true;
                          texture.minFilter = THREE.LinearFilter;
                          texture.magFilter = THREE.LinearFilter;
                          
                          const spriteMaterial = new THREE.SpriteMaterial({
                            map: texture,
                            transparent: true,
                            opacity: 1,
                            depthTest: false,
                            depthWrite: false,
                          });
                          
                          const sprite = new THREE.Sprite(spriteMaterial);
                          const aspectRatio = canvas.width / canvas.height;
                          const spriteHeight = size * 2.0 * labelSize;
                          sprite.scale.set(spriteHeight * aspectRatio, spriteHeight, 1);
                          sprite.position.set(0, size * 2.2, 0);
                          sprite.renderOrder = 999;
                          mesh.add(sprite);
                        }
                      }
                      
                      return mesh;
                    } catch (err) {
                      console.error('Error creating custom node geometry:', err);
                      return null; // Fallback to default
                    }
                  }}
                  ref={graphRef}
                  enableNodeDrag={true}
                  enableNavigationControls={true}
                  enablePointerInteraction={true}
                  controlType="orbit"
                  // Optimized physics for many nodes
                  d3AlphaMin={0.1}
                  d3AlphaDecay={0.05}
                  d3VelocityDecay={0.6}
                  cooldownTime={1500}
                  cooldownTicks={30}
                  warmupTicks={30}
                  // Force simulation settings for better layout
                  linkDistance={80}
                  nodeRelSize={4}
                  dagMode={undefined}
                  onEngineStop={() => {
                    // Ensure controls work after physics settles
                    if (graphRef.current) {
                      const controls = graphRef.current.controls();
                      if (controls) {
                        controls.autoRotate = false;
                        controls.enableDamping = true;
                        controls.dampingFactor = 0.1;
                      }
                    }
                  }}
                  onNodeClick={(node: { id?: string; name?: string }) => {
                    if (node.id) {
                      loadNote(node.id);
                    }
                  }}
                  onNodeHover={(node: { id?: string } | null) => {
                    setHoveredNode(node?.id || null);
                    // Change cursor on hover
                    if (graphContainerRef.current) {
                      graphContainerRef.current.style.cursor = node ? 'pointer' : 'grab';
                    }
                  }}
                  onEngineStop={() => {
                    // Add lighting after graph is initialized
                    if (threeJsRef.current && nodeGlow) {
                      const THREE = threeJsRef.current;
                      // This will be called after the graph engine stops
                    }
                  }}
                  backgroundColor="rgba(0,0,0,0)"
                  showNavInfo={false}
                  // Enhanced lighting for better glow effects
                  onRender={(scene: any) => {
                    if (scene && scene.children) {
                      // Ensure proper lighting for emissive materials
                      const lights = scene.children.filter((child: any) => child.type === 'AmbientLight' || child.type === 'DirectionalLight');
                      if (lights.length === 0 && threeJsRef.current) {
                        const THREE = threeJsRef.current;
                        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
                        scene.add(ambientLight);
                        
                        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
                        directionalLight.position.set(5, 5, 5);
                        scene.add(directionalLight);
                      }
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  3D Graph konnte nicht geladen werden. Bitte Seite neu laden.
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Keine Notizen zum Anzeigen
              </div>
            )}
            
            {/* Floating Graph Controls - Enhanced */}
            <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-10">
              {/* Control Hints */}
              <div className="text-[10px] text-muted-foreground/60 bg-background/50 backdrop-blur-sm px-2 py-1 rounded">
                🖱️ Drag: Drehen • Scroll: Zoom • Rechtsklick: Pan
              </div>
              
              <div className="flex items-center gap-2">
                {/* Camera Controls */}
                <div className="flex items-center bg-background/80 backdrop-blur-sm rounded-lg border border-border/60 shadow-lg overflow-hidden">
                  <button
                    onClick={() => {
                      if (graphRef.current) {
                        const currentPos = graphRef.current.cameraPosition();
                        graphRef.current.cameraPosition({ z: currentPos.z * 0.7 }, undefined, 400);
                      }
                    }}
                    className="p-2 hover:bg-primary/20 transition-colors border-r border-border/40"
                    title="Zoom In (+)"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (graphRef.current) {
                        const currentPos = graphRef.current.cameraPosition();
                        graphRef.current.cameraPosition({ z: currentPos.z * 1.4 }, undefined, 400);
                      }
                    }}
                    className="p-2 hover:bg-primary/20 transition-colors border-r border-border/40"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (graphRef.current) {
                        graphRef.current.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 600);
                      }
                    }}
                    className="p-2 hover:bg-primary/20 transition-colors"
                    title="Ansicht zurücksetzen"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
                
                {/* Pause/Play Physics */}
                <button
                  onClick={() => {
                    if (graphRef.current) {
                      if (physicsPaused) {
                        graphRef.current.resumeAnimation();
                      } else {
                        graphRef.current.pauseAnimation();
                      }
                      setPhysicsPaused(!physicsPaused);
                    }
                  }}
                  className={`p-2 backdrop-blur-sm rounded-lg border shadow-lg transition-colors ${
                    physicsPaused 
                      ? 'bg-yellow-500/20 border-yellow-500/40 hover:bg-yellow-500/30' 
                      : 'bg-background/80 border-border/60 hover:bg-primary/20'
                  }`}
                  title={physicsPaused ? "Animation fortsetzen" : "Animation pausieren"}
                >
                  {physicsPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                
                {/* Focus on Graph Center */}
                <button
                  onClick={() => {
                    if (graphRef.current) {
                      // Zoom to fit all nodes
                      graphRef.current.zoomToFit(400, 50);
                    }
                  }}
                  className="p-2 bg-background/80 backdrop-blur-sm rounded-lg border border-border/60 shadow-lg hover:bg-primary/20 transition-colors"
                  title="Alle Nodes anzeigen"
                >
                  <Focus className="h-4 w-4" />
                </button>
                
                {/* Export Button */}
                <button
                  onClick={() => {
                    if (graphRef.current) {
                      const renderer = graphRef.current.renderer();
                      if (renderer) {
                        const canvas = renderer.domElement;
                        const link = document.createElement('a');
                        link.download = `graph-${new Date().toISOString().slice(0,10)}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                      }
                    }
                  }}
                  className="p-2 bg-background/80 backdrop-blur-sm rounded-lg border border-border/60 shadow-lg hover:bg-primary/20 transition-colors"
                  title="Als PNG exportieren"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* Hovered Node Info - Compact */}
            {hoveredNode && (
              <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg border border-border/60 shadow-lg px-3 py-2 z-10 max-w-[200px]">
                <p className="text-sm font-medium text-foreground truncate">
                  {notes.find(n => n.id === hoveredNode)?.title || hoveredNode}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Klicken zum Öffnen</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


