// ============================================================================
// Workflow Persistence — IndexedDB (Client-Side)
// ============================================================================
// Stores active workflow state in IndexedDB for resume after refresh.
// Pattern: src/lib/flow/serialization.ts (idb, DBSchema, lazy init, browser check)
//
// Database: locai-workflow-persist, version 1
// Object store: active-workflows (keyed by conversationId)
// ============================================================================

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { WorkflowState } from './workflowTypes';

const DB_NAME = 'locai-workflow-persist';
const DB_VERSION = 1;
const STORE_NAME = 'active-workflows';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

interface WorkflowPersistDbSchema extends DBSchema {
  'active-workflows': {
    key: string; // conversationId
    value: WorkflowState;
    indexes: {
      'by-conversation': string;
    };
  };
}

// ---------------------------------------------------------------------------
// Lazy DB singleton
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase<WorkflowPersistDbSchema>> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

async function getDb(): Promise<IDBPDatabase<WorkflowPersistDbSchema>> {
  if (!isBrowser()) {
    throw new Error('IndexedDB ist nur im Browser verfügbar.');
  }

  if (!dbPromise) {
    dbPromise = openDB<WorkflowPersistDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME);
        store.createIndex('by-conversation', 'conversationId');
      },
    });
  }

  return dbPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Save an active workflow state, keyed by conversationId */
export async function saveActiveWorkflow(state: WorkflowState): Promise<void> {
  const key = state.conversationId;
  if (!key) return;

  const db = await getDb();
  await db.put(STORE_NAME, state, key);
}

/** Load an active workflow for a given conversation */
export async function loadActiveWorkflow(conversationId: string): Promise<WorkflowState | null> {
  if (!isBrowser()) return null;

  const db = await getDb();
  const state = await db.get(STORE_NAME, conversationId);
  return state ?? null;
}

/** Clear the active workflow for a given conversation */
export async function clearActiveWorkflow(conversationId: string): Promise<void> {
  if (!isBrowser()) return;

  const db = await getDb();
  await db.delete(STORE_NAME, conversationId);
}
