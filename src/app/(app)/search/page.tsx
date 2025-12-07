"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  MessageSquare, 
  FileText, 
  Hash,
  ArrowRight,
  Loader2,
  User,
  Bot,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Link from 'next/link';
import { useSettings } from '@/hooks/useSettings';
import { getSavedConversations } from '@/lib/storage';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface MessageMatch {
  role: 'user' | 'assistant';
  content: string;
  matchIndex: number;
}

interface SearchResult {
  id: string;
  type: 'chat' | 'note';
  title: string;
  snippet: string;
  matchType: 'title' | 'content' | 'tag';
  tags?: string[];
  date?: string;
  // For chat results - show multiple message matches
  messageMatches?: MessageMatch[];
  totalMatches?: number;
}

export default function SearchPage() {
  const { settings, isLoaded } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'chat' | 'notes'>('all');
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [chatCount, setChatCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  
  // Set mounted and load chat count
  useEffect(() => {
    setMounted(true);
    setChatCount(getSavedConversations().length);
  }, []);
  
  // Toggle expanded state for a result
  const toggleExpanded = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  // Create snippet with context around match
  const createSnippet = (text: string, searchQuery: string, contextLength: number = 80): string => {
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return text.slice(0, 200) + (text.length > 200 ? '...' : '');
    
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + searchQuery.length + contextLength);
    
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    return snippet;
  };
  
  // Search function - improved
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }
    
    setIsSearching(true);
    const searchResults: SearchResult[] = [];
    const lowerQuery = searchQuery.toLowerCase();
    
    try {
      // Search Chats
      const conversations = getSavedConversations();
      
      for (const conv of conversations) {
        const matchedMessages: MessageMatch[] = [];
        let titleMatch = false;
        let tagMatch = false;
        
        // Check title match
        if (conv.title.toLowerCase().includes(lowerQuery)) {
          titleMatch = true;
        }
        
        // Check tag match
        if (conv.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) {
          tagMatch = true;
        }
        
        // Search ALL messages and collect matches
        conv.messages.forEach((msg, idx) => {
          if (msg.content && msg.content.toLowerCase().includes(lowerQuery)) {
            matchedMessages.push({
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              matchIndex: idx
            });
          }
        });
        
        // Add result if any match found
        if (titleMatch || tagMatch || matchedMessages.length > 0) {
          let snippet = '';
          let matchType: 'title' | 'content' | 'tag' = 'content';
          
          if (titleMatch) {
            matchType = 'title';
            // Show first user message as snippet
            const firstUserMsg = conv.messages.find(m => m.role === 'user');
            snippet = firstUserMsg?.content 
              ? createSnippet(firstUserMsg.content, searchQuery, 100)
              : 'Leerer Chat';
          } else if (matchedMessages.length > 0) {
            matchType = 'content';
            snippet = createSnippet(matchedMessages[0].content, searchQuery, 100);
          } else if (tagMatch) {
            matchType = 'tag';
            snippet = `Tags: ${conv.tags?.join(', ')}`;
          }
          
          searchResults.push({
            id: conv.id,
            type: 'chat',
            title: conv.title,
            snippet,
            matchType,
            tags: conv.tags,
            date: conv.updatedAt,
            messageMatches: matchedMessages.slice(0, 5), // Limit to 5 matches
            totalMatches: matchedMessages.length,
          });
        }
      }
      
      // Search Notes (if notesPath is set)
      if (settings?.notesPath) {
        try {
          const notesResponse = await fetch(
            `/api/notes/search?basePath=${encodeURIComponent(settings.notesPath)}&query=${encodeURIComponent(searchQuery)}`
          );
          const notesData = await notesResponse.json();
          
          if (notesData.success && notesData.results) {
            for (const note of notesData.results) {
              searchResults.push({
                id: note.noteId || note.id,
                type: 'note',
                title: note.title || 'Unbenannte Notiz',
                snippet: note.snippet || createSnippet(note.content || '', searchQuery, 100),
                matchType: note.matchType || 'content',
                tags: note.tags,
              });
            }
          }
        } catch (err) {
          console.error('Error searching notes:', err);
        }
      }
      
      // Sort by date (newest first) and relevance (title matches first)
      searchResults.sort((a, b) => {
        // Title matches first
        if (a.matchType === 'title' && b.matchType !== 'title') return -1;
        if (b.matchType === 'title' && a.matchType !== 'title') return 1;
        
        // Then by date
        if (a.date && b.date) {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        return 0;
      });
      
      setResults(searchResults);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [settings?.notesPath]);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, performSearch]);
  
  // Filter results by type
  const filteredResults = results.filter(r => {
    if (activeTab === 'all') return true;
    if (activeTab === 'chat') return r.type === 'chat';
    if (activeTab === 'notes') return r.type === 'note';
    return true;
  });
  
  const chatResults = results.filter(r => r.type === 'chat');
  const noteResults = results.filter(r => r.type === 'note');
  
  // Highlight matching text with better styling
  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) return text;
    try {
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      return text.replace(regex, '<mark class="bg-yellow-500/40 text-yellow-100 px-0.5 rounded font-medium">$1</mark>');
    } catch {
      return text;
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" />
            Unified Search
          </h1>
          <p className="text-muted-foreground">
            Durchsuche alle Chats und Notizen
          </p>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Suche in Chats und Notizen..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 h-14 text-lg bg-muted/30 border-2 focus:border-primary"
            autoFocus
          />
          {isSearching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />
          )}
        </div>
        
        {/* Results */}
        {query.length >= 2 && (
          <div className="space-y-4">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all" className="flex items-center gap-2 data-[state=active]:bg-background">
                  Alle
                  {results.length > 0 && (
                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                      {results.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="chat" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <MessageSquare className="h-4 w-4" />
                  Chats
                  {chatResults.length > 0 && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">
                      {chatResults.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <FileText className="h-4 w-4" />
                  Notizen
                  {noteResults.length > 0 && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">
                      {noteResults.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Results List */}
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-3 pr-4">
                {filteredResults.length === 0 && !isSearching ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Keine Ergebnisse für &quot;{query}&quot;</p>
                    <p className="text-sm mt-1">Versuche andere Suchbegriffe</p>
                  </div>
                ) : (
                  filteredResults.map((result) => {
                    const isExpanded = expandedResults.has(result.id);
                    const hasMultipleMatches = result.messageMatches && result.messageMatches.length > 1;
                    
                    return (
                      <div
                        key={`${result.type}-${result.id}`}
                        className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all"
                      >
                        <Link href={result.type === 'chat' ? `/chat?load=${result.id}` : `/notes?note=${result.id}`}>
                          <div className="p-4 group cursor-pointer hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                {/* Icon */}
                                <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                                  result.type === 'chat' 
                                    ? 'bg-blue-500/15 text-blue-500' 
                                    : 'bg-green-500/15 text-green-500'
                                }`}>
                                  {result.type === 'chat' ? (
                                    <MessageSquare className="h-5 w-5" />
                                  ) : (
                                    <FileText className="h-5 w-5" />
                                  )}
                                </div>
                                
                                {/* Content */}
                                <div className="min-w-0 flex-1 space-y-2">
                                  {/* Title Row */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 
                                      className="font-semibold text-base"
                                      dangerouslySetInnerHTML={{ 
                                        __html: highlightText(result.title, query) 
                                      }}
                                    />
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      result.matchType === 'title' 
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : result.matchType === 'tag'
                                        ? 'bg-purple-500/20 text-purple-400'
                                        : 'bg-muted text-muted-foreground'
                                    }`}>
                                      {result.matchType === 'title' ? 'Titel' : 
                                       result.matchType === 'tag' ? 'Tag' : 'Inhalt'}
                                    </span>
                                    {result.totalMatches && result.totalMatches > 1 && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                                        {result.totalMatches} Treffer
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Preview Snippet */}
                                  <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                                    <p 
                                      className="text-sm text-foreground/80 leading-relaxed"
                                      dangerouslySetInnerHTML={{ 
                                        __html: highlightText(result.snippet, query) 
                                      }}
                                    />
                                  </div>
                                  
                                  {/* Meta Row */}
                                  <div className="flex items-center gap-3 flex-wrap">
                                    {/* Tags */}
                                    {result.tags && result.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {result.tags.slice(0, 3).map((tag) => (
                                          <span 
                                            key={tag}
                                            className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full flex items-center gap-1"
                                          >
                                            <Hash className="h-2.5 w-2.5" />
                                            {tag}
                                          </span>
                                        ))}
                                        {result.tags.length > 3 && (
                                          <span className="text-xs text-muted-foreground">
                                            +{result.tags.length - 3}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Date */}
                                    {result.date && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDistanceToNow(new Date(result.date), { addSuffix: true, locale: de })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                            </div>
                          </div>
                        </Link>
                        
                        {/* Expandable Message Matches for Chats */}
                        {hasMultipleMatches && (
                          <>
                            <button
                              onClick={(e) => toggleExpanded(result.id, e)}
                              className="w-full px-4 py-2 border-t border-border bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4" />
                                  Weniger anzeigen
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4" />
                                  {result.messageMatches!.length - 1} weitere Treffer anzeigen
                                </>
                              )}
                            </button>
                            
                            {isExpanded && (
                              <div className="border-t border-border bg-muted/20 p-4 space-y-3">
                                {result.messageMatches!.slice(1).map((match, idx) => (
                                  <Link 
                                    key={idx}
                                    href={`/chat?load=${result.id}`}
                                    className="block"
                                  >
                                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                      <div className={`p-1.5 rounded-full flex-shrink-0 ${
                                        match.role === 'user' 
                                          ? 'bg-blue-500/20 text-blue-400' 
                                          : 'bg-primary/20 text-primary'
                                      }`}>
                                        {match.role === 'user' ? (
                                          <User className="h-3.5 w-3.5" />
                                        ) : (
                                          <Bot className="h-3.5 w-3.5" />
                                        )}
                                      </div>
                                      <p 
                                        className="text-sm text-muted-foreground leading-relaxed line-clamp-2"
                                        dangerouslySetInnerHTML={{ 
                                          __html: highlightText(createSnippet(match.content, query, 80), query) 
                                        }}
                                      />
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Initial State */}
        {query.length < 2 && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Search className="h-12 w-12 text-primary" />
            </div>
            <p className="text-xl font-medium text-foreground mb-2">Wonach suchst du?</p>
            <p className="text-sm">
              Durchsucht: Chat-Nachrichten, Notizen, Tags
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <span className="px-3 py-1.5 bg-muted rounded-full text-xs flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                {mounted ? chatCount : '...'} Chats
              </span>
              <span className="px-3 py-1.5 bg-muted rounded-full text-xs flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-green-400" />
                Notizen
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
