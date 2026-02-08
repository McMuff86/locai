"use client";

import React from 'react';
import { ConversationSummary } from '../../../lib/conversations/types';
import { ScrollArea } from '../../ui/scroll-area';
import { Button } from '../../ui/button';
import { MessageSquare } from 'lucide-react';
import { ConversationCard } from './ConversationCard';

interface ConversationListProps {
  conversations: ConversationSummary[];
  currentConversationId: string | null;
  selectedTagFilter: string | null;
  showStatsForId: string | null;
  onSelectConversation: (conversationId: string) => void;
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

  return (
    <>
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
              />
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}

export default ConversationList;
