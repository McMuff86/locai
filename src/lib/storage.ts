import { Conversation, MessageContent, MessageImageContent } from "../types/chat";

// Key for storing conversations in localStorage
const STORAGE_KEY = "locai-conversations";

// Maximum image size to store in localStorage (in bytes)
const MAX_IMAGE_SIZE = 200 * 1024; // 200KB

/**
 * Process message content to ensure it can be safely stored
 * - Replaces large inline images with placeholders
 * - Handles arrays and objects properly
 */
function isQuotaExceededError(error: unknown): boolean {
  const anyError = error as { name?: unknown; code?: unknown };

  const name = typeof anyError?.name === 'string' ? anyError.name : '';
  const code = typeof anyError?.code === "number" ? anyError.code : null;

  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}

function isDataImageUrl(url: string): boolean {
  return url.startsWith('data:image/');
}

function estimateDataUrlPayloadBytes(dataUrl: string): number | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;

  const meta = dataUrl.slice(0, commaIndex);
  const data = dataUrl.slice(commaIndex + 1);

  if (!meta.includes(';base64')) {
    return null;
  }

  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  const bytes = Math.floor((data.length * 3) / 4) - padding;
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : null;
}

function formatBytes(bytes: number): string {
  const kb = Math.ceil(bytes / 1024);
  return `${kb}KB`;
}

function buildImagePlaceholder(params: {
  reason: string;
  alt?: string;
  sizeBytes?: number | null;
}): string {
  const parts: string[] = [params.reason];
  if (typeof params.sizeBytes === "number" && params.sizeBytes > 0) {
    parts.push(formatBytes(params.sizeBytes));
  }
  if (params.alt) {
    parts.push(`alt: "${params.alt}"`);
  }
  return `[Bild nicht gespeichert: ${parts.join(", ")}]`;
}

function processImageContentForStorage(
  imageContent: MessageImageContent
): string | MessageImageContent {
  if (!isDataImageUrl(imageContent.url)) {
    return imageContent;
  }

  const payloadBytes = estimateDataUrlPayloadBytes(imageContent.url);
  const isTooLarge =
    (typeof payloadBytes === "number" && payloadBytes > MAX_IMAGE_SIZE) ||
    (payloadBytes === null && imageContent.url.length > MAX_IMAGE_SIZE);

  if (isTooLarge) {
    return buildImagePlaceholder({
      reason: 'zu groß für localStorage',
      alt: imageContent.alt,
      sizeBytes: payloadBytes,
    });
  }

  return imageContent;
}

function stripInlineImagesForQuota(content: MessageContent): MessageContent {
  if (typeof content === "string") return content;

  if (typeof content === "object" && "type" in content && content.type === "image") {
    const imageContent = content as MessageImageContent;

    if (!isDataImageUrl(imageContent.url)) {
      return imageContent;
    }

    const payloadBytes = estimateDataUrlPayloadBytes(imageContent.url);
    return buildImagePlaceholder({
      reason: 'localStorage-Quota erreicht',
      alt: imageContent.alt,
      sizeBytes: payloadBytes,
    });
  }

  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "string") return item;

      if (typeof item === "object" && "type" in item && item.type === "image") {
        const imageItem = item as MessageImageContent;

        if (!isDataImageUrl(imageItem.url)) {
          return imageItem;
        }

        const payloadBytes = estimateDataUrlPayloadBytes(imageItem.url);
        return buildImagePlaceholder({
          reason: 'localStorage-Quota erreicht',
          alt: imageItem.alt,
          sizeBytes: payloadBytes,
        });
      }

      return item;
    });
  }

  return content;
}

function processMessageContentForStorage(content: MessageContent): MessageContent {
  // If content is a string, no processing needed
  if (typeof content === 'string') {
    return content;
  }
  
  // If content is an image
  if (typeof content === 'object' && 'type' in content && content.type === 'image') {
    const imageContent = content as MessageImageContent;
    
    return processImageContentForStorage(imageContent);
  }
  
  // If content is an array, process each item
  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === 'string') {
        return item;
      }
      
      if (typeof item === 'object' && 'type' in item && item.type === 'image') {
        const imageItem = item as MessageImageContent;
        
        return processImageContentForStorage(imageItem);
      }
      
      return item;
    });
  }
  
  // Fallback for other types
  return content;
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

function stripInlineImagesFromConversationForQuota(conversation: Conversation): Conversation {
  return {
    ...conversation,
    title: typeof conversation.title === 'string' ? conversation.title : 'Bildkonversation',
    messages: conversation.messages.map((msg) => ({
      ...msg,
      content: stripInlineImagesForQuota(msg.content),
    })),
  };
}

function setConversationsWithQuotaFallback(conversations: Conversation[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      throw error;
    }

    try {
      const stripped = conversations.map(stripInlineImagesFromConversationForQuota);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
      return true;
    } catch (retryError) {
      console.error('Error saving conversations after quota fallback:', retryError);
      return false;
    }
  }
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
    
    const conversationsForStorage = conversations.map(processConversationForStorage);
    return setConversationsWithQuotaFallback(conversationsForStorage);
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
    
    const conversationsForStorage = filteredConversations.map(processConversationForStorage);
    return setConversationsWithQuotaFallback(conversationsForStorage);
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
        
        // @ts-expect-error - File System Access API not yet in TypeScript lib
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        return true;
      } catch (err) {
        console.error("Error with File System Access API:", err);
        // Check if user canceled the operation (AbortError)
        if (err instanceof Error && err.name === 'AbortError') {
          console.debug("User canceled file save operation");
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
        
        // @ts-expect-error - File System Access API not yet in TypeScript lib
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
        
        const conversationsForStorage = merged.map(processConversationForStorage);
        if (!setConversationsWithQuotaFallback(conversationsForStorage)) {
          return { success: false, count: 0 };
        }
        
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
          
          const conversationsForStorage = merged.map(processConversationForStorage);
          if (!setConversationsWithQuotaFallback(conversationsForStorage)) {
            resolve({ success: false, count: 0 });
            return;
          }
          
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
