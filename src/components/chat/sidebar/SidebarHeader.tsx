"use client";

import React from 'react';
import { Button } from '../../ui/button';
import { PlusCircle } from 'lucide-react';
import { ChatSearch } from '../ChatSearch';
import { Conversation } from '../../../types/chat';

interface SidebarHeaderProps {
  conversations: Conversation[];
  onSelectConversation: (conversation: Conversation) => void;
  onNewConversation: () => void;
}

export function SidebarHeader({
  conversations,
  onSelectConversation,
  onNewConversation,
}: SidebarHeaderProps) {
  return (
    <div className="p-4 space-y-3">
      {/* Brand/Logo */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 px-1">
          <img
            src="/LocAI_logo_v0.2.svg"
            alt="LocAI"
            className="h-6 w-6 flex-shrink-0"
          />
          <span className="font-semibold text-base text-foreground truncate">
            LocAI
          </span>
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
  );
}

export default SidebarHeader;
