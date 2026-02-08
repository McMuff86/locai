"use client";

import React, { useState, useEffect } from 'react';
import { ConversationSummary } from '../../../lib/conversations/types';
import { Conversation } from '../../../types/chat';
import { ScrollArea } from '../../ui/scroll-area';
import { Button } from '../../ui/button';
import { MessageSquare, X, Loader2 } from 'lucide-react';
import { ConversationCard } from './ConversationCard';
import { ConversationStats } from '../ConversationStats';

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
  showStatsForId,
  onSelectConversation,
  onDeleteConversation,
  onUpdateConversationTags,
  onTagFilterSelect,
  onToggleStats,
  onClearTagFilter,
}: ConversationListProps) {
  const [statsConversation, setStatsConversation] = useState<Conversation | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch full conversation when showStatsForId changes
  useEffect(() => {
    if (!showStatsForId) {
      setStatsConversation(null);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);

    fetch(`/api/conversations/${showStatsForId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data) {
          setStatsConversation(data as Conversation);
        }
      })
      .catch(() => {
        // Silently fail
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => { cancelled = true; };
  }, [showStatsForId]);

  // Filter conversations by selected tag
  const filteredConversations = React.useMemo(() => {
    if (!selectedTagFilter) return conversations;
    return conversations.filter((c) => c.tags?.includes(selectedTagFilter));
  }, [conversations, selectedTagFilter]);

  return (
    <>
      {/* Stats Panel (slide-in above conversation list) */}
      {showStatsForId && (
        <div className="px-2 pb-2 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Statistiken
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onToggleStats(showStatsForId)}
              title="Schliessen"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          {statsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : statsConversation ? (
            <ConversationStats conversation={statsConversation} compact={false} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              Statistiken konnten nicht geladen werden.
            </p>
          )}
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
                showingStats={showStatsForId === conversation.id}
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
