"use client";

import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Tag } from 'lucide-react';
import { getTagColor, TAG_COLORS } from '@/types/chat';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  suggestions?: string[];
  compact?: boolean;
}

export function TagInput({ 
  tags, 
  onChange, 
  placeholder = "Tag hinzufügen...",
  maxTags = 5,
  suggestions = Object.keys(TAG_COLORS),
  compact = false
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCompactInput, setShowCompactInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s)
  );

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setShowCompactInput(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when compact input opens
  useEffect(() => {
    if (showCompactInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCompactInput]);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < maxTags) {
      onChange([...tags, trimmedTag]);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowCompactInput(false);
    }
  };

  // Compact mode with inline input
  if (compact) {
    return (
      <div ref={containerRef} className="relative">
        <div className="flex flex-wrap gap-1 items-center">
          {tags.map(tag => {
            const colors = getTagColor(tag);
            return (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${colors.bg} ${colors.text} border ${colors.border}`}
              >
                {tag}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  className="hover:opacity-70"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
          {tags.length < maxTags && !showCompactInput && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCompactInput(true);
                setShowSuggestions(true);
              }}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground rounded border border-dashed border-border hover:border-primary/50 transition-colors"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          )}
          {showCompactInput && tags.length < maxTags && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Delay to allow click on suggestion
                setTimeout(() => {
                  if (!inputValue) {
                    setShowCompactInput(false);
                  }
                }, 200);
              }}
              placeholder="Tag..."
              className="w-16 px-1 py-0.5 text-[10px] bg-background border border-border rounded outline-none focus:border-primary"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
        
        {/* Compact Suggestions Dropdown */}
        {showSuggestions && showCompactInput && filteredSuggestions.length > 0 && (
          <div className="absolute z-50 left-0 mt-1 py-1 bg-popover border border-border rounded-md shadow-lg max-h-[150px] overflow-y-auto min-w-[120px]">
            {filteredSuggestions.slice(0, 8).map(suggestion => {
              const colors = getTagColor(suggestion);
              return (
                <button
                  key={suggestion}
                  onClick={(e) => {
                    e.stopPropagation();
                    addTag(suggestion);
                    setShowCompactInput(false);
                  }}
                  className="w-full px-2 py-1 text-left text-xs hover:bg-muted flex items-center gap-1"
                >
                  <span className={`px-1.5 py-0.5 text-[10px] rounded ${colors.bg} ${colors.text}`}>
                    {suggestion}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-border bg-background min-h-[38px]">
        {tags.map(tag => {
          const colors = getTagColor(tag);
          return (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}
            >
              <Tag className="h-3 w-3" />
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="hover:opacity-70 ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {tags.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 py-1 bg-popover border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
          <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">
            Vorschläge
          </div>
          {filteredSuggestions.map(suggestion => {
            const colors = getTagColor(suggestion);
            return (
              <button
                key={suggestion}
                onClick={() => addTag(suggestion)}
                className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2"
              >
                <span className={`px-1.5 py-0.5 text-xs rounded ${colors.bg} ${colors.text}`}>
                  {suggestion}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Simple tag display component (read-only)
export function TagDisplay({ tags, onClick }: { tags: string[]; onClick?: (tag: string) => void }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(tag => {
        const colors = getTagColor(tag);
        return (
          <span
            key={tag}
            onClick={(e) => {
              if (onClick) {
                e.stopPropagation();
                onClick(tag);
              }
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${colors.bg} ${colors.text} border ${colors.border} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
          >
            {tag}
          </span>
        );
      })}
    </div>
  );
}

