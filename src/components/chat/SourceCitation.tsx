"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentSearchResult } from '@/lib/documents/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

// ---------------------------------------------------------------------------
// Single Source Item
// ---------------------------------------------------------------------------

function SourceItem({ result }: { result: DocumentSearchResult }) {
  const [expanded, setExpanded] = useState(false);
  const score = Math.round(result.score * 100);

  return (
    <div className="rounded-md border border-border/60 bg-background/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-medium truncate flex-1">
          {result.document.name}
        </span>
        <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">
          {score}% Match
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 border-t border-border/40">
          <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap break-words leading-relaxed">
            {result.highlight || truncateText(result.chunk.content, 500)}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground">
              Chunk {result.chunk.index + 1}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface SourceCitationProps {
  sources: DocumentSearchResult[];
  className?: string;
}

export function SourceCitation({ sources, className }: SourceCitationProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  // Deduplicate by document id – show best chunk per document
  const uniqueSources = sources.reduce<DocumentSearchResult[]>((acc, result) => {
    if (!acc.find((r) => r.document.id === result.document.id)) {
      acc.push(result);
    }
    return acc;
  }, []);

  return (
    <div
      className={cn(
        'mt-2 rounded-lg border border-primary/20 bg-primary/5 overflow-hidden',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-primary/10 transition-colors"
      >
        <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-primary">
          {uniqueSources.length} {uniqueSources.length === 1 ? 'Quelle' : 'Quellen'}
        </span>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-primary/60 ml-auto" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-primary/60 ml-auto" />
        )}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-1.5">
          {sources.map((result, idx) => (
            <SourceItem key={`${result.chunk.id}-${idx}`} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
