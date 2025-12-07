import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { extractLinksAndTags } from './parser';
import { Note, NoteInput, NoteSummary } from './types';
import { NoteStorage, sortByUpdatedDesc } from './noteStorage';
import { removeEmbeddingsForNote } from './embeddings';

const NOTES_DIR = 'notes';
const INDEX_FILE = 'notes-index.json';

function indexPath(basePath: string) {
  return path.join(basePath, INDEX_FILE);
}

function noteFilePath(basePath: string, id: string) {
  return path.join(basePath, NOTES_DIR, `${id}.md`);
}

async function loadIndex(basePath: string): Promise<Record<string, NoteSummary>> {
  try {
    const raw = await fs.readFile(indexPath(basePath), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, NoteSummary>;
    return parsed;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function saveIndex(basePath: string, index: Record<string, NoteSummary>): Promise<void> {
  await fs.mkdir(path.join(basePath, NOTES_DIR), { recursive: true });
  await fs.writeFile(indexPath(basePath), JSON.stringify(index, null, 2), 'utf8');
}

export class FileNoteStorage implements NoteStorage {
  constructor(private readonly basePath: string) {}

  async listNotes(): Promise<NoteSummary[]> {
    const index = await loadIndex(this.basePath);
    return sortByUpdatedDesc(Object.values(index));
  }

  async getNote(id: string): Promise<Note | null> {
    const index = await loadIndex(this.basePath);
    const entry = index[id];
    if (!entry) return null;

    try {
      const content = await fs.readFile(noteFilePath(this.basePath, id), 'utf8');
      return { ...entry, content };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async saveNote(input: NoteInput): Promise<Note> {
    const id = input.id || crypto.randomUUID();
    const content = input.content || '';
    const { links, tags } = extractLinksAndTags(content);

    const index = await loadIndex(this.basePath);
    const now = new Date().toISOString();
    const mergedTags = Array.from(new Set([...(input.tags || []), ...tags]));
    const mergedLinks = Array.from(new Set([...(input.links || []), ...links]));

    const summary: NoteSummary = {
      id,
      title: input.title || 'Untitled',
      tags: mergedTags,
      links: mergedLinks,
      createdAt: index[id]?.createdAt || now,
      updatedAt: now,
    };

    index[id] = summary;

    await fs.mkdir(path.join(this.basePath, NOTES_DIR), { recursive: true });
    await fs.writeFile(noteFilePath(this.basePath, id), content, 'utf8');
    await saveIndex(this.basePath, index);

    return { ...summary, content };
  }

  async deleteNote(id: string): Promise<boolean> {
    const index = await loadIndex(this.basePath);
    if (!index[id]) return false;

    delete index[id];
    await saveIndex(this.basePath, index);
    await removeEmbeddingsForNote(this.basePath, id);

    try {
      await fs.unlink(noteFilePath(this.basePath, id));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return true;
  }
}


