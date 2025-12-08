"use client";

import { useState, useCallback } from 'react';
import type { WebSearchResult, SearchResponse, SearchResult } from '@/lib/webSearch/types';

// Re-export types for convenience
export type { WebSearchResult, SearchResponse, SearchResult } from '@/lib/webSearch/types';

// ============================================================================
// Hook Options & Return Types
// ============================================================================

interface UseWebSearchOptions {
  // SearXNG
  searxngUrl?: string;
  
  // Ollama
  ollamaHost?: string;
  model?: string;
  
  // Search options
  maxResults?: number;
  language?: string;
  
  // AI Features (all default to true)
  optimizeQuery?: boolean;
  selectBestResult?: boolean;
  fetchContent?: boolean;
}

interface UseWebSearchReturn {
  // Actions
  search: (question: string) => Promise<WebSearchResult | null>;
  simpleSearch: (query: string) => Promise<SearchResponse | null>;
  selectResult: (index: number) => Promise<WebSearchResult | null>;
  
  // State
  isSearching: boolean;
  isFetchingContent: boolean;
  currentStep: SearchStep | null;
  error: string | null;
  lastResult: WebSearchResult | null;
  
  // Helpers
  clearResults: () => void;
  getFormattedResults: () => string | null;
}

// ============================================================================
// Search Steps for Progress Display
// ============================================================================

export type SearchStep = 
  | 'optimizing'    // AI is optimizing the query
  | 'searching'     // Searching SearXNG
  | 'selecting'     // AI is selecting best result
  | 'fetching'      // Fetching page content
  | 'complete'      // Done
  | 'error';        // Error occurred

const STEP_LABELS: Record<SearchStep, string> = {
  optimizing: '🧠 Optimiere Suchanfrage...',
  searching: '🔍 Durchsuche das Web...',
  selecting: '🎯 Wähle bestes Ergebnis...',
  fetching: '📄 Lade Seiteninhalt...',
  complete: '✓ Fertig',
  error: '✗ Fehler',
};

export function getStepLabel(step: SearchStep): string {
  return STEP_LABELS[step];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useWebSearch(options: UseWebSearchOptions = {}): UseWebSearchReturn {
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingContent, setIsFetchingContent] = useState(false);
  const [currentStep, setCurrentStep] = useState<SearchStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<WebSearchResult | null>(null);

  /**
   * Perform a full AI-powered web search
   */
  const search = useCallback(async (question: string): Promise<WebSearchResult | null> => {
    if (!question.trim()) {
      setError('Bitte eine Frage eingeben.');
      return null;
    }

    setIsSearching(true);
    setError(null);
    setCurrentStep('optimizing');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          options: {
            searxngUrl: options.searxngUrl,
            ollamaHost: options.ollamaHost || 'http://localhost:11434',
            model: options.model || 'llama3',
            maxResults: options.maxResults || 8,
            language: options.language || 'de-DE',
            optimizeQuery: options.optimizeQuery !== false,
            selectBestResult: options.selectBestResult !== false,
            fetchContent: options.fetchContent !== false,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Suche fehlgeschlagen');
      }

      setLastResult(data);
      setCurrentStep('complete');
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(errorMessage);
      setCurrentStep('error');
      return null;
    } finally {
      setIsSearching(false);
    }
  }, [options]);

  /**
   * Perform a simple search without AI optimization
   */
  const simpleSearch = useCallback(async (query: string): Promise<SearchResponse | null> => {
    if (!query.trim()) {
      setError('Bitte einen Suchbegriff eingeben.');
      return null;
    }

    const start = Date.now();
    setIsSearching(true);
    setError(null);
    setCurrentStep('searching');

    try {
      const params = new URLSearchParams({
        q: query,
        maxResults: (options.maxResults || 8).toString(),
        language: options.language || 'de-DE',
      });
      
      if (options.searxngUrl) {
        params.set('searxngUrl', options.searxngUrl);
      }

      const response = await fetch(`/api/search?${params}`);
      const data: SearchResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Suche fehlgeschlagen');
      }

      const baseResult: WebSearchResult = {
        originalQuestion: query,
        search: data,
        selection: data.results[0]
          ? {
              selectedIndex: 0,
              title: data.results[0].title,
              url: data.results[0].url,
              reason: 'Erstes Ergebnis (AI Auswahl deaktiviert)',
            }
          : undefined,
        success: true,
        durationMs: Date.now() - start,
      };

      setLastResult(baseResult);
      setCurrentStep('complete');
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(errorMessage);
      setCurrentStep('error');
      return null;
    } finally {
      setIsSearching(false);
    }
  }, [options]);

  /**
   * Manually select one of the search results and fetch its full content.
   */
  const selectResult = useCallback(
    async (index: number): Promise<WebSearchResult | null> => {
      if (!lastResult?.search?.results?.[index]) {
        return null;
      }

      const selected: SearchResult = lastResult.search.results[index];
      const baseResult: WebSearchResult = {
        ...lastResult,
        selection: {
          selectedIndex: index,
          title: selected.title,
          url: selected.url,
          reason: lastResult.selection?.reason || 'Vom Nutzer ausgewählt',
        },
        success: true,
      };

      // Update selection immediately so UI reflects the choice
      setLastResult(baseResult);
      setIsFetchingContent(true);
      setCurrentStep('fetching');
      setError(null);

      try {
        const response = await fetch('/api/search', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: selected.url, maxLength: 15000 }),
        });

        const content = await response.json();

        if (!response.ok) {
          throw new Error(content.error || 'Fehler beim Laden des Inhalts');
        }

        const updatedResult: WebSearchResult = {
          ...baseResult,
          content,
        };

        setLastResult(updatedResult);
        setCurrentStep('complete');
        return updatedResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
        setError(errorMessage);
        setCurrentStep('error');
        return null;
      } finally {
        setIsFetchingContent(false);
      }
    },
    [lastResult],
  );

  /**
   * Clear all results and errors
   */
  const clearResults = useCallback(() => {
    setLastResult(null);
    setError(null);
    setCurrentStep(null);
    setIsFetchingContent(false);
  }, []);

  /**
   * Get the formatted results for chat insertion
   */
  const getFormattedResults = useCallback((): string | null => {
    if (!lastResult) return null;
    
    // Use the pre-formatted version if available
    if ('formattedForChat' in lastResult) {
      return (lastResult as any).formattedForChat;
    }

    // Fallback: Build simple format
    if (lastResult.content?.content) {
      return [
        `🔍 **Web-Suche: "${lastResult.originalQuestion}"**`,
        '',
        `📄 **Quelle:** ${lastResult.selection?.title || 'Unbekannt'}`,
        `🔗 ${lastResult.selection?.url || ''}`,
        '',
        '---',
        '',
        lastResult.content.content,
      ].join('\n');
    }

    if (lastResult.search.results.length > 0) {
      const results = lastResult.search.results.slice(0, 5).map((r, i) => 
        `**[${i + 1}] ${r.title}**\n${r.url}\n${r.content}`
      );
      
      return [
        `🔍 **Web-Suche: "${lastResult.originalQuestion}"**`,
        '',
        '**Suchergebnisse:**',
        '',
        ...results,
      ].join('\n');
    }

    return null;
  }, [lastResult]);

  return {
    search,
    simpleSearch,
    selectResult,
    isSearching,
    isFetchingContent,
    currentStep,
    error,
    lastResult,
    clearResults,
    getFormattedResults,
  };
}

export default useWebSearch;
