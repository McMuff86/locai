"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Search, Globe, Loader2, ExternalLink, Sparkles, FileText, CheckCircle2, Pencil, Eye } from 'lucide-react';
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
import { useWebSearch, getStepLabel } from '@/hooks/useWebSearch';

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

  const { 
    search,
    simpleSearch,
    isSearching, 
    currentStep,
    error, 
    lastResult, 
    clearResults,
    getFormattedResults 
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
    }
  }, [lastResult]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setEditedContent('');
    setIsEditing(false);
    
    if (useAI) {
      await search(query);
    } else {
      await simpleSearch(query);
    }
  }, [query, useAI, search, simpleSearch]);

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
      const content = editedContent || lastResult.content?.content || '';
      
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
    clearResults();
  };

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
              </div>

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
              {lastResult.content?.content ? (
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
                      className="flex-1 min-h-[200px] max-h-[280px] text-sm font-mono resize-none"
                      placeholder="Inhalt bearbeiten..."
                    />
                  ) : (
                    <div 
                      className="border rounded-lg overflow-y-auto bg-background/50"
                      style={{ maxHeight: '280px' }}
                    >
                      <div className="p-4">
                        <div className="space-y-3">
                          <div className="text-xs text-muted-foreground">
                            URL Source: {lastResult.content.url}
                          </div>
                          {lastResult.content.publishedTime && (
                            <div className="text-xs text-muted-foreground">
                              Published Time: {lastResult.content.publishedTime}
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
              ) : lastResult.search.results.length > 0 ? (
                // Search results list (no editing)
                <div 
                  className="border rounded-lg overflow-y-auto bg-background/50"
                  style={{ maxHeight: '280px' }}
                >
                  <div className="p-4">
                    <div className="space-y-3">
                      {lastResult.search.results.slice(0, 5).map((result, index) => (
                        <div 
                          key={index}
                          className={`p-3 rounded-lg border ${
                            lastResult.selection?.selectedIndex === index
                              ? 'border-primary bg-primary/5'
                              : 'border-border'
                          }`}
                        >
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
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {result.content}
                          </p>
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
