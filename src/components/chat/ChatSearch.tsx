"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Search, X, MessageSquare, Calendar, ChevronRight, Loader2, User, Bot } from 'lucide-react';
import { ConversationSummary } from '../../lib/conversations/types';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface ChatSearchProps {
  conversations: ConversationSummary[];
  onSelectConversation: (conversationId: string) => void;
  onClose?: () => void;
}

interface SearchResult {
  conversation: ConversationSummary;
  relevanceScore: number;
}

interface MessageSearchMatch {
  role: 'user' | 'assistant';
  excerpt: string;
}

interface MessageSearchResult {
  conversationId: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  matches: MessageSearchMatch[];
}

/** Highlight search term in text */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const parts: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let idx = lowerText.indexOf(lowerQuery, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    parts.push(
      <mark key={idx} className="bg-primary/30 text-foreground rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    lastIndex = idx + query.length;
    idx = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

export function ChatSearch({
  conversations,
  onSelectConversation,
  onClose
}: ChatSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [messageResults, setMessageResults] = useState<MessageSearchResult[]>([]);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Instant client-side title/tag search
  const titleResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    for (const conversation of conversations) {
      let relevanceScore = 0;

      if (conversation.title.toLowerCase().includes(query)) {
        relevanceScore += 10;
      }

      if (conversation.tags?.some(t => t.toLowerCase().includes(query))) {
        relevanceScore += 5;
      }

      if (relevanceScore > 0) {
        results.push({ conversation, relevanceScore });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [searchQuery, conversations]);

  // Debounced server-side message search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchQuery.trim() || searchQuery.length < 2) {
      setMessageResults([]);
      setIsSearchingMessages(false);
      return;
    }

    setIsSearchingMessages(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          setMessageResults(data.results || []);
        }
      } catch {
        // Silently fail - title search still works
      } finally {
        setIsSearchingMessages(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  // Filter message results to exclude conversations already shown in title results
  const filteredMessageResults = useMemo(() => {
    const titleIds = new Set(titleResults.map(r => r.conversation.id));
    return messageResults.filter(r => !titleIds.has(r.conversationId));
  }, [messageResults, titleResults]);

  const totalResults = titleResults.length + filteredMessageResults.length;

  const handleSelect = useCallback((conversationId: string) => {
    onSelectConversation(conversationId);
    setSearchQuery('');
    setIsExpanded(false);
    onClose?.();
  }, [onSelectConversation, onClose]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setIsExpanded(false);
    setMessageResults([]);
  }, []);

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Konversationen durchsuchen..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsExpanded(e.target.value.length >= 2);
          }}
          onFocus={() => searchQuery.length >= 2 && setIsExpanded(true)}
          className="pl-10 pr-10 bg-muted/30 border-muted focus:bg-background"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={clearSearch}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isExpanded && searchQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <ScrollArea className="max-h-[400px]">
            {totalResults === 0 && !isSearchingMessages ? (
              <div className="p-4 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine Ergebnisse für &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div className="p-2">
                <div className="flex items-center justify-between px-2 mb-2">
                  <p className="text-xs text-muted-foreground">
                    {totalResults} Ergebnis{totalResults !== 1 ? 'se' : ''} gefunden
                  </p>
                  {isSearchingMessages && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Title/Tag matches */}
                {titleResults.map((result) => (
                  <div
                    key={result.conversation.id}
                    className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => handleSelect(result.conversation.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
                          {highlightText(result.conversation.title, searchQuery)}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {result.conversation.messageCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(result.conversation.updatedAt), {
                              addSuffix: true,
                              locale: de
                            })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}

                {/* Message content matches */}
                {filteredMessageResults.length > 0 && (
                  <>
                    {titleResults.length > 0 && (
                      <div className="px-2 py-1.5 mt-1">
                        <p className="text-xs text-muted-foreground/70 uppercase tracking-wide">
                          Nachrichten
                        </p>
                      </div>
                    )}
                    {filteredMessageResults.map((result) => (
                      <div
                        key={result.conversationId}
                        className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                        onClick={() => handleSelect(result.conversationId)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
                              {result.title}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {result.messageCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDistanceToNow(new Date(result.updatedAt), {
                                  addSuffix: true,
                                  locale: de
                                })}
                              </span>
                            </div>
                            {/* Message excerpts */}
                            <div className="mt-1.5 space-y-1">
                              {result.matches.map((match, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-xs">
                                  {match.role === 'user' ? (
                                    <User className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <Bot className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  )}
                                  <span className="text-muted-foreground/80 line-clamp-2">
                                    {highlightText(match.excerpt, searchQuery)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Loading indicator when still searching */}
                {isSearchingMessages && totalResults === 0 && (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin opacity-50" />
                    <p className="text-sm">Nachrichten durchsuchen...</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

export default ChatSearch;
