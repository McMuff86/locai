"use client";

import React from 'react';
import { 
  X, 
  RefreshCw, 
  Grid3X3, 
  LayoutGrid, 
  Maximize2,
  Star,
  ImageIcon
} from 'lucide-react';
import { Button } from '../ui/button';
import { GridSize, FilterMode } from './types';

interface GalleryHeaderProps {
  total: number;
  filterMode: FilterMode;
  gridSize: GridSize;
  favoriteCount: number;
  isLoading: boolean;
  displayCount: number;
  onFilterChange: (mode: FilterMode) => void;
  onGridSizeChange: (size: GridSize) => void;
  onRefresh: () => void;
  onClose?: () => void;
}

export function GalleryHeader({
  total,
  filterMode,
  gridSize,
  favoriteCount,
  isLoading,
  displayCount,
  onFilterChange,
  onGridSizeChange,
  onRefresh,
  onClose,
}: GalleryHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">ComfyUI Gallery</h2>
        </div>
        
        <div className="text-sm text-muted-foreground">
          {filterMode === 'favorites' 
            ? `${displayCount} Favoriten`
            : `${total} Bilder`
          }
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Filter Toggle */}
        <div className="flex items-center bg-muted rounded-lg p-1">
          <Button
            variant={filterMode === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3"
            onClick={() => onFilterChange('all')}
          >
            Alle
          </Button>
          <Button
            variant={filterMode === 'favorites' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3"
            onClick={() => onFilterChange('favorites')}
          >
            <Star className="h-3.5 w-3.5 mr-1 fill-current" />
            Favoriten ({favoriteCount})
          </Button>
        </div>
        
        {/* Grid Size Toggle */}
        <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
          <Button
            variant={gridSize === 'tiny' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onGridSizeChange('tiny')}
            title="Sehr klein (max. Bilder)"
          >
            XS
          </Button>
          <Button
            variant={gridSize === 'small' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onGridSizeChange('small')}
            title="Klein"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={gridSize === 'medium' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onGridSizeChange('medium')}
            title="Mittel"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={gridSize === 'large' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onGridSizeChange('large')}
            title="Groß"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
        
        {/* Close - only shown in modal mode */}
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}

