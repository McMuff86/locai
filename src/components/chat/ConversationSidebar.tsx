"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ConversationSummary } from '../../lib/conversations/types';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import {
  Trash2,
  MessageSquare,
  PlusCircle,
  Download,
  Upload,
  Image,
  X,
  FileText,
  Tag,
  Filter,
  Check,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChatSearch } from './ChatSearch';
import { ComfyUIWidget } from '../ComfyUIWidget';
import { OllamaStatus } from '../OllamaStatus';
import { AppSettings } from '../../hooks/useSettings';
import { TagDisplay, TagInput } from '../shared/TagInput';
import { getTagColor } from '@/types/chat';

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onExportConversations?: () => void;
  onImportConversations?: () => void;
  onClearAllConversations?: () => void;
  onUpdateConversationTags?: (conversationId: string, tags: string[]) => void;
  settings?: AppSettings;
  onUpdateSettings?: (updates: Partial<AppSettings>) => void;
  onPullModel?: () => void;
  className?: string;
}

export function ConversationSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  onExportConversations,
  onImportConversations,
  onUpdateConversationTags,
  settings,
  onPullModel,
  className = ''
}: ConversationSidebarProps) {
  // Tag filtering and editing
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [showTagFilter, setShowTagFilter] = useState(false);

  // Get all unique tags from conversations
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    conversations.forEach(c => {
      c.tags?.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [conversations]);

  // Filter conversations by selected tag
  const filteredConversations = React.useMemo(() => {
    if (!selectedTagFilter) return conversations;
    return conversations.filter(c => c.tags?.includes(selectedTagFilter));
  }, [conversations, selectedTagFilter]);
  
  return (
    <div className={`flex flex-col h-full bg-sidebar ${className}`}>
      {/* Header Section */}
      <div className="p-4 space-y-3">
        {/* Brand/Logo */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-1">
            <img 
              src="/LocAI_logo_v0.2.svg" 
              alt="LocAI" 
              className="h-6 w-6 flex-shrink-0"
            />
            <span className="font-semibold text-base text-foreground truncate">LocAI</span>
          </div>
        </div>
        
        {/* New Conversation Button */}
        <Button 
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90" 
          onClick={onNewConversation}
        >
          <PlusCircle className="h-4 w-4" />
          Neuer Chat
        </Button>
        
        {/* Search */}
        <ChatSearch 
          conversations={conversations}
          onSelectConversation={onSelectConversation}
        />
      </div>
      
      {/* Ollama Status + Model Pull */}
      <div className="px-4 pb-2 space-y-2">
        <OllamaStatus showVersion compact={false} />
        
        {onPullModel && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={onPullModel}
          >
            <Download className="h-4 w-4 mr-2" />
            Modell herunterladen
          </Button>
        )}
      </div>
      
      {/* ComfyUI Widget - if settings available */}
      {settings && (
        <div className="px-4 pb-3 space-y-2">
          <ComfyUIWidget
            comfyUIPath={settings.comfyUIPath}
            comfyUIPort={settings.comfyUIPort}
            compact
          />
          
          {/* Gallery Link */}
          {settings.comfyUIOutputPath && (
            <Link href="/gallery">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
              >
                <Image className="h-4 w-4" />
                Bildergalerie
                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
              </Button>
            </Link>
          )}

          {/* Notes Link */}
          <Link href="/notes">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
            >
              <FileText className="h-4 w-4" />
              Notizen
              <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
            </Button>
          </Link>
        </div>
      )}
      
      {/* Section Label + Tag Filter */}
      <div className="px-4 py-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Chat-Verlauf
          </span>
          {allTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-xs gap-1 ${selectedTagFilter ? 'text-primary' : ''}`}
              onClick={() => setShowTagFilter(!showTagFilter)}
            >
              <Filter className="h-3 w-3" />
              {selectedTagFilter || 'Filter'}
            </Button>
          )}
        </div>
        
        {/* Tag Filter Dropdown */}
        {showTagFilter && allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-md border border-border/50">
            <button
              onClick={() => {
                setSelectedTagFilter(null);
                setShowTagFilter(false);
              }}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                !selectedTagFilter 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              Alle
            </button>
            {allTags.map(tag => {
              const colors = getTagColor(tag);
              const isSelected = selectedTagFilter === tag;
              return (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTagFilter(isSelected ? null : tag);
                    setShowTagFilter(false);
                  }}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors border ${
                    isSelected 
                      ? `${colors.bg} ${colors.text} ${colors.border}` 
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground border-transparent'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}
        
        {/* Active filter indicator */}
        {selectedTagFilter && !showTagFilter && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Gefiltert:</span>
            <button
              onClick={() => setSelectedTagFilter(null)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${getTagColor(selectedTagFilter).bg} ${getTagColor(selectedTagFilter).text} border ${getTagColor(selectedTagFilter).border}`}
            >
              {selectedTagFilter}
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      
      {/* Conversations List */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 pb-4">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {selectedTagFilter ? (
                <>
                  <p>Keine Chats mit Tag &quot;{selectedTagFilter}&quot;</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setSelectedTagFilter(null)}
                    className="mt-1"
                  >
                    Filter entfernen
                  </Button>
                </>
              ) : (
                <>
                  <p>Keine Chats vorhanden</p>
                  <p className="text-xs mt-1">Starte einen neuen Chat!</p>
                </>
              )}
            </div>
          ) : (
            filteredConversations.map(conversation => (
              <div
                key={conversation.id}
                className={`p-2.5 rounded-lg cursor-pointer group transition-all duration-200 ${
                  currentConversationId === conversation.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted/50 border border-transparent'
                }`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {typeof conversation.title === 'string' ? conversation.title : 'Bildkonversation'}
                    </div>

                    {/* Tags Display/Edit */}
                    {editingTagsFor === conversation.id ? (
                      <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <TagInput
                          tags={conversation.tags || []}
                          onChange={(newTags) => {
                            if (onUpdateConversationTags) {
                              onUpdateConversationTags(conversation.id, newTags);
                            }
                          }}
                          compact
                          maxTags={3}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 mt-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTagsFor(null);
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Fertig
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-1">
                        {conversation.tags && conversation.tags.length > 0 ? (
                          <TagDisplay
                            tags={conversation.tags}
                            onClick={(tag) => setSelectedTagFilter(tag)}
                          />
                        ) : null}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                      <span>{conversation.messageCount} Msg</span>
                      <span>&middot;</span>
                      <span>{formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: false, locale: de })}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                    {onUpdateConversationTags && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTagsFor(editingTagsFor === conversation.id ? null : conversation.id);
                        }}
                        title="Tags bearbeiten"
                      >
                        <Tag className={`h-3 w-3 ${editingTagsFor === conversation.id ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`} />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Chat "${conversation.title}" löschen?`)) {
                          onDeleteConversation(conversation.id);
                        }
                      }}
                      title="Löschen"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      {/* Bottom Section - Quick Actions */}
      <div className="border-t border-border bg-sidebar p-2 space-y-1">
        {/* Import/Export */}
        {onImportConversations && (
          <button
            onClick={onImportConversations}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
          >
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span>Chats importieren</span>
          </button>
        )}
        
        {onExportConversations && conversations.length > 0 && (
          <button
            onClick={onExportConversations}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            <span>Chats exportieren</span>
          </button>
        )}
      </div>
    </div>
  );
}
