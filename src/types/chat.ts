export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatInputProps {
  onSend: (message: string) => void;
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