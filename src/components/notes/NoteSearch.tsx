"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X } from 'lucide-react';
import { SearchResult } from './types';

interface NoteSearchProps {
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  searchFocused: boolean;
  onSearchChange: (query: string) => void;
  onFocusChange: (focused: boolean) => void;
  onSelectResult: (noteId: string, searchTerm: string) => void;
  highlightText: (text: string, query: string) => string;
}

export function NoteSearch({
  searchQuery,
  searchResults,
  isSearching,
  searchFocused,
  onSearchChange,
  onFocusChange,
  onSelectResult,
  highlightText,
}: NoteSearchProps) {
  return (
    <div className="relative mb-3 flex-shrink-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <Input
          type="text"
          placeholder="Notizen durchsuchen..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => onFocusChange(true)}
          onBlur={() => setTimeout(() => onFocusChange(false), 150)}
          className="pl-9 pr-9 h-9 rounded-xl bg-muted/20 border-border/40 focus-visible:bg-background text-sm"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => onSearchChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Search Results Dropdown */}
      {searchFocused && searchQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover/95 backdrop-blur-md border border-border/40 rounded-xl shadow-xl z-50 overflow-hidden">
          <ScrollArea className="max-h-[350px]">
            {isSearching ? (
              <div className="p-4 text-center text-muted-foreground">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm">Suche...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine Notizen für &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div className="p-2">
                <p className="text-xs text-muted-foreground px-2 mb-2">
                  {searchResults.length} Notiz{searchResults.length !== 1 ? 'en' : ''} gefunden
                </p>
                {searchResults.map((result) => (
                  <div
                    key={result.noteId}
                    className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => {
                      onSelectResult(result.noteId, searchQuery);
                    }}
                  >
                    {/* Title with match indicator */}
                    <div className="flex items-center gap-2">
                      <div 
                        className="font-medium text-sm flex-1"
                        dangerouslySetInnerHTML={{ 
                          __html: highlightText(result.title, searchQuery) 
                        }}
                      />
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        result.matchType === 'title' 
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                          : result.matchType === 'tag'
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {result.matchType === 'title' ? 'Titel' : result.matchType === 'tag' ? 'Tag' : 'Inhalt'}
                      </span>
                    </div>
                    
                    {/* Content snippet with highlighted match */}
                    {result.snippet && (
                      <div 
                        className="text-xs text-muted-foreground mt-1.5 line-clamp-2 border-l-2 border-primary/30 pl-2"
                        dangerouslySetInnerHTML={{ 
                          __html: highlightText(result.snippet, searchQuery) 
                        }}
                      />
                    )}
                    
                    {/* Tags */}
                    {result.tags && result.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {result.tags.slice(0, 4).map((tag) => (
                          <span 
                            key={tag} 
                            className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded"
                            dangerouslySetInnerHTML={{ 
                              __html: '#' + highlightText(tag, searchQuery) 
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

