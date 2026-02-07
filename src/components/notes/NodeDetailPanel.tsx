"use client";

import { useEffect, useState } from 'react';
import { X, ExternalLink, Link2, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GraphData, GraphLink, NoteSummary } from './types';

interface NodeDetailPanelProps {
  noteId: string;
  notes: NoteSummary[];
  graphData: GraphData;
  basePath?: string;
  onClose: () => void;
  onNavigate: (noteId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

// Helper to extract ID from link source/target
function getLinkId(value: string | { id?: string } | unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

export function NodeDetailPanel({
  noteId,
  notes,
  graphData,
  basePath,
  onClose,
  onNavigate,
  onSelectNode,
}: NodeDetailPanelProps) {
  const [contentPreview, setContentPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const note = notes.find(n => n.id === noteId);

  // Fetch note content for preview
  useEffect(() => {
    if (!noteId || !basePath) return;
    setIsLoading(true);
    setContentPreview(null);
    
    fetch(`/api/notes?id=${encodeURIComponent(noteId)}&basePath=${encodeURIComponent(basePath)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.content) {
          // Strip markdown formatting for preview
          const plain = data.content
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1')
            .replace(/\[(.+?)\]\(.+?\)/g, '$1')
            .replace(/!\[.*?\]\(.+?\)/g, '')
            .replace(/\[\[(.+?)\]\]/g, '$1')
            .trim();
          setContentPreview(plain.slice(0, 200) + (plain.length > 200 ? '…' : ''));
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setIsLoading(false));
  }, [noteId, basePath]);

  // Find connected links
  const connectedLinks = graphData.links.filter((link: GraphLink) => {
    const sourceId = getLinkId(link.source);
    const targetId = getLinkId(link.target);
    return sourceId === noteId || targetId === noteId;
  });

  const wikiLinks = connectedLinks.filter(l => l.type === 'wiki');
  const semanticLinksArr = connectedLinks.filter(l => l.type === 'semantic');

  // Get connected node IDs
  const connectedNodeIds = connectedLinks.map(link => {
    const sourceId = getLinkId(link.source);
    const targetId = getLinkId(link.target);
    return sourceId === noteId ? targetId : sourceId;
  });

  const connectedNotes = connectedNodeIds
    .map(id => {
      const n = notes.find(note => note.id === id);
      const link = connectedLinks.find(l => {
        const s = getLinkId(l.source);
        const t = getLinkId(l.target);
        return (s === id && t === noteId) || (t === id && s === noteId);
      });
      return n ? { ...n, linkType: link?.type, similarity: link?.similarity } : null;
    })
    .filter(Boolean) as (NoteSummary & { linkType?: string; similarity?: number })[];

  if (!note) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-background/95 backdrop-blur-md border-l border-border shadow-2xl z-20 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4 border-b border-border/60">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{note.title}</h3>
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {note.tags.map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-muted transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Content Preview */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Vorschau</h4>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Lade...
            </div>
          ) : contentPreview ? (
            <p className="text-xs text-foreground/80 leading-relaxed">{contentPreview}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Kein Inhalt</p>
          )}
        </div>

        {/* Connected Nodes */}
        {connectedNotes.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
              Verknüpfungen ({connectedNotes.length})
            </h4>
            <div className="space-y-1">
              {connectedNotes.map(cn => (
                <button
                  key={cn.id}
                  onClick={() => onSelectNode(cn.id)}
                  className="flex items-center gap-2 w-full text-left text-xs p-2 rounded-md hover:bg-muted/60 transition-colors group"
                >
                  {cn.linkType === 'wiki' ? (
                    <Link2 className="h-3 w-3 text-blue-500 flex-shrink-0" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  )}
                  <span className="text-foreground truncate group-hover:text-primary transition-colors">
                    {cn.title}
                  </span>
                  {cn.similarity && (
                    <span className="ml-auto text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                      {Math.round(cn.similarity * 100)}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <div>Wiki-Links: {wikiLinks.length}</div>
          <div>Semantische Links: {semanticLinksArr.length}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/60">
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={() => onNavigate(noteId)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Notiz öffnen
        </Button>
      </div>
    </div>
  );
}
