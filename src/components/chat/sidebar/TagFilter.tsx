"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '../../ui/button';
import { Filter, X } from 'lucide-react';
import { Conversation } from '../../../types/chat';
import { getTagColor } from '@/types/chat';

interface TagFilterProps {
  conversations: Conversation[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export function TagFilter({
  conversations,
  selectedTag,
  onSelectTag,
}: TagFilterProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    conversations.forEach((c) => {
      c.tags?.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [conversations]);

  if (allTags.length === 0) return null;

  return (
    <div className="px-4 py-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Chat-Verlauf
        </span>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-2 text-xs gap-1 ${selectedTag ? 'text-primary' : ''}`}
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <Filter className="h-3 w-3" />
          {selectedTag || 'Filter'}
        </Button>
      </div>

      {/* Tag Filter Dropdown */}
      {showDropdown && (
        <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-md border border-border/50">
          <button
            onClick={() => {
              onSelectTag(null);
              setShowDropdown(false);
            }}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
              !selectedTag
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            Alle
          </button>
          {allTags.map((tag) => {
            const colors = getTagColor(tag);
            const isSelected = selectedTag === tag;
            return (
              <button
                key={tag}
                onClick={() => {
                  onSelectTag(isSelected ? null : tag);
                  setShowDropdown(false);
                }}
                className={`px-2 py-0.5 text-xs rounded-full transition-colors border ${
                  isSelected
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground border-transparent'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      {/* Active filter indicator */}
      {selectedTag && !showDropdown && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Gefiltert:</span>
          <button
            onClick={() => onSelectTag(null)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${getTagColor(selectedTag).bg} ${getTagColor(selectedTag).text} border ${getTagColor(selectedTag).border}`}
          >
            {selectedTag}
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default TagFilter;
