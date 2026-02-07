"use client";

import React from 'react';
import { Conversation } from '../../../types/chat';
import { ScrollArea } from '../../ui/scroll-area';
import { Button } from '../../ui/button';
import { MessageSquare, X } from 'lucide-react';
import { ConversationCard } from './ConversationCard';
import { ConversationStats } from '../ConversationStats';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  selectedTagFilter: string | null;
  showStatsForId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onUpdateConversationTags?: (conversationId: string, tags: string[]) => void;
  onTagFilterSelect: (tag: string) => void;
  onToggleStats: (conversationId: string) => void;
  onClearTagFilter: () => void;
}

export function ConversationList({
  conversations,
  currentConversationId,
  selectedTagFilter,
  showStatsForId,
  onSelectConversation,
  onDeleteConversation,
  onUpdateConversationTags,
  onTagFilterSelect,
  onToggleStats,
  onClearTagFilter,
}: ConversationListProps) {
  // Filter conversations by selected tag
  const filteredConversations = React.useMemo(() => {
    if (!selectedTagFilter) return conversations;
    return conversations.filter((c) => c.tags?.includes(selectedTagFilter));
  }, [conversations, selectedTagFilter]);

  // Resolve conversation for stats panel
  const statsConversation = showStatsForId
    ? conversations.find((c) => c.id === showStatsForId)
    : null;

  return (
    <>
      {/* Stats Panel (slide-in) */}
      {statsConversation && (
        <div className="border-y border-border bg-background/95 backdrop-blur mx-2 rounded-lg mb-2">
          <div className="flex items-center justify-between p-2 border-b border-border">
            <span className="text-sm font-medium">Statistiken</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onToggleStats(statsConversation.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-2">
            <ConversationStats conversation={statsConversation} />
          </div>
        </div>
      )}

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
                    onClick={onClearTagFilter}
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
            filteredConversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                isActive={currentConversationId === conversation.id}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
                onUpdateTags={onUpdateConversationTags}
                onTagFilterSelect={onTagFilterSelect}
                onToggleStats={onToggleStats}
                showingStats={showStatsForId === conversation.id}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}

export default ConversationList;
