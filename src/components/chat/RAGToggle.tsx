"use client";

import React from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RAGToggleProps {
  enabled: boolean;
  onToggle: () => void;
  readyCount: number;
  disabled?: boolean;
}

export function RAGToggle({
  enabled,
  onToggle,
  readyCount,
  disabled = false,
}: RAGToggleProps) {
  const hasDocuments = readyCount > 0;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-8 w-8 relative transition-colors',
        enabled && hasDocuments
          ? 'text-primary bg-primary/10 hover:bg-primary/20'
          : 'text-muted-foreground',
        !hasDocuments && 'opacity-50',
      )}
      onClick={onToggle}
      disabled={disabled || !hasDocuments}
      title={
        !hasDocuments
          ? 'Keine indexierten Dokumente vorhanden'
          : enabled
            ? `RAG aktiv (${readyCount} Dokumente)`
            : 'Dokumente als Kontext verwenden'
      }
    >
      <BookOpen className="h-4 w-4" />
      {enabled && hasDocuments && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
        </span>
      )}
    </Button>
  );
}
