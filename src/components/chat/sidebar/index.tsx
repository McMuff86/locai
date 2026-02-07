"use client";

import React, { useState } from 'react';
import { Conversation } from '../../../types/chat';
import { SidebarHeader } from './SidebarHeader';
import { TagFilter } from './TagFilter';
import { ConversationList } from './ConversationList';

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onUpdateConversationTags?: (conversationId: string, tags: string[]) => void;
  className?: string;
}

export function ConversationSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  onUpdateConversationTags,
  className = '',
}: ConversationSidebarProps) {
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [showStatsForId, setShowStatsForId] = useState<string | null>(null);

  const handleToggleStats = (conversationId: string) => {
    setShowStatsForId((prev) => (prev === conversationId ? null : conversationId));
  };

  return (
    <div className={`flex flex-col h-full bg-sidebar ${className}`}>
      {/* Header: Logo, New Chat, Search */}
      <SidebarHeader
        conversations={conversations}
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
      />

      {/* Tag Filter */}
      <TagFilter
        conversations={conversations}
        selectedTag={selectedTagFilter}
        onSelectTag={setSelectedTagFilter}
      />

      {/* Conversation List */}
      <ConversationList
        conversations={conversations}
        currentConversationId={currentConversationId}
        selectedTagFilter={selectedTagFilter}
        showStatsForId={showStatsForId}
        onSelectConversation={onSelectConversation}
        onDeleteConversation={onDeleteConversation}
        onUpdateConversationTags={onUpdateConversationTags}
        onTagFilterSelect={(tag) => setSelectedTagFilter(tag)}
        onToggleStats={handleToggleStats}
        onClearTagFilter={() => setSelectedTagFilter(null)}
      />
    </div>
  );
}

export default ConversationSidebar;
