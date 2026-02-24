"use client";

import React, { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Hash,
  Type,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ChunkData {
  id: string;
  index: number;
  preview: string;
  content: string;
  charCount: number;
  tokenEstimate: number;
  model: string;
  createdAt: string;
}

interface ChunkPreviewProps {
  documentId: string;
  chunkCount: number;
}

function ChunkItem({
  chunk,
  isExpanded,
  onToggle,
}: {
  chunk: ChunkData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-border/50 transition-colors',
        isExpanded
          ? 'bg-muted/30 border-border'
          : 'hover:bg-muted/20 hover:border-border/70',
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground flex-shrink-0">
          <Hash className="h-3 w-3" />
          {chunk.index}
        </span>
        <span className="text-xs text-foreground/80 truncate flex-1">
          {chunk.preview}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 flex-shrink-0 tabular-nums">
          <Type className="h-2.5 w-2.5" />
          ~{chunk.tokenEstimate} tok
        </span>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0">
              <div className="rounded-md bg-zinc-900/50 border border-border/30 p-3 max-h-64 overflow-y-auto">
                <pre className="text-xs text-foreground/70 whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {chunk.content}
                </pre>
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/50">
                <span>{chunk.charCount.toLocaleString()} chars</span>
                <span>~{chunk.tokenEstimate.toLocaleString()} tokens</span>
                <span>{chunk.model}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChunkPreview({ documentId, chunkCount }: ChunkPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadChunks = useCallback(async () => {
    if (loaded) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`);
      if (!res.ok) throw new Error('Failed to load chunks');
      const data = await res.json();
      setChunks(data.chunks ?? []);
      setLoaded(true);
    } catch (err) {
      console.error('[ChunkPreview] load error', err);
    } finally {
      setIsLoading(false);
    }
  }, [documentId, loaded]);

  const handleToggle = useCallback(() => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !loaded) {
      loadChunks();
    }
  }, [isOpen, loaded, loadChunks]);

  if (chunkCount === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        className={cn(
          'flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors w-full',
          'text-muted-foreground hover:text-foreground hover:bg-muted/30',
          isOpen && 'text-foreground bg-muted/20',
        )}
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Layers className="h-3.5 w-3.5" />
        <span>
          {chunkCount} Chunks {isOpen ? 'verbergen' : 'anzeigen'}
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1">
              {isLoading ? (
                <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Chunks werden geladen…
                </div>
              ) : (
                <ScrollArea className={cn(chunks.length > 5 && 'max-h-80')}>
                  <div className="space-y-1 pr-1">
                    {chunks.map((chunk) => (
                      <ChunkItem
                        key={chunk.id}
                        chunk={chunk}
                        isExpanded={expandedChunk === chunk.index}
                        onToggle={() =>
                          setExpandedChunk(
                            expandedChunk === chunk.index ? null : chunk.index,
                          )
                        }
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
