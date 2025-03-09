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
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatInputProps {
  onSend: (message: string, images?: File[]) => void;
  disabled?: boolean;
}

export interface ChatMessageProps {
  message: Message;
  isLastMessage?: boolean;
}

export interface ChatContainerProps {
  conversation: Conversation;
  isLoading?: boolean;
} 