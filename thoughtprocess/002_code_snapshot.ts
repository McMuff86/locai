// storage.ts - Konversationsspeicherung, Import, Export und Verwaltung

import { Conversation } from "../types/chat";

// Key für Speicherung im localStorage
const STORAGE_KEY = "locai-conversations";

/**
 * Alle gespeicherten Konversationen aus localStorage abrufen
 */
export function getSavedConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) return [];
    
    const conversations = JSON.parse(savedData) as Conversation[];
    
    // Datumsstrings zurück in Date-Objekte konvertieren
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
 * Konversation in localStorage speichern
 */
export function saveConversation(conversation: Conversation): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const conversations = getSavedConversations();
    const existingIndex = conversations.findIndex(c => c.id === conversation.id);
    
    if (existingIndex >= 0) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.push(conversation);
    }
    
    // Nach aktuellster Aktualisierung sortieren
    conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    return true;
  } catch (error) {
    console.error("Error saving conversation:", error);
    return false;
  }
}

/**
 * Konversation aus localStorage löschen
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
 * Alle Konversationen aus localStorage löschen
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
 * Alle Konversationen als JSON-Datei exportieren
 */
export async function exportConversationsToFile(): Promise<boolean> {
  try {
    const conversations = getSavedConversations();
    if (conversations.length === 0) {
      return false;
    }
    
    const data = JSON.stringify(conversations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    
    // Dateiname mit Datum erstellen
    const date = new Date().toISOString().split('T')[0];
    const filename = `locai-conversations-${date}.json`;
    
    // File System Access API verwenden, wenn verfügbar
    if ('showSaveFilePicker' in window) {
      try {
        const opts = {
          suggestedName: filename,
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          }],
        };
        
        // @ts-ignore - TypeScript kennt diese API möglicherweise noch nicht
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        return true;
      } catch (err) {
        console.error("Error with File System Access API:", err);
        // Prüfen, ob Benutzer den Vorgang abgebrochen hat (AbortError)
        if (err instanceof Error && err.name === 'AbortError') {
          console.log("User canceled file save operation");
          return false;
        }
        // Andernfalls auf Download-Methode zurückgreifen
      }
    }
    
    // URL für den Blob erstellen (nur wenn wir die Fallback-Methode verwenden)
    const url = URL.createObjectURL(blob);
    
    // Benutzerbestätigung vor Verwendung der Fallback-Methode einholen
    if (!confirm('Möchten Sie die Konversationen herunterladen? Klicken Sie auf "Abbrechen", um den Export abzubrechen.')) {
      URL.revokeObjectURL(url);
      return false;
    }
    
    // Fallback: Download über Anker-Tag
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Aufräumen
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
 * Konversationen aus JSON-Datei importieren
 */
export async function importConversationsFromFile(): Promise<{ success: boolean, count: number }> {
  try {
    // File System Access API verwenden, wenn verfügbar
    if ('showOpenFilePicker' in window) {
      try {
        const opts = {
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          }],
          multiple: false
        };
        
        // @ts-ignore - TypeScript kennt diese API möglicherweise noch nicht
        const [handle] = await window.showOpenFilePicker(opts);
        const file = await handle.getFile();
        const text = await file.text();
        const importedConversations = JSON.parse(text) as Conversation[];
        
        // Importierte Daten validieren
        if (!Array.isArray(importedConversations)) {
          throw new Error("Invalid file format");
        }
        
        // Mit vorhandenen Konversationen zusammenführen, Duplikate überschreiben
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
        // Bei Abbruch oder API-Fehler auf Input zurückgreifen
        if (err instanceof Error && err.name !== 'AbortError') {
          throw err;
        }
      }
    }
    
    // Fallback-Methode für Browser ohne File System Access API
    // Implementierung mit file input Element
    return { success: false, count: 0 };
  } catch (error) {
    console.error("Error importing conversations:", error);
    return { success: false, count: 0 };
  }
} 