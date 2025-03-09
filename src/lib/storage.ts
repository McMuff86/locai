import { Conversation, Message, MessageContent, MessageImageContent } from "../types/chat";

// Key for storing conversations in localStorage
const STORAGE_KEY = "locai-conversations";

// Maximum image size to store in localStorage (in bytes)
const MAX_IMAGE_SIZE = 200 * 1024; // 200KB

/**
 * Process message content to ensure it can be safely stored
 * - Compresses large images
 * - Handles arrays and objects properly
 */
function processMessageContentForStorage(content: MessageContent): MessageContent {
  // If content is a string, no processing needed
  if (typeof content === 'string') {
    return content;
  }
  
  // If content is an image
  if (typeof content === 'object' && 'type' in content && content.type === 'image') {
    const imageContent = content as MessageImageContent;
    
    // Check if image is a data URL and needs compression
    if (imageContent.url.startsWith('data:image/') && imageContent.url.length > MAX_IMAGE_SIZE) {
      return {
        ...imageContent,
        url: compressImage(imageContent.url)
      };
    }
    
    return imageContent;
  }
  
  // If content is an array, process each item
  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === 'string') {
        return item;
      }
      
      if (typeof item === 'object' && 'type' in item && item.type === 'image') {
        const imageItem = item as MessageImageContent;
        
        // Check if image is a data URL and needs compression
        if (imageItem.url.startsWith('data:image/') && imageItem.url.length > MAX_IMAGE_SIZE) {
          return {
            ...imageItem,
            url: compressImage(imageItem.url)
          };
        }
        
        return imageItem;
      }
      
      return item;
    });
  }
  
  // Fallback for other types
  return content;
}

/**
 * Compress an image data URL to reduce its size
 */
function compressImage(dataUrl: string): string {
  try {
    // For now, just return a warning message - we'd implement real compression in production
    console.warn("Image compression would happen here in production");
    return dataUrl; // Return original for now
    
    // A real implementation would:
    // 1. Create an Image object from the data URL
    // 2. Draw it to a canvas at reduced dimensions
    // 3. Export from canvas at lower quality
    // 4. Return the new data URL
  } catch (error) {
    console.error("Error compressing image:", error);
    return dataUrl; // Return original on error
  }
}

/**
 * Process a conversation to ensure it can be safely stored
 */
function processConversationForStorage(conversation: Conversation): Conversation {
  return {
    ...conversation,
    // Ensure title is always a string
    title: typeof conversation.title === 'string' ? conversation.title : 'Bildkonversation',
    messages: conversation.messages.map(msg => ({
      ...msg,
      content: processMessageContentForStorage(msg.content)
    }))
  };
}

/**
 * Get all saved conversations from localStorage
 */
export function getSavedConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) return [];
    
    const conversations = JSON.parse(savedData) as Conversation[];
    
    // Convert date strings back to Date objects
    return conversations.map(convo => ({
      ...convo,
      createdAt: new Date(convo.createdAt),
      updatedAt: new Date(convo.updatedAt),
      messages: convo.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    }));
  } catch (error) {
    console.error("Error loading conversations:", error);
    return [];
  }
}

/**
 * Save a conversation to localStorage
 */
export function saveConversation(conversation: Conversation): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const conversations = getSavedConversations();
    
    // Pre-process conversation for storage (compress images, etc.)
    const processedConversation = processConversationForStorage(conversation);
    
    // Check if conversation already exists to update it
    const existingIndex = conversations.findIndex(c => c.id === conversation.id);
    
    if (existingIndex >= 0) {
      conversations[existingIndex] = processedConversation;
    } else {
      conversations.push(processedConversation);
    }
    
    // Sort by most recently updated
    conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    return true;
  } catch (error) {
    console.error("Error saving conversation:", error);
    return false;
  }
}

/**
 * Delete a conversation from localStorage
 */
export function deleteConversation(conversationId: string): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const conversations = getSavedConversations();
    const filteredConversations = conversations.filter(c => c.id !== conversationId);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredConversations));
    return true;
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return false;
  }
}

/**
 * Clear all conversations from localStorage
 */
export function clearAllConversations(): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Error clearing conversations:", error);
    return false;
  }
}

/**
 * Get a specific conversation by ID
 */
export function getConversationById(conversationId: string): Conversation | null {
  if (typeof window === "undefined") return null;
  
  try {
    const conversations = getSavedConversations();
    return conversations.find(c => c.id === conversationId) || null;
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return null;
  }
}

/**
 * Export all conversations as a JSON file
 */
export async function exportConversationsToFile(): Promise<boolean> {
  try {
    const conversations = getSavedConversations();
    if (conversations.length === 0) {
      return false;
    }
    
    const data = JSON.stringify(conversations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    
    // Create filename with date
    const date = new Date().toISOString().split('T')[0];
    const filename = `locai-conversations-${date}.json`;
    
    // Try to use the File System Access API if available
    if ('showSaveFilePicker' in window) {
      try {
        const opts = {
          suggestedName: filename,
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          }],
        };
        
        // @ts-ignore - TypeScript might not know about this API yet
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        return true;
      } catch (err) {
        console.error("Error with File System Access API:", err);
        // Check if user canceled the operation (AbortError)
        if (err instanceof Error && err.name === 'AbortError') {
          console.log("User canceled file save operation");
          return false;
        }
        // Otherwise fall back to download method
      }
    }
    
    // Create a URL for the blob (only if we're using the fallback method)
    const url = URL.createObjectURL(blob);
    
    // Ask user for confirmation before using fallback method
    if (!confirm('Möchten Sie die Konversationen herunterladen? Klicken Sie auf "Abbrechen", um den Export abzubrechen.')) {
      URL.revokeObjectURL(url);
      return false;
    }
    
    // Fallback: Download via anchor tag
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
    
    return true;
  } catch (error) {
    console.error("Error exporting conversations:", error);
    return false;
  }
}

/**
 * Import conversations from a JSON file
 */
export async function importConversationsFromFile(): Promise<{ success: boolean, count: number }> {
  try {
    // Try to use the File System Access API if available
    if ('showOpenFilePicker' in window) {
      try {
        const opts = {
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          }],
          multiple: false
        };
        
        // @ts-ignore - TypeScript might not know about this API yet
        const [handle] = await window.showOpenFilePicker(opts);
        const file = await handle.getFile();
        const text = await file.text();
        const importedConversations = JSON.parse(text) as Conversation[];
        
        // Validate imported data
        if (!Array.isArray(importedConversations)) {
          throw new Error("Invalid file format");
        }
        
        // Check each conversation has required properties
        for (const conv of importedConversations) {
          if (!conv.id || !conv.title || !Array.isArray(conv.messages)) {
            throw new Error("Invalid conversation format");
          }
        }
        
        // Merge with existing conversations, overwriting duplicates
        const existingConversations = getSavedConversations();
        const merged = [...existingConversations];
        
        let importCount = 0;
        
        for (const importedConv of importedConversations) {
          const existingIndex = merged.findIndex(c => c.id === importedConv.id);
          
          if (existingIndex >= 0) {
            merged[existingIndex] = importedConv;
          } else {
            merged.push(importedConv);
            importCount++;
          }
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        
        return { success: true, count: importCount };
      } catch (err) {
        console.error("Error with File System Access API:", err);
        // Fall back to input if user cancels or API fails
        if (err instanceof Error && err.name !== 'AbortError') {
          throw err;
        }
      }
    }
    
    // Fallback: Create an input element and prompt for file
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (event) => {
        try {
          const target = event.target as HTMLInputElement;
          const file = target.files?.[0];
          
          if (!file) {
            resolve({ success: false, count: 0 });
            return;
          }
          
          const text = await file.text();
          const importedConversations = JSON.parse(text) as Conversation[];
          
          // Validate imported data
          if (!Array.isArray(importedConversations)) {
            throw new Error("Invalid file format");
          }
          
          // Merge with existing conversations, overwriting duplicates
          const existingConversations = getSavedConversations();
          const merged = [...existingConversations];
          
          let importCount = 0;
          
          for (const importedConv of importedConversations) {
            const existingIndex = merged.findIndex(c => c.id === importedConv.id);
            
            if (existingIndex >= 0) {
              merged[existingIndex] = importedConv;
            } else {
              merged.push(importedConv);
              importCount++;
            }
          }
          
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          
          resolve({ success: true, count: importCount });
        } catch (error) {
          console.error("Error importing conversations:", error);
          resolve({ success: false, count: 0 });
        }
      };
      
      input.click();
    });
  } catch (error) {
    console.error("Error importing conversations:", error);
    return { success: false, count: 0 };
  }
} 