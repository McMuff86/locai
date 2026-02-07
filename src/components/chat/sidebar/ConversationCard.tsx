"use client";

import React, { useState } from 'react';
import { Conversation, MessageContent } from '../../../types/chat';
import { Button } from '../../ui/button';
import {
  Trash2,
  Image,
  BarChart2,
  Tag,
  Check,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { TagDisplay, TagInput } from '../../shared/TagInput';

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  onDelete: (conversationId: string) => void;
  onUpdateTags?: (conversationId: string, tags: string[]) => void;
  onTagFilterSelect?: (tag: string) => void;
  onToggleStats?: (conversationId: string) => void;
  showingStats?: boolean;
}

/** Extract preview text from message content */
function getTextFromContent(content: MessageContent): string {
  if (typeof content === 'string') {
    return content;
  }

  if (typeof content === 'object' && 'type' in content && content.type === 'image') {
    return '[Bild]';
  }

  if (Array.isArray(content)) {
    const textItem = content.find(
      (item): item is string => typeof item === 'string'
    );
    if (textItem) {
      return textItem;
    }
    if (
      content.some(
        (item) =>
          typeof item === 'object' && 'type' in item && item.type === 'image'
      )
    ) {
      return '[Bild]';
    }
  }

  return 'Inhalt';
}

/** Get a short preview from the last user message */
function getConversationPreview(conversation: Conversation): string {
  const lastUserMessage = [...conversation.messages]
    .reverse()
    .find((msg) => msg.role === 'user');

  if (lastUserMessage) {
    const previewText = getTextFromContent(lastUserMessage.content);
    return previewText.length > 50
      ? `${previewText.substring(0, 50)}...`
      : previewText;
  }

  return typeof conversation.title === 'string'
    ? conversation.title
    : 'Konversation';
}

/** Check if a conversation contains images */
function hasImages(conversation: Conversation): boolean {
  return conversation.messages.some((msg) => {
    const content = msg.content;

    if (
      typeof content === 'object' &&
      'type' in content &&
      content.type === 'image'
    ) {
      return true;
    }

    if (Array.isArray(content)) {
      return content.some(
        (item) =>
          typeof item === 'object' && 'type' in item && item.type === 'image'
      );
    }

    return false;
  });
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

  return (
    <div
      className={`p-2.5 rounded-lg cursor-pointer group transition-all duration-200 ${
        isActive
          ? 'bg-primary/10 border border-primary/20'
          : 'hover:bg-muted/50 border border-transparent'
      }`}
      onClick={() => onSelect(conversation)}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="font-medium text-sm truncate flex items-center gap-1.5">
            {hasImages(conversation) && (
              <Image className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            )}
            <span className="truncate">
              {typeof conversation.title === 'string'
                ? conversation.title
                : 'Bildkonversation'}
            </span>
          </div>

          {/* Preview */}
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {getConversationPreview(conversation)}
          </div>

          {/* Tags Display / Edit */}
          {editingTags ? (
            <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
              <TagInput
                tags={conversation.tags || []}
                onChange={(newTags) => {
                  onUpdateTags?.(conversation.id, newTags);
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
                  setEditingTags(false);
                }}
              >
                <Check className="h-3 w-3 mr-1" />
                Fertig
              </Button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1">
              {conversation.tags && conversation.tags.length > 0 && (
                <TagDisplay
                  tags={conversation.tags}
                  onClick={onTagFilterSelect}
                />
              )}
            </div>
          )}

          {/* Meta info */}
          <div className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
            <span>
              {conversation.messages.filter((m) => m.role !== 'system').length}{' '}
              Msg
            </span>
            <span>•</span>
            <span>
              {formatDistanceToNow(new Date(conversation.updatedAt), {
                addSuffix: false,
                locale: de,
              })}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
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
              <Tag
                className={`h-3 w-3 ${
                  editingTags
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              />
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
            <BarChart2
              className={`h-3 w-3 ${
                showingStats
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-primary'
              }`}
            />
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
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ConversationCard;
