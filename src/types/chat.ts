import React from 'react';
import type { DocumentSearchResult } from '@/lib/documents/types';
import type { AgentTurn, ToolCall } from '@/lib/agents/types';

export type MessageRole = 'user' | 'assistant' | 'system';

// Define simple message content types first
export interface MessageImageContent {
  type: 'image';
  url: string; // Base64 data URL or file URL
  alt?: string;
}

// Then define the union type for all possible content types
export type MessageContent = string | MessageImageContent | (string | MessageImageContent)[];

// Message interface
export interface Message {
  id: string;
  role: MessageRole;
  content: MessageContent;
  timestamp: Date;
  modelName?: string;
  isLoaded?: boolean;
  /** RAG source citations attached to this assistant message */
  ragSources?: DocumentSearchResult[];
  /** Tool calls requested by the model (agent mode) */
  toolCalls?: ToolCall[];
  /** Agent turns for this message (agent mode) */
  agentTurns?: AgentTurn[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Predefined tag colors for consistent styling
export const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Work & Projects
  'arbeit': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  'projekt': { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  'code': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'debug': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  
  // Topics
  'ai': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  'ml': { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
  'research': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'lernen': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  
  // Personal
  'privat': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
  'ideen': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'wichtig': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  'archiv': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
};

// Get color for a tag (with fallback)
export function getTagColor(tag: string): { bg: string; text: string; border: string } {
  const lowerTag = tag.toLowerCase();
  return TAG_COLORS[lowerTag] || { 
    bg: 'bg-primary/20', 
    text: 'text-primary', 
    border: 'border-primary/30' 
  };
}

export interface ChatInputProps {
  onSend: (message: string, images?: File[]) => void;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  // Web Search
  searxngUrl?: string;
  searxngEnabled?: boolean;
  ollamaHost?: string;
  selectedModel?: string;
  onWebSearchResults?: (formattedResults: string, query: string) => void;
}

export interface ChatMessageProps {
  message: Message;
  isLastMessage?: boolean;
}

export interface ChatContainerProps {
  conversation: Conversation;
  isLoading?: boolean;
} 