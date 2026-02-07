"use client";

import { useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface GraphSearchProps {
  value: string;
  onChange: (value: string) => void;
  matchCount: number;
  onFocusFirst?: () => void;
}

export function GraphSearch({ value, onChange, matchCount, onFocusFirst }: GraphSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onFocusFirst) {
      onFocusFirst();
    }
    if (e.key === 'Escape') {
      onChange('');
      inputRef.current?.blur();
    }
  }, [onFocusFirst, onChange]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-1.5 shadow-sm focus-within:border-primary/50 transition-colors">
        <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nodes suchen..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
        />
        {value && (
          <div className="flex items-center gap-1.5">
            {matchCount > 0 && (
              <span className="text-[10px] text-primary font-medium">{matchCount} Treffer</span>
            )}
            <button
              onClick={() => onChange('')}
              className="p-0.5 rounded hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
