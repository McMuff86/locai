"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Search, X, MessageSquare, Calendar, ChevronRight } from 'lucide-react';
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

export function ChatSearch({
  conversations,
  onSelectConversation,
  onClose
}: ChatSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Search through conversation titles and tags
  const searchResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    for (const conversation of conversations) {
      let relevanceScore = 0;

      // Check title
      if (conversation.title.toLowerCase().includes(query)) {
        relevanceScore += 10;
      }

      // Check tags
      if (conversation.tags?.some(t => t.toLowerCase().includes(query))) {
        relevanceScore += 5;
      }

      if (relevanceScore > 0) {
        results.push({ conversation, relevanceScore });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [searchQuery, conversations]);

  const handleSelect = useCallback((conversationId: string) => {
    onSelectConversation(conversationId);
    setSearchQuery('');
    setIsExpanded(false);
    onClose?.();
  }, [onSelectConversation, onClose]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setIsExpanded(false);
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
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine Ergebnisse für &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div className="p-2">
                <p className="text-xs text-muted-foreground px-2 mb-2">
                  {searchResults.length} Konversation{searchResults.length !== 1 ? 'en' : ''} gefunden
                </p>

                {searchResults.map((result) => (
                  <div
                    key={result.conversation.id}
                    className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => handleSelect(result.conversation.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
                          {result.conversation.title}
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
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

export default ChatSearch;
