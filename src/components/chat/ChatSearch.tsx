"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Search, X, MessageSquare, Calendar, ChevronRight } from 'lucide-react';
import { Conversation, Message, MessageContent } from '../../types/chat';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface ChatSearchProps {
  conversations: Conversation[];
  onSelectConversation: (conversation: Conversation) => void;
  onClose?: () => void;
}

interface SearchResult {
  conversation: Conversation;
  matchingMessages: {
    message: Message;
    matchText: string;
    highlightedText: string;
  }[];
  relevanceScore: number;
}

// Extract text from message content
function getTextFromContent(content: MessageContent): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (typeof content === 'object' && 'type' in content && content.type === 'image') {
    return '';
  }
  
  if (Array.isArray(content)) {
    return content
      .filter(item => typeof item === 'string')
      .join(' ');
  }
  
  return '';
}

// Highlight search term in text
function highlightText(text: string, searchTerm: string): string {
  if (!searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '**$1**');
}

// Get excerpt around the match
function getExcerpt(text: string, searchTerm: string, maxLength: number = 100): string {
  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  const index = lowerText.indexOf(lowerSearch);
  
  if (index === -1) return text.slice(0, maxLength);
  
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + searchTerm.length + 70);
  
  let excerpt = text.slice(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';
  
  return excerpt;
}

export function ChatSearch({ 
  conversations, 
  onSelectConversation,
  onClose 
}: ChatSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Search through conversations
  const searchResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    for (const conversation of conversations) {
      const matchingMessages: SearchResult['matchingMessages'] = [];
      let relevanceScore = 0;

      // Check title
      if (conversation.title.toLowerCase().includes(query)) {
        relevanceScore += 10;
      }

      // Check messages
      for (const message of conversation.messages) {
        if (message.role === 'system') continue;
        
        const text = getTextFromContent(message.content);
        if (text.toLowerCase().includes(query)) {
          const excerpt = getExcerpt(text, searchQuery);
          const highlighted = highlightText(excerpt, searchQuery);
          
          matchingMessages.push({
            message,
            matchText: excerpt,
            highlightedText: highlighted
          });
          
          relevanceScore += message.role === 'user' ? 3 : 1;
        }
      }

      if (matchingMessages.length > 0 || relevanceScore > 0) {
        results.push({
          conversation,
          matchingMessages: matchingMessages.slice(0, 3), // Limit to 3 matches per conversation
          relevanceScore
        });
      }
    }

    // Sort by relevance
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [searchQuery, conversations]);

  const handleSelect = useCallback((conversation: Conversation) => {
    onSelectConversation(conversation);
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
                <p className="text-sm">Keine Ergebnisse für "{searchQuery}"</p>
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
                    onClick={() => handleSelect(result.conversation)}
                  >
                    {/* Conversation Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
                          {result.conversation.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {result.conversation.messages.filter(m => m.role !== 'system').length}
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
                    
                    {/* Matching Messages Preview */}
                    {result.matchingMessages.length > 0 && (
                      <div className="space-y-1.5 mt-2 pl-2 border-l-2 border-primary/30">
                        {result.matchingMessages.map((match, idx) => (
                          <div key={idx} className="text-xs">
                            <span className={`font-medium ${match.message.role === 'user' ? 'text-primary' : 'text-muted-foreground'}`}>
                              {match.message.role === 'user' ? 'Du: ' : 'AI: '}
                            </span>
                            <span 
                              className="text-muted-foreground"
                              dangerouslySetInnerHTML={{ 
                                __html: match.highlightedText
                                  .replace(/\*\*(.*?)\*\*/g, '<mark class="bg-primary/30 text-foreground px-0.5 rounded">$1</mark>')
                              }}
                            />
                          </div>
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

export default ChatSearch;

