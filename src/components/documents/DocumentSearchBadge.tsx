"use client";

import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentSearchBadgeProps {
  ragEnabled: boolean;
  readyCount: number;
  onToggle: () => void;
}

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
