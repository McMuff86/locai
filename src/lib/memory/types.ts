// ============================================================================
// Memory Types
// ============================================================================

export type MemoryCategory = 'fact' | 'preference' | 'project_context' | 'instruction';

/** Semantic memory type for the enhanced memory system */
export type MemoryType = 'conversation' | 'agent' | 'preference';

export interface MemoryEntry {
  id: string;
  key: string;           // Short identifier ("user_name", "coding_style")
  value: string;         // The actual information
  category: MemoryCategory;
  tags?: string[];
  source?: string;       // Conversation ID that produced this memory
  createdAt: string;     // ISO-8601
  updatedAt: string;     // ISO-8601
  /** Enhanced fields for semantic memory */
  type?: MemoryType;
  embedding?: number[];
  lastAccessedAt?: string; // ISO-8601, for prune logic
  metadata?: {
    source?: string;
    tags?: string[];
    model?: string;
    workflowId?: string;
    duration?: number;
    [key: string]: unknown;
  };
}

export interface MemoryStore {
  version: number;
  entries: MemoryEntry[];
}

export interface MemoryLogEvent {
  timestamp: string;     // ISO-8601
  action: 'create' | 'update' | 'delete' | 'prune';
  entryId: string;
  key: string;
  value?: string;
  category?: MemoryCategory;
}
