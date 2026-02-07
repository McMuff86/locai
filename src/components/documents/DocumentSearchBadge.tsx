"use client";

import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentSearchBadgeProps {
  /** Whether RAG document search is currently enabled */
  ragEnabled: boolean;
  /** Number of documents with status "ready" (shown in badge) */
  readyCount: number;
  /** Callback to toggle RAG on/off */
  onToggle: () => void;
}

/**
 * Compact badge displayed in the chat input area when RAG is active.
 * Shows the number of indexed documents and provides a dismiss button.
 * Renders nothing when RAG is disabled.
 */
export function DocumentSearchBadge({
  ragEnabled,
  readyCount,
  onToggle,
}: DocumentSearchBadgeProps) {
  if (!ragEnabled) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        'bg-primary/10 text-primary border border-primary/20',
      )}
    >
      <BookOpen className="h-3 w-3" />
      <span>
        RAG aktiv{readyCount > 0 && ` • ${readyCount} Dok.`}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
        title="RAG deaktivieren"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
