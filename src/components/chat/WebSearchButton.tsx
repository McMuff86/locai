"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Search, Globe, Loader2, ExternalLink, Sparkles, FileText, CheckCircle2, Pencil, Eye, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWebSearch, getStepLabel, SearchResult } from '@/hooks/useWebSearch';

interface WebSearchButtonProps {
  searxngUrl?: string;
  ollamaHost?: string;
  model?: string;
  enabled?: boolean;
  onInsertResults: (formattedResults: string, query: string) => void;
}

export function WebSearchButton({ 
  searxngUrl, 
  ollamaHost = 'http://localhost:11434',
  model = 'llama3',
  enabled = false,
  onInsertResults 
}: WebSearchButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'results' | 'content'>('results');
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [optPreset, setOptPreset] = useState('bullets');
  const [optCustom, setOptCustom] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);

  const { 
    search,
    simpleSearch,
    isSearching, 
    isFetchingContent,
    currentStep,
    error, 
    lastResult, 
    clearResults,
    getFormattedResults,
    selectResult,
  } = useWebSearch({ 
    searxngUrl, 
    ollamaHost,
    model,
    optimizeQuery: useAI,
    selectBestResult: useAI,
    fetchContent: useAI,
  });

  // Initialize edited content when results arrive
  useEffect(() => {
    if (lastResult?.content?.content) {
      setEditedContent(lastResult.content.content);
      setIsEditing(false);
      setViewMode('content');
      // Nur initial vorwählen, wenn noch nichts ausgewählt wurde
      if (
        !selectedIndices.length &&
        typeof lastResult.selection?.selectedIndex === 'number'
      ) {
        setSelectedIndices([lastResult.selection.selectedIndex]);
      }
      return;
    }

    if (
      lastResult?.selection &&
      typeof lastResult.selection.selectedIndex === 'number' &&
      lastResult.search?.results?.[lastResult.selection.selectedIndex]
    ) {
      const selected = lastResult.search.results[lastResult.selection.selectedIndex];
      setEditedContent(selected.content || '');
      setIsEditing(true);
      setViewMode('content');
      if (!selectedIndices.length) {
        setSelectedIndices([lastResult.selection.selectedIndex]);
      }
      return;
    }

    // Fallback: show results list
    if (lastResult?.search?.results?.length) {
      setViewMode('results');
    }
  }, [lastResult, selectedIndices.length]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setEditedContent('');
    setIsEditing(false);
    setViewMode('results');
    setSelectedIndices([]);
    
    if (useAI) {
      await search(query);
    } else {
      await simpleSearch(query);
    }
  }, [query, useAI, search, simpleSearch]);

  const handleSelectResult = useCallback(
    async (index: number) => {
      await selectResult(index);
      setIsEditing(false);
      setViewMode('content');
      setSelectedIndices([index]);
    },
    [selectResult],
  );

  const toggleSelected = (idx: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(idx)) {
        return prev.filter((i) => i !== idx);
      }
      if (prev.length >= 5) return prev; // Limit auf 5
      return [...prev, idx];
    });
  };

  const handleMergeSelected = async () => {
    if (!lastResult?.search) return;
    const indices =
      selectedIndices.length > 0
        ? selectedIndices
        : typeof lastResult.selection?.selectedIndex === 'number'
          ? [lastResult.selection.selectedIndex]
          : [];
    if (!indices.length) return;

    const snippets = indices
      .slice(0, 5)
      .map((i) => lastResult.search.results[i])
      .filter(Boolean)
      .map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content || '',
      }));

    setIsOptimizing(true);
    setOptError(null);
    setEditedContent('');
    setViewMode('content');
    setIsEditing(false);

    try {
      const res = await fetch('/api/search/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          host: ollamaHost,
          snippets,
          preset: optPreset,
          customPrompt: optPreset === 'custom' ? optCustom : undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Optimierung fehlgeschlagen');
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('Stream nicht verfügbar');
      }

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const jsonStr = line.replace('data: ', '');
            const data = JSON.parse(jsonStr);
            
            if (data.token) {
              accumulated += data.token;
              setEditedContent(accumulated);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch (err) {
      setOptError(err instanceof Error ? err.message : 'Optimierung fehlgeschlagen');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleReloadContent = useCallback(
    async (index?: number) => {
      const targetIndex =
        typeof index === 'number'
          ? index
          : lastResult?.selection?.selectedIndex ?? undefined;
      if (targetIndex === undefined) return;
      await selectResult(targetIndex);
      setIsEditing(false);
      setViewMode('content');
    },
    [lastResult?.selection?.selectedIndex, selectResult],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleInsert = () => {
    // Build formatted result with edited content
    if (lastResult) {
      const title = lastResult.selection?.title || 'Web-Suche';
      const url = lastResult.selection?.url || lastResult.content?.url || '';
      const selectedIndex = lastResult.selection?.selectedIndex ?? 0;
      const fallbackSnippet = lastResult.search?.results?.[selectedIndex]?.content || '';
      const content = editedContent || lastResult.content?.content || fallbackSnippet;
      
      const formatted = [
        `🔍 **Web-Suche: "${query}"**`,
        '',
        `📄 **Quelle:** ${title}`,
        url ? `🔗 ${url}` : '',
        '',
        '---',
        '',
        content,
      ].filter(Boolean).join('\n');
      
      onInsertResults(formatted, query);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setEditedContent('');
    setIsEditing(false);
    setIsExpanded(false);
    clearResults();
  };

  const contentMaxHeight = useMemo(() => (isExpanded ? '60vh' : '34vh'), [isExpanded]);
  const selectedIndex = lastResult?.selection?.selectedIndex ?? 0;
  const hasSelection = lastResult?.selection?.selectedIndex !== undefined;

  const OPTIMIZE_PRESETS = [
    { id: 'bullets', label: 'Kurz & präzise (Bullets)' },
    { id: 'detailed', label: 'Detailliert mit Quellen' },
    { id: 'steps', label: 'Schritte / Anleitung' },
    { id: 'risks', label: 'Risiken & Caveats' },
    { id: 'compare', label: 'Vergleich' },
    { id: 'custom', label: 'Custom' },
  ];

  if (!enabled) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground/50"
        disabled
        title="Web-Suche deaktiviert. Aktiviere sie in den Einstellungen."
      >
        <Globe className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setIsOpen(true)}
        title="Web-Suche (AI-powered)"
      >
        <Globe className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Web-Suche
              {useAI && <Sparkles className="h-4 w-4 text-primary" />}
            </DialogTitle>
            <DialogDescription>
              {useAI 
                ? 'AI-optimierte Suche mit automatischer Ergebnisauswahl und Inhaltsextraktion.'
                : 'Einfache Web-Suche ohne AI-Optimierung.'}
            </DialogDescription>
          </DialogHeader>

          {/* Search Input */}
          <div className="space-y-3 flex-shrink-0">
            <div className="flex gap-2">
              <Input
                placeholder={useAI ? "Stelle eine Frage..." : "Suchbegriff eingeben..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSearching}
                className="flex-1"
                autoFocus
              />
              <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* AI Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={useAI ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUseAI(!useAI)}
                disabled={isSearching}
                className="gap-2"
              >
                <Sparkles className="h-3 w-3" />
                AI-Optimierung {useAI ? 'An' : 'Aus'}
              </Button>
              <span className="text-xs text-muted-foreground">
                {useAI ? 'Modell: ' + model : 'Direkte SearXNG-Suche'}
              </span>
            </div>
          </div>

          {/* Progress Steps */}
          {isSearching && currentStep && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">{getStepLabel(currentStep)}</span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive flex-shrink-0">
              {error}
            </div>
          )}

          {/* Results - Scrollable Area */}
          {lastResult && !isSearching && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3">
              {/* Summary - Fixed */}
              <div className="flex items-center gap-2 text-sm flex-shrink-0 flex-wrap">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>
                  Suche abgeschlossen in {lastResult.durationMs}ms
                </span>
                {lastResult.search.instanceUsed && (
                  <span className="text-muted-foreground">
                    via {lastResult.search.instanceUsed === 'duckduckgo' ? 'DuckDuckGo' : 'localhost'}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    title={isExpanded ? 'Ansicht verkleinern' : 'Ansicht vergrößern'}
                  >
                    {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* View Toggle: Results vs Content + Optimization prompt presets */}
              {lastResult.search?.results?.length > 0 && (
                <div className="space-y-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === 'content' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('content')}
                      disabled={!hasSelection && !selectedIndices.length}
                      className="h-8"
                    >
                      Inhalt
                    </Button>
                    <Button
                      variant={viewMode === 'results' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('results')}
                      className="h-8"
                    >
                      Suchergebnisse
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Tipp: Klick wählt; „Kontext optimieren" fasst bis zu 5 Snippets zusammen.
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMergeSelected}
                        disabled={(!selectedIndices.length && typeof lastResult.selection?.selectedIndex !== 'number') || isSearching || isOptimizing}
                        className="h-8"
                      >
                        {isOptimizing ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Optimieren...
                          </span>
                        ) : (
                          <>Kontext optimieren ({selectedIndices.length || (typeof lastResult.selection?.selectedIndex === 'number' ? 1 : 0)}/5)</>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                      value={optPreset}
                      onChange={(e) => setOptPreset(e.target.value)}
                    >
                      {OPTIMIZE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={optPreset === 'custom' ? optCustom : ''}
                      onChange={(e) => setOptCustom(e.target.value)}
                      placeholder="Zusätzliche Anweisung (optional)"
                      disabled={optPreset !== 'custom'}
                      className="text-sm"
                    />
                  </div>
                  {optError && (
                    <div className="text-xs text-destructive">
                      {optError}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Result Card - Fixed */}
              {lastResult.selection && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 flex-shrink-0">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm truncate">{lastResult.selection.title}</h4>
                      <a
                        href={lastResult.selection.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                      >
                        {lastResult.selection.url}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                      {lastResult.selection.reason && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          Ausgewählt: {lastResult.selection.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Content Area - with Edit Toggle */}
              {viewMode === 'content' ? (
                lastResult.content?.content ? (
                  <div className="flex flex-col gap-2 flex-1 min-h-0">
                    {/* Edit Toggle */}
                    <div className="flex items-center justify-between flex-shrink-0">
                      <div className="text-xs text-muted-foreground">
                        {editedContent.length} Zeichen
                        {editedContent !== lastResult.content.content && (
                          <span className="text-primary ml-2">(bearbeitet)</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(!isEditing)}
                        className="gap-2 h-7"
                      >
                        {isEditing ? (
                          <>
                            <Eye className="h-3 w-3" />
                            Vorschau
                          </>
                        ) : (
                          <>
                            <Pencil className="h-3 w-3" />
                            Bearbeiten
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Content - Edit or Preview */}
                    {isEditing ? (
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="flex-1 min-h-[200px] text-sm font-mono resize-none"
                        style={{ maxHeight: contentMaxHeight }}
                        placeholder="Inhalt bearbeiten..."
                      />
                    ) : (
                      <div 
                        className="border rounded-lg overflow-y-auto bg-background/50"
                        style={{ maxHeight: contentMaxHeight }}
                      >
                        <div className="p-4">
                          <div className="space-y-3">
                            <div className="text-xs text-muted-foreground">
                              URL Source: {lastResult.content.url}
                            </div>
                            {(lastResult.content as { publishedTime?: string }).publishedTime && (
                              <div className="text-xs text-muted-foreground">
                                Published Time: {(lastResult.content as { publishedTime?: string }).publishedTime}
                              </div>
                            )}
                            <div className="border-t pt-3">
                              <div className="text-xs font-medium text-muted-foreground mb-2">Markdown Content:</div>
                              <div className="text-sm whitespace-pre-wrap break-words">
                                {editedContent.substring(0, 5000)}
                                {editedContent.length > 5000 && (
                                  <span className="text-muted-foreground">... (gekürzt in Vorschau)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : editedContent ? (
                  <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <div className="flex items-center justify-between flex-shrink-0">
                      <div className="text-xs text-muted-foreground">
                        {editedContent.length} Zeichen (zusammengefasster Kontext)
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(!isEditing)}
                        className="gap-2 h-7"
                      >
                        {isEditing ? (
                          <>
                            <Eye className="h-3 w-3" />
                            Vorschau
                          </>
                        ) : (
                          <>
                            <Pencil className="h-3 w-3" />
                            Bearbeiten
                          </>
                        )}
                      </Button>
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="flex-1 min-h-[200px] text-sm font-mono resize-none"
                        style={{ maxHeight: contentMaxHeight }}
                        placeholder="Inhalt bearbeiten..."
                      />
                    ) : (
                      <div
                        className="border rounded-lg overflow-y-auto bg-background/50"
                        style={{ maxHeight: contentMaxHeight }}
                      >
                        <div className="p-4">
                          <div className="space-y-3 text-sm whitespace-pre-wrap break-words">
                            {editedContent}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="border rounded-lg bg-background/50 p-4 flex flex-col gap-3"
                    style={{ maxHeight: contentMaxHeight, overflowY: 'auto' }}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-sm font-medium">Kein Volltext geladen</div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleReloadContent()}
                          disabled={isFetchingContent || isSearching || !hasSelection}
                          className="h-8"
                        >
                          {isFetchingContent ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Erneut laden'}
                        </Button>
                        {lastResult.selection?.url && (
                          <a
                            href={lastResult.selection.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            Im Browser öffnen
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Snippet-Fallback wird angezeigt. Nutze „Kontext optimieren" oben, um deine Auswahl (max 5) zusammenzufassen.
                    </div>
                    {error && (
                      <div className="text-xs text-destructive">
                        {error}
                      </div>
                    )}
                    {lastResult.search?.results?.[selectedIndex]?.content && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Snippet (Fallback):</div>
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {lastResult.search.results[selectedIndex].content}
                        </div>
                      </div>
                    )}
                    {!lastResult.search?.results?.[selectedIndex]?.content && (
                      <div className="text-xs text-muted-foreground">
                        Kein Snippet verfügbar. Bitte „Erneut laden“ oder im Browser öffnen.
                      </div>
                    )}
                  </div>
                )
              ) : viewMode === 'results' && lastResult.search.results.length > 0 ? (
                // Search results list (no editing)
                <div 
                  className="border rounded-lg overflow-y-auto bg-background/50"
                  style={{ maxHeight: contentMaxHeight }}
                >
                  <div className="p-4">
                    <div className="space-y-3">
                      {lastResult.search.results.slice(0, 5).map((result: SearchResult, index: number) => (
                        <div 
                          key={index}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleSelected(index)}
                          onDoubleClick={() => handleSelectResult(index)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleSelected(index);
                            }
                          }}
                          className={`p-3 rounded-lg border transition cursor-pointer ${
                            selectedIndices.includes(index)
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/60'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={selectedIndices.includes(index)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSelected(index);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                              aria-label={`Ergebnis ${index + 1} auswählen`}
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium">{result.title}</h4>
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                {result.url}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                                {result.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Keine Ergebnisse gefunden</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-row justify-between gap-2 flex-shrink-0 pt-2">
            <Button variant="outline" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleInsert} 
              disabled={!lastResult || isSearching || (!editedContent && !getFormattedResults())}
            >
              In Chat einfügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WebSearchButton;
