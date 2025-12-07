"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Conversation, Message, MessageContent, MessageImageContent } from '../types/chat';
import { 
  getSavedConversations, 
  saveConversation as saveToStorage, 
  deleteConversation as deleteFromStorage,
  exportConversationsToFile,
  importConversationsFromFile,
  clearAllConversations as clearAllFromStorage
} from '../lib/storage';

export interface UseConversationsOptions {
  autoSave?: boolean;
  autoSaveDelay?: number; // Delay in ms before auto-saving (debounce)
}

export interface UseConversationsReturn {
  // Current conversation
  conversation: Conversation;
  setConversation: React.Dispatch<React.SetStateAction<Conversation>>;
  
  // Saved conversations
  savedConversations: Conversation[];
  
  // Actions
  createNewConversation: () => void;
  saveCurrentConversation: (generateTitle?: (conv: Conversation) => string) => boolean;
  deleteConversation: (id: string) => boolean;
  loadConversation: (conv: Conversation) => void;
  
  // Import/Export
  exportConversations: () => Promise<boolean>;
  importConversations: () => Promise<{ success: boolean; count: number }>;
  clearAllConversations: () => boolean;
  
  // Helpers
  addMessage: (message: Message) => void;
  updateConversationTitle: (title: string) => void;
  updateConversationTags: (conversationId: string, tags: string[]) => boolean;
  
  // Auto-save status
  isAutoSaveEnabled: boolean;
  lastAutoSave: Date | null;
}

function createEmptyConversation(): Conversation {
  return {
    id: uuidv4(),
    title: 'New Conversation',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// Generate title from first user message
function generateTitleFromConversation(conv: Conversation): string {
  if (conv.title !== "New Conversation" && !conv.title.startsWith("Chat with")) {
    return conv.title;
  }
  
  const firstUserMessage = conv.messages.find(msg => msg.role === 'user');
  if (firstUserMessage) {
    const content = firstUserMessage.content;
    
    if (typeof content === 'string') {
      return content.length > 40 ? `${content.substring(0, 40)}...` : content;
    } else if (Array.isArray(content)) {
      const firstText = content.find(item => typeof item === 'string');
      if (firstText && typeof firstText === 'string') {
        return firstText.length > 40 ? `${firstText.substring(0, 40)}...` : firstText;
      }
      return "Bildanalyse";
    }
    return "Bildanalyse";
  }
  return conv.title;
}

export function useConversations(options: UseConversationsOptions = {}): UseConversationsReturn {
  const { autoSave = true, autoSaveDelay = 1000 } = options;
  
  const [conversation, setConversation] = useState<Conversation>(createEmptyConversation);
  const [savedConversations, setSavedConversations] = useState<Conversation[]>([]);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadedConversationRef = useRef(false);

  // Load saved conversations on mount
  useEffect(() => {
    setSavedConversations(getSavedConversations());
  }, []);
  
  // Auto-save effect - triggers when conversation changes
  useEffect(() => {
    if (!autoSave) return;
    
    // Don't auto-save empty conversations or conversations with only system message
    const hasUserContent = conversation.messages.some(m => m.role === 'user' || m.role === 'assistant');
    if (!hasUserContent) return;
    
    // Clear previous timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for debounced auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      const conversationToSave = {
        ...conversation,
        updatedAt: new Date(),
        title: generateTitleFromConversation(conversation)
      };
      
      const success = saveToStorage(conversationToSave);
      if (success) {
        setSavedConversations(getSavedConversations());
        setLastAutoSave(new Date());
      }
    }, autoSaveDelay);
    
    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [conversation, autoSave, autoSaveDelay]);

  const createNewConversation = useCallback(() => {
    setConversation(createEmptyConversation());
  }, []);

  const saveCurrentConversation = useCallback((generateTitle?: (conv: Conversation) => string): boolean => {
    if (conversation.messages.length <= 1) {
      return false;
    }

    const conversationToSave = {
      ...conversation,
      updatedAt: new Date(),
      title: generateTitle ? generateTitle(conversation) : conversation.title
    };

    const success = saveToStorage(conversationToSave);
    if (success) {
      setSavedConversations(getSavedConversations());
    }
    return success;
  }, [conversation]);

  const deleteConversation = useCallback((id: string): boolean => {
    const success = deleteFromStorage(id);
    if (success) {
      setSavedConversations(getSavedConversations());
      
      // If deleting current conversation, create a new one
      if (conversation.id === id) {
        setConversation(createEmptyConversation());
      }
    }
    return success;
  }, [conversation.id]);

  const loadConversation = useCallback((conv: Conversation) => {
    // Deep copy with isLoaded flag
    const loadedConversation: Conversation = {
      ...conv,
      messages: conv.messages.map(msg => ({
        ...msg,
        isLoaded: true
      }))
    };
    setConversation(loadedConversation);
  }, []);

  const exportConversations = useCallback(async (): Promise<boolean> => {
    return exportConversationsToFile();
  }, []);

  const importConversations = useCallback(async (): Promise<{ success: boolean; count: number }> => {
    const result = await importConversationsFromFile();
    if (result.success) {
      setSavedConversations(getSavedConversations());
    }
    return result;
  }, []);

  const clearAllConversations = useCallback((): boolean => {
    const success = clearAllFromStorage();
    if (success) {
      setSavedConversations([]);
    }
    return success;
  }, []);

  // Add or update a message (upsert) - if message with same ID exists, update it
  const addMessage = useCallback((message: Message) => {
    setConversation(prev => {
      const existingIndex = prev.messages.findIndex(m => m.id === message.id);
      
      if (existingIndex >= 0) {
        // Update existing message
        const updatedMessages = [...prev.messages];
        updatedMessages[existingIndex] = message;
        return {
          ...prev,
          messages: updatedMessages,
          updatedAt: new Date()
        };
      } else {
        // Add new message
        return {
          ...prev,
          messages: [...prev.messages, message],
          updatedAt: new Date()
        };
      }
    });
  }, []);

  const updateConversationTitle = useCallback((title: string) => {
    setConversation(prev => ({
      ...prev,
      title,
      updatedAt: new Date()
    }));
  }, []);

  const updateConversationTags = useCallback((conversationId: string, tags: string[]): boolean => {
    // Find the conversation
    const convIndex = savedConversations.findIndex(c => c.id === conversationId);
    if (convIndex === -1) return false;
    
    // Update the conversation
    const updatedConversation = {
      ...savedConversations[convIndex],
      tags,
      updatedAt: new Date()
    };
    
    // Save to storage
    const success = saveToStorage(updatedConversation);
    if (success) {
      setSavedConversations(getSavedConversations());
      
      // Also update current conversation if it's the same
      if (conversation.id === conversationId) {
        setConversation(prev => ({ ...prev, tags }));
      }
    }
    return success;
  }, [savedConversations, conversation.id]);

  return {
    conversation,
    setConversation,
    savedConversations,
    createNewConversation,
    saveCurrentConversation,
    deleteConversation,
    loadConversation,
    exportConversations,
    importConversations,
    clearAllConversations,
    addMessage,
    updateConversationTitle,
    updateConversationTags,
    isAutoSaveEnabled: autoSave,
    lastAutoSave
  };
}

export default useConversations;

