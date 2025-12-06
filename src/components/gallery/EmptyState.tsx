"use client";

import React from 'react';
import { ImageIcon, FolderOpen } from 'lucide-react';
import { Button } from '../ui/button';
import { FilterMode } from './types';

interface EmptyStateProps {
  type: 'error' | 'empty';
  filterMode?: FilterMode;
  errorMessage?: string;
  onRetry?: () => void;
}

export function EmptyState({
  type,
  filterMode = 'all',
  errorMessage,
  onRetry,
}: EmptyStateProps) {
  if (type === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg mb-2">Fehler beim Laden</p>
        <p className="text-sm">{errorMessage}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={onRetry}
          >
            Erneut versuchen
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
      <p className="text-lg mb-2">
        {filterMode === 'favorites' ? 'Keine Favoriten' : 'Keine Bilder gefunden'}
      </p>
      <p className="text-sm">
        {filterMode === 'favorites' 
          ? 'Klicke auf den Stern um Bilder zu favorisieren'
          : 'Der Output-Ordner ist leer'
        }
      </p>
    </div>
  );
}

