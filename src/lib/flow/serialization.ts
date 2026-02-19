import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StoredWorkflow } from '@/lib/flow/types';

const FLOW_DB_NAME = 'locai-flow';
const FLOW_DB_VERSION = 1;
const FLOW_STORE_NAME = 'workflows';
export const CURRENT_WORKFLOW_ID = 'current';

interface FlowDbSchema extends DBSchema {
  workflows: {
    key: string;
    value: StoredWorkflow;
  };
}

let dbPromise: Promise<IDBPDatabase<FlowDbSchema>> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

async function getDb(): Promise<IDBPDatabase<FlowDbSchema>> {
  if (!isBrowser()) {
    throw new Error('IndexedDB ist nur im Browser verfügbar.');
  }

  if (!dbPromise) {
    dbPromise = openDB<FlowDbSchema>(FLOW_DB_NAME, FLOW_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(FLOW_STORE_NAME)) {
          db.createObjectStore(FLOW_STORE_NAME);
        }
      },
    });
  }

  return dbPromise;
}

export async function saveCurrentWorkflow(workflow: StoredWorkflow): Promise<void> {
  const db = await getDb();
  await db.put(FLOW_STORE_NAME, workflow, CURRENT_WORKFLOW_ID);
}

export async function loadCurrentWorkflow(): Promise<StoredWorkflow | null> {
  if (!isBrowser()) {
    return null;
  }

  const db = await getDb();
  const workflow = await db.get(FLOW_STORE_NAME, CURRENT_WORKFLOW_ID);
  return workflow ?? null;
}

export async function clearCurrentWorkflow(): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  const db = await getDb();
  await db.delete(FLOW_STORE_NAME, CURRENT_WORKFLOW_ID);
}

