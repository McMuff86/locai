// ============================================================================
// Memory Types
// ============================================================================

export type MemoryCategory = 'fact' | 'preference' | 'project_context' | 'instruction';

export interface MemoryEntry {
  id: string;
  key: string;           // Short identifier ("user_name", "coding_style")
  value: string;         // The actual information
  category: MemoryCategory;
  tags?: string[];
  source?: string;       // Conversation ID that produced this memory
  createdAt: string;     // ISO-8601
  updatedAt: string;     // ISO-8601
}

export interface MemoryStore {
  version: number;
  entries: MemoryEntry[];
}

export interface MemoryLogEvent {
  timestamp: string;     // ISO-8601
  action: 'create' | 'update' | 'delete';
  entryId: string;
  key: string;
  value?: string;
  category?: MemoryCategory;
}
