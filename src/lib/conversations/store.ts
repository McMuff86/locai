// ============================================================================
// Conversation Store
// ============================================================================
// Filesystem CRUD for conversations (pattern from lib/documents/store.ts).
// Stores a lightweight index + individual conversation JSON files.
// ============================================================================

import path from 'path';
import { promises as fs } from 'fs';
import { Conversation } from '@/types/chat';
import { ConversationSummary } from './types';
import { processMessageContentForStorage, MAX_IMAGE_SIZE_FS } from '../storage-utils';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function defaultBasePath(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '/tmp';
  return path.join(home, '.locai', 'conversations');
}

function indexFilePath(basePath: string): string {
  return path.join(basePath, 'conversations-index.json');
}

function conversationFilePath(basePath: string, id: string): string {
  return path.join(basePath, `${id}.json`);
}

async function ensureDir(basePath: string): Promise<void> {
  await fs.mkdir(basePath, { recursive: true });
}

// ---------------------------------------------------------------------------
// Index operations
// ---------------------------------------------------------------------------

export async function loadIndex(basePath?: string): Promise<ConversationSummary[]> {
  const dir = basePath || defaultBasePath();
  const filePath = indexFilePath(dir);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ConversationSummary[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error('[ConvStore] Failed to load index:', err);
    return [];
  }
}

async function saveIndex(basePath: string, index: ConversationSummary[]): Promise<void> {
  await ensureDir(basePath);
  const filePath = indexFilePath(basePath);
  await fs.writeFile(filePath, JSON.stringify(index, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Build summary from full conversation
// ---------------------------------------------------------------------------

function buildSummary(conv: Conversation): ConversationSummary {
  return {
    id: conv.id,
    title: typeof conv.title === 'string' ? conv.title : 'Conversation',
    tags: conv.tags,
    messageCount: conv.messages.filter(m => m.role !== 'system').length,
    createdAt: conv.createdAt instanceof Date ? conv.createdAt.toISOString() : String(conv.createdAt),
    updatedAt: conv.updatedAt instanceof Date ? conv.updatedAt.toISOString() : String(conv.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Process conversation for filesystem storage
// ---------------------------------------------------------------------------

function processForStorage(conversation: Conversation): Conversation {
  return {
    ...conversation,
    title: typeof conversation.title === 'string' ? conversation.title : 'Bildkonversation',
    messages: conversation.messages.map(msg => ({
      ...msg,
      content: processMessageContentForStorage(msg.content, MAX_IMAGE_SIZE_FS),
    })),
  };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/** Load a single full conversation by ID */
export async function loadConversation(id: string, basePath?: string): Promise<Conversation | null> {
  if (!id || /[\/\\]/.test(id)) return null;
  const dir = basePath || defaultBasePath();
  const filePath = conversationFilePath(dir, id);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Conversation;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    console.error(`[ConvStore] Failed to load conversation ${id}:`, err);
    return null;
  }
}

/** Save a conversation (creates or updates) */
export async function saveConversation(conversation: Conversation, basePath?: string): Promise<void> {
  if (!conversation.id || /[\/\\]/.test(conversation.id)) {
    throw new Error('Invalid conversation ID');
  }
  const dir = basePath || defaultBasePath();
  await ensureDir(dir);

  // Process images for storage
  const processed = processForStorage(conversation);

  // Write the full conversation file
  const filePath = conversationFilePath(dir, conversation.id);
  await fs.writeFile(filePath, JSON.stringify(processed, null, 2), 'utf-8');

  // Update the index
  const index = await loadIndex(dir);
  const summary = buildSummary(conversation);
  const idx = index.findIndex(s => s.id === conversation.id);
  if (idx >= 0) {
    index[idx] = summary;
  } else {
    index.push(summary);
  }

  // Sort by most recently updated
  index.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  await saveIndex(dir, index);
}

/** Delete a single conversation */
export async function deleteConversation(id: string, basePath?: string): Promise<boolean> {
  if (!id || /[\/\\]/.test(id)) return false;
  const dir = basePath || defaultBasePath();

  // Remove from index
  const index = await loadIndex(dir);
  const filtered = index.filter(s => s.id !== id);
  if (filtered.length === index.length) return false; // Not found

  await saveIndex(dir, filtered);

  // Remove conversation file (best effort)
  try {
    await fs.unlink(conversationFilePath(dir, id));
  } catch {
    // File may not exist
  }

  return true;
}

/** Clear all conversations */
export async function clearAllConversations(basePath?: string): Promise<void> {
  const dir = basePath || defaultBasePath();
  const index = await loadIndex(dir);

  // Remove individual files
  for (const summary of index) {
    try {
      await fs.unlink(conversationFilePath(dir, summary.id));
    } catch {
      // Skip missing files
    }
  }

  // Clear the index
  await saveIndex(dir, []);
}

/** Update just metadata (title, tags) without rewriting messages */
export async function updateConversationMetadata(
  id: string,
  updates: { title?: string; tags?: string[] },
  basePath?: string,
): Promise<boolean> {
  const dir = basePath || defaultBasePath();

  // Load the full conversation
  const conv = await loadConversation(id, dir);
  if (!conv) return false;

  // Apply updates
  if (updates.title !== undefined) conv.title = updates.title;
  if (updates.tags !== undefined) conv.tags = updates.tags;
  conv.updatedAt = new Date();

  // Write back (only the conversation file + index update)
  const filePath = conversationFilePath(dir, id);
  await fs.writeFile(filePath, JSON.stringify(conv, null, 2), 'utf-8');

  // Update index
  const index = await loadIndex(dir);
  const idx = index.findIndex(s => s.id === id);
  if (idx >= 0) {
    if (updates.title !== undefined) index[idx].title = updates.title;
    if (updates.tags !== undefined) index[idx].tags = updates.tags;
    index[idx].updatedAt = new Date().toISOString();
    await saveIndex(dir, index);
  }

  return true;
}
