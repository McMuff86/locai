// ============================================================================
// Conversation Types
// ============================================================================

/** Lightweight summary for the conversations index (no messages) */
export interface ConversationSummary {
  id: string;
  title: string;
  tags?: string[];
  messageCount: number;
  createdAt: string;   // ISO-8601
  updatedAt: string;   // ISO-8601
}
