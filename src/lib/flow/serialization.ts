import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SavedFlowTemplate, StoredWorkflow } from '@/lib/flow/types';

const FLOW_DB_NAME = 'locai-flow';
const FLOW_DB_VERSION = 2;
const FLOW_STORE_NAME = 'workflows';
const TEMPLATES_STORE_NAME = 'templates';
export const CURRENT_WORKFLOW_ID = 'current';

interface FlowDbSchema extends DBSchema {
  workflows: {
    key: string;
    value: StoredWorkflow;
  };
  templates: {
    key: string;
    value: SavedFlowTemplate;
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
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(FLOW_STORE_NAME);
        }
        if (oldVersion < 2) {
          db.createObjectStore(TEMPLATES_STORE_NAME, { keyPath: 'id' });
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

export async function saveTemplate(template: SavedFlowTemplate): Promise<void> {
  const db = await getDb();
  await db.put(TEMPLATES_STORE_NAME, template);
}

export async function loadAllTemplates(): Promise<SavedFlowTemplate[]> {
  if (!isBrowser()) {
    return [];
  }

  const db = await getDb();
  return db.getAll(TEMPLATES_STORE_NAME);
}

export async function loadTemplateById(id: string): Promise<SavedFlowTemplate | null> {
  if (!isBrowser()) {
    return null;
  }

  const db = await getDb();
  const template = await db.get(TEMPLATES_STORE_NAME, id);
  return template ?? null;
}

export async function deleteTemplate(id: string): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  const db = await getDb();
  await db.delete(TEMPLATES_STORE_NAME, id);
}

