"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import { NoteSummary, SemanticLink, GraphData, GraphSettings, defaultGraphSettings } from '../types';

const KG_SETTINGS_KEY = 'locai-kg-settings';

function loadPersistedSettings(): GraphSettings {
  if (typeof window === 'undefined') return defaultGraphSettings;
  try {
    const stored = localStorage.getItem(KG_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults so new keys are always present
      return { ...defaultGraphSettings, ...parsed };
    }
  } catch {
    // Corrupted data — reset
  }
  return defaultGraphSettings;
}

function persistSettings(settings: GraphSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KG_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

interface UseGraphOptions {
  basePath?: string;
  notes: NoteSummary[];
}

interface UseGraphReturn {
  semanticLinks: SemanticLink[];
  semanticThreshold: number;
  setSemanticThreshold: (threshold: number) => void;
  graphData: GraphData;
  isGeneratingEmbeddings: boolean;
  embeddingsStatus: string | null;
  setEmbeddingsStatus: React.Dispatch<React.SetStateAction<string | null>>;
  graphSettings: GraphSettings;
  updateGraphSettings: (settings: Partial<GraphSettings>) => void;
  graphExpanded: boolean;
  setGraphExpanded: (expanded: boolean) => void;
  hoveredNode: string | null;
  setHoveredNode: (nodeId: string | null) => void;
  selectedNode: string | null;
  setSelectedNode: (nodeId: string | null) => void;
  physicsPaused: boolean;
  setPhysicsPaused: (paused: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchMatches: string[];
  fetchSemanticLinks: () => Promise<void>;
  generateEmbeddings: (host?: string) => Promise<void>;
}

export function useGraph({ basePath, notes }: UseGraphOptions): UseGraphReturn {
  const [semanticLinks, setSemanticLinks] = useState<SemanticLink[]>([]);
  const [semanticThreshold, setSemanticThreshold] = useState(0.75);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [embeddingsStatus, setEmbeddingsStatus] = useState<string | null>(null);
  const [graphSettings, setGraphSettings] = useState<GraphSettings>(loadPersistedSettings);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [physicsPaused, setPhysicsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Compute search matches
  const searchMatches = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const q = debouncedSearch.toLowerCase();
    return notes
      .filter(n => n.title.toLowerCase().includes(q) || n.tags?.some(t => t.toLowerCase().includes(q)))
      .map(n => n.id);
  }, [debouncedSearch, notes]);

  const fetchSemanticLinks = useCallback(async () => {
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
  }, [basePath, semanticThreshold]);

  // Fetch semantic links when basePath or threshold changes
  useEffect(() => {
    if (basePath) {
      fetchSemanticLinks();
    }
  }, [basePath, semanticThreshold, fetchSemanticLinks]);

  const generateEmbeddings = useCallback(async (host?: string) => {
    if (!basePath) return;
    
    setIsGeneratingEmbeddings(true);
    setEmbeddingsStatus('Verbinde mit Ollama...');
    
    try {
      const res = await fetch('/api/notes/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePath,
          model: 'nomic-embed-text',
          host,
          streaming: true,
        }),
      });
      
      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await res.json();
          throw new Error(data.error || 'Fehler bei Embedding-Generierung');
        }
        throw new Error(await res.text() || 'Fehler bei Embedding-Generierung');
      }

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
              const skippedInfo = data.skipped > 0 ? ` (${data.skipped} unverändert übersprungen)` : '';
              if (data.total === 0) {
                setEmbeddingsStatus(`✓ Alle ${data.totalAll || 0} Notizen sind aktuell – nichts zu tun`);
              } else {
                setEmbeddingsStatus(`Embedding ${data.total}/${data.totalAll || data.total} Notizen...${skippedInfo}`);
              }
            } else if (data.type === 'progress') {
              setEmbeddingsStatus(`📝 Embedding ${data.current}/${data.total}: "${data.noteTitle}"`);
            } else if (data.type === 'note_done') {
              setEmbeddingsStatus(`✓ ${data.noteTitle} erfolgreich`);
            } else if (data.type === 'note_error') {
              setEmbeddingsStatus(`❌ ${data.noteTitle}: ${data.error}`);
            } else if (data.type === 'done') {
              finalProcessed = data.processed;
              const skippedInfo = data.skipped > 0 ? ` (${data.skipped} unverändert)` : '';
              if (data.errors && data.errors.length > 0) {
                const errorDetails = data.errors.slice(0, 2).join(' | ');
                setEmbeddingsStatus(`⚠ ${data.processed}/${data.total} OK${skippedInfo} - Fehler: ${errorDetails}`);
              } else {
                setEmbeddingsStatus(`✓ ${data.processed} Notizen verarbeitet${skippedInfo}`);
              }
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
      
      // Refresh semantic links
      await fetchSemanticLinks();
      
      if (finalProcessed > 0) {
        setTimeout(() => setEmbeddingsStatus(null), 4000);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      try {
        const parsed = JSON.parse(errorMsg);
        setEmbeddingsStatus(`Fehler: ${parsed.error || errorMsg}`);
      } catch {
        setEmbeddingsStatus(`Fehler: ${errorMsg}`);
      }
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  }, [basePath, fetchSemanticLinks]);

  const updateGraphSettings = useCallback((updates: Partial<GraphSettings>) => {
    setGraphSettings((prev) => {
      const next = { ...prev, ...updates };
      persistSettings(next);
      return next;
    });
  }, []);

  // Compute graph data from notes and semantic links
  const graphData = useMemo((): GraphData => {
    const nodes = notes.map((note) => ({
      id: note.id,
      name: note.title,
      val: Math.max(2, (note.links?.length || 0) + (semanticLinks.filter(l => l.source === note.id || l.target === note.id).length || 0) + 1),
      tags: note.tags || [],
    }));

    // Wikilinks (explicit links) - type: 'wiki'
    // Match by: exact id, exact title, or case-insensitive title
    const wikiEdges: { source: string; target: string; type: 'wiki' | 'semantic'; similarity?: number }[] = [];
    for (const note of notes) {
      for (const link of note.links || []) {
        const linkLower = link.toLowerCase().trim();
        const target = notes.find((n) => 
          n.id === link || 
          n.title === link || 
          n.title.toLowerCase() === linkLower ||
          n.id.toLowerCase() === linkLower
        );
        if (target && target.id !== note.id) {
          // Avoid duplicate edges
          const exists = wikiEdges.some(
            e => (e.source === note.id && e.target === target.id) ||
                 (e.source === target.id && e.target === note.id)
          );
          if (!exists) {
            wikiEdges.push({ source: note.id, target: target.id, type: 'wiki' });
          }
        }
      }
    }

    // Semantic links (from embeddings) - type: 'semantic'
    const maxSemanticLinks = 50;
    const sortedSemanticLinks = [...semanticLinks]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxSemanticLinks);
    
    const semanticEdges = sortedSemanticLinks.map(link => ({
      source: link.source,
      target: link.target,
      type: 'semantic' as const,
      similarity: link.similarity
    }));

    // Combine edges based on filter
    let filteredEdges: typeof wikiEdges = [];
    
    if (graphSettings.linkFilter === 'wiki') {
      filteredEdges = wikiEdges;
    } else if (graphSettings.linkFilter === 'semantic') {
      filteredEdges = semanticEdges;
    } else {
      // 'all' - combine edges, avoiding duplicates
      filteredEdges = [...wikiEdges];
      for (const semEdge of semanticEdges) {
        const isDuplicate = wikiEdges.some(
          w => (w.source === semEdge.source && w.target === semEdge.target) ||
               (w.source === semEdge.target && w.target === semEdge.source)
        );
        if (!isDuplicate) {
          filteredEdges.push(semEdge);
        }
      }
    }

    return { nodes, links: filteredEdges };
  }, [notes, semanticLinks, graphSettings.linkFilter]);

  return {
    semanticLinks,
    semanticThreshold,
    setSemanticThreshold,
    graphData,
    isGeneratingEmbeddings,
    embeddingsStatus,
    setEmbeddingsStatus,
    graphSettings,
    updateGraphSettings,
    graphExpanded,
    setGraphExpanded,
    hoveredNode,
    setHoveredNode,
    selectedNode,
    setSelectedNode,
    physicsPaused,
    setPhysicsPaused,
    searchQuery,
    setSearchQuery,
    searchMatches,
    fetchSemanticLinks,
    generateEmbeddings,
  };
}

