"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { NoteSummary, SemanticLink, GraphData, GraphSettings, defaultGraphSettings } from '../types';

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
  physicsPaused: boolean;
  setPhysicsPaused: (paused: boolean) => void;
  fetchSemanticLinks: () => Promise<void>;
  generateEmbeddings: (host?: string) => Promise<void>;
}

export function useGraph({ basePath, notes }: UseGraphOptions): UseGraphReturn {
  const [semanticLinks, setSemanticLinks] = useState<SemanticLink[]>([]);
  const [semanticThreshold, setSemanticThreshold] = useState(0.75);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [embeddingsStatus, setEmbeddingsStatus] = useState<string | null>(null);
  const [graphSettings, setGraphSettings] = useState<GraphSettings>(defaultGraphSettings);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [physicsPaused, setPhysicsPaused] = useState(false);

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
              setEmbeddingsStatus(`Starte Embedding-Generierung für ${data.total} Notizen mit ${data.model}...`);
            } else if (data.type === 'progress') {
              const contentInfo = data.contentLength ? ` (${data.contentLength} Zeichen)` : '';
              setEmbeddingsStatus(`📝 ${data.current}/${data.total}: "${data.noteTitle}"${contentInfo}`);
            } else if (data.type === 'note_done') {
              setEmbeddingsStatus(`✓ ${data.noteTitle} erfolgreich`);
            } else if (data.type === 'note_error') {
              setEmbeddingsStatus(`❌ ${data.noteTitle}: ${data.error}`);
            } else if (data.type === 'done') {
              finalProcessed = data.processed;
              if (data.errors && data.errors.length > 0) {
                const errorDetails = data.errors.slice(0, 2).join(' | ');
                setEmbeddingsStatus(`⚠ ${data.processed}/${data.total} OK - Fehler: ${errorDetails}`);
              } else {
                setEmbeddingsStatus(`✓ ${data.processed} Notizen verarbeitet`);
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
    setGraphSettings((prev) => ({ ...prev, ...updates }));
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
    const wikiEdges: { source: string; target: string; type: 'wiki' | 'semantic'; similarity?: number }[] = [];
    for (const note of notes) {
      for (const link of note.links || []) {
        const target = notes.find((n) => n.id === link || n.title === link);
        if (target) {
          wikiEdges.push({ source: note.id, target: target.id, type: 'wiki' });
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

    return { nodes, links: allEdges };
  }, [notes, semanticLinks]);

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
    physicsPaused,
    setPhysicsPaused,
    fetchSemanticLinks,
    generateEmbeddings,
  };
}

