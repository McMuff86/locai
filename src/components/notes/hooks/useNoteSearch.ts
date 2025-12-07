"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { SearchResult } from '../types';

interface UseNoteSearchOptions {
  basePath?: string;
  debounceMs?: number;
}

interface UseNoteSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  searchFocused: boolean;
  setSearchFocused: (focused: boolean) => void;
  clearSearch: () => void;
  highlightText: (text: string, query: string) => string;
}

export function useNoteSearch({ basePath, debounceMs = 200 }: UseNoteSearchOptions): UseNoteSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(async (query: string) => {
    if (!basePath || !query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await fetch('/api/notes/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePath,
          query,
          topK: 8,
          useEmbeddings: false, // Fast lexical search only
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.lexical || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [basePath]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (searchQuery.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, debounceMs);
    } else {
      setSearchResults([]);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch, debounceMs]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Highlight search term in text
  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-primary/30 text-foreground px-0.5 rounded">$1</mark>');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchFocused,
    setSearchFocused,
    clearSearch,
    highlightText,
  };
}

