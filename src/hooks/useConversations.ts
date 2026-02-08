"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Conversation, Message } from '../types/chat';
import { ConversationSummary } from '../lib/conversations/types';

export interface UseConversationsOptions {
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export interface UseConversationsReturn {
  // Current conversation
  conversation: Conversation;
  setConversation: React.Dispatch<React.SetStateAction<Conversation>>;

  // Saved conversations (lightweight summaries)
  savedConversations: ConversationSummary[];

  // Actions
  createNewConversation: () => void;
  saveCurrentConversation: (generateTitle?: (conv: Conversation) => string) => void;
  deleteConversation: (id: string) => void;
  loadConversation: (id: string) => Promise<void>;

  // Import/Export (client-side file dialogs, backed by server storage)
  exportConversations: () => Promise<boolean>;
  importConversations: () => Promise<{ success: boolean; count: number }>;
  clearAllConversations: () => Promise<boolean>;

  // Helpers
  addMessage: (message: Message) => void;
  updateConversationTitle: (title: string) => void;
  updateConversationTags: (conversationId: string, tags: string[]) => Promise<boolean>;

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

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchIndex(): Promise<ConversationSummary[]> {
  try {
    const res = await fetch('/api/conversations');
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations ?? [];
  } catch {
    return [];
  }
}

async function fetchConversation(id: string): Promise<Conversation | null> {
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const conv = await res.json();
    // Re-hydrate dates
    return {
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: (conv.messages ?? []).map((m: Message) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    };
  } catch {
    return null;
  }
}

async function apiSaveConversation(conversation: Conversation): Promise<boolean> {
  try {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiDeleteConversation(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/conversations?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiClearAll(): Promise<boolean> {
  try {
    const res = await fetch('/api/conversations?all=true', { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiUpdateMetadata(id: string, updates: { title?: string; tags?: string[] }): Promise<boolean> {
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useConversations(options: UseConversationsOptions = {}): UseConversationsReturn {
  const { autoSave = true, autoSaveDelay = 1000 } = options;

  const [conversation, setConversation] = useState<Conversation>(createEmptyConversation);
  const [savedConversations, setSavedConversations] = useState<ConversationSummary[]>([]);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load conversation index on mount
  useEffect(() => {
    fetchIndex().then(setSavedConversations);
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!autoSave) return;

    const hasUserContent = conversation.messages.some(m => m.role === 'user' || m.role === 'assistant');
    if (!hasUserContent) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      const conversationToSave = {
        ...conversation,
        updatedAt: new Date(),
        title: generateTitleFromConversation(conversation)
      };

      const success = await apiSaveConversation(conversationToSave);
      if (success) {
        const newIndex = await fetchIndex();
        setSavedConversations(newIndex);
        setLastAutoSave(new Date());
      }
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [conversation, autoSave, autoSaveDelay]);

  const createNewConversation = useCallback(() => {
    setConversation(createEmptyConversation());
  }, []);

  const saveCurrentConversation = useCallback(async (generateTitle?: (conv: Conversation) => string) => {
    if (conversation.messages.length <= 1) return;

    const conversationToSave = {
      ...conversation,
      updatedAt: new Date(),
      title: generateTitle ? generateTitle(conversation) : conversation.title
    };

    const success = await apiSaveConversation(conversationToSave);
    if (success) {
      const newIndex = await fetchIndex();
      setSavedConversations(newIndex);
    }
  }, [conversation]);

  const deleteConversation = useCallback(async (id: string) => {
    const success = await apiDeleteConversation(id);
    if (success) {
      const newIndex = await fetchIndex();
      setSavedConversations(newIndex);

      if (conversation.id === id) {
        setConversation(createEmptyConversation());
      }
    }
  }, [conversation.id]);

  const loadConversation = useCallback(async (id: string) => {
    const conv = await fetchConversation(id);
    if (!conv) return;

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
    try {
      // Fetch all full conversations
      const index = await fetchIndex();
      const conversations: Conversation[] = [];

      for (const summary of index) {
        const conv = await fetchConversation(summary.id);
        if (conv) conversations.push(conv);
      }

      if (conversations.length === 0) return false;

      const data = JSON.stringify(conversations, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const date = new Date().toISOString().split('T')[0];
      const filename = `locai-conversations-${date}.json`;

      if ('showSaveFilePicker' in window) {
        try {
          const opts = {
            suggestedName: filename,
            types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
          };
          // @ts-expect-error - File System Access API not yet in TypeScript lib
          const handle = await window.showSaveFilePicker(opts);
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return true;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return false;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      return true;
    } catch (error) {
      console.error("Error exporting conversations:", error);
      return false;
    }
  }, []);

  const importConversations = useCallback(async (): Promise<{ success: boolean; count: number }> => {
    try {
      if ('showOpenFilePicker' in window) {
        try {
          const opts = {
            types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
            multiple: false,
          };
          // @ts-expect-error - File System Access API not yet in TypeScript lib
          const [handle] = await window.showOpenFilePicker(opts);
          const file = await handle.getFile();
          const text = await file.text();
          const imported = JSON.parse(text) as Conversation[];

          if (!Array.isArray(imported)) throw new Error("Invalid file format");

          let importCount = 0;
          for (const conv of imported) {
            if (!conv.id || !conv.title || !Array.isArray(conv.messages)) continue;
            await apiSaveConversation(conv);
            importCount++;
          }

          const newIndex = await fetchIndex();
          setSavedConversations(newIndex);
          return { success: true, count: importCount };
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') throw err;
        }
      }

      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (event) => {
          try {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) { resolve({ success: false, count: 0 }); return; }

            const text = await file.text();
            const imported = JSON.parse(text) as Conversation[];
            if (!Array.isArray(imported)) throw new Error("Invalid file format");

            let importCount = 0;
            for (const conv of imported) {
              if (!conv.id || !conv.title || !Array.isArray(conv.messages)) continue;
              await apiSaveConversation(conv);
              importCount++;
            }

            const newIndex = await fetchIndex();
            setSavedConversations(newIndex);
            resolve({ success: true, count: importCount });
          } catch {
            resolve({ success: false, count: 0 });
          }
        };

        input.click();
      });
    } catch (error) {
      console.error("Error importing conversations:", error);
      return { success: false, count: 0 };
    }
  }, []);

  const clearAllConversations = useCallback(async (): Promise<boolean> => {
    const success = await apiClearAll();
    if (success) {
      setSavedConversations([]);
    }
    return success;
  }, []);

  const addMessage = useCallback((message: Message) => {
    setConversation(prev => {
      const existingIndex = prev.messages.findIndex(m => m.id === message.id);

      if (existingIndex >= 0) {
        const updatedMessages = [...prev.messages];
        updatedMessages[existingIndex] = message;
        return {
          ...prev,
          messages: updatedMessages,
          updatedAt: new Date()
        };
      } else {
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

  const updateConversationTags = useCallback(async (conversationId: string, tags: string[]): Promise<boolean> => {
    const success = await apiUpdateMetadata(conversationId, { tags });
    if (success) {
      const newIndex = await fetchIndex();
      setSavedConversations(newIndex);

      if (conversation.id === conversationId) {
        setConversation(prev => ({ ...prev, tags }));
      }
    }
    return success;
  }, [conversation.id]);

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
