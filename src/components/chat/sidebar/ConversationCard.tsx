"use client";

import React, { useState } from 'react';
import { ConversationSummary } from '../../../lib/conversations/types';
import { Button } from '../../ui/button';
import {
  Trash2,
  BarChart2,
  Tag,
  Check,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { TagDisplay, TagInput } from '../../shared/TagInput';

interface ConversationCardProps {
  conversation: ConversationSummary;
  isActive: boolean;
  onSelect: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
  onUpdateTags?: (conversationId: string, tags: string[]) => void;
  onTagFilterSelect?: (tag: string) => void;
  onToggleStats?: (conversationId: string) => void;
  showingStats?: boolean;
}

export function ConversationCard({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onUpdateTags,
  onTagFilterSelect,
  onToggleStats,
  showingStats = false,
}: ConversationCardProps) {
  const [editingTags, setEditingTags] = useState(false);

  const messageCount = conversation.messageCount;
  const timeAgo = formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: false, locale: de });

  return (
    <div
      className={`px-3 py-2.5 rounded-lg cursor-pointer group transition-all duration-150 ${
        isActive
          ? 'bg-primary/8 border border-primary/20 shadow-sm shadow-primary/5'
          : 'hover:bg-muted/40 border border-transparent'
      }`}
      onClick={() => onSelect(conversation.id)}
    >
      {/* Row 1: Title + time */}
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm truncate flex items-center gap-1.5 min-w-0">
          <span className="truncate">
            {typeof conversation.title === 'string' ? conversation.title : 'Bildkonversation'}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
          {timeAgo}
        </span>
      </div>

      {/* Row 2: Message count */}
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <p className="text-xs text-muted-foreground/80 truncate">
          {messageCount} Nachrichten
        </p>
      </div>

      {/* Row 3: Tags (compact pills) */}
      {editingTags ? (
        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
          <TagInput
            tags={conversation.tags || []}
            onChange={(newTags) => onUpdateTags?.(conversation.id, newTags)}
            compact
            maxTags={3}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-1.5 mt-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setEditingTags(false);
            }}
          >
            <Check className="h-3 w-3 mr-1" />
            Fertig
          </Button>
        </div>
      ) : (
        conversation.tags && conversation.tags.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1">
            <TagDisplay tags={conversation.tags} onClick={onTagFilterSelect} />
          </div>
        )
      )}

      {/* Action buttons – only visible on hover */}
      <div className="flex items-center gap-0.5 mt-1.5 h-6 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {onUpdateTags && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setEditingTags(!editingTags);
            }}
            title="Tags bearbeiten"
          >
            <Tag className={`h-3 w-3 ${editingTags ? 'text-primary' : 'text-muted-foreground/70 hover:text-primary'}`} />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStats?.(conversation.id);
          }}
          title="Statistiken"
        >
          <BarChart2 className={`h-3 w-3 ${showingStats ? 'text-primary' : 'text-muted-foreground/70 hover:text-primary'}`} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Chat "${conversation.title}" löschen?`)) {
              onDelete(conversation.id);
            }
          }}
          title="Löschen"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground/70 hover:text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export default ConversationCard;
