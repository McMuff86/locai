import path from 'path';
import { promises as fs } from 'fs';
import {
  EmbeddingEntry,
  EmbeddingRequestOptions,
  Note,
} from './types';

const DEFAULT_MODEL = 'nomic-embed-text';
const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 80;
const EMBEDDINGS_FILE = 'embeddings.jsonl';

function embeddingsPath(basePath: string) {
  return path.join(basePath, EMBEDDINGS_FILE);
}

export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP,
): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    chunks.push(clean.slice(start, end).trim());
    start = end - overlap;
    if (start < 0) start = 0;
    if (start >= clean.length) break;
  }
  return chunks.filter(Boolean);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

async function readLines(filePath: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.split('\n').filter(Boolean);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function loadEmbeddings(basePath: string): Promise<EmbeddingEntry[]> {
  const lines = await readLines(embeddingsPath(basePath));
  const entries: EmbeddingEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as EmbeddingEntry);
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

async function saveEmbeddings(basePath: string, entries: EmbeddingEntry[]): Promise<void> {
  await fs.mkdir(basePath, { recursive: true });
  const content = entries.map((entry) => JSON.stringify(entry)).join('\n');
  await fs.writeFile(embeddingsPath(basePath), content, 'utf8');
}

async function embedSingle(
  text: string,
  host: string,
  model: string,
): Promise<number[]> {
  // Ollama /api/embeddings endpoint (singular)
  const response = await fetch(`${host}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // Ollama returns { embedding: number[] }
  if (data.embedding && Array.isArray(data.embedding)) {
    return data.embedding;
  }
  
  throw new Error('Embedding response missing embedding array');
}

async function embedChunks(
  chunks: string[],
  options: EmbeddingRequestOptions,
): Promise<number[][]> {
  if (chunks.length === 0) return [];
  const host = (options.host || DEFAULT_HOST).replace(/\/$/, '');
  const model = options.model || DEFAULT_MODEL;

  // Process chunks one by one (Ollama doesn't support batch embedding well)
  const results: number[][] = [];
  
  for (const chunk of chunks) {
    try {
      const embedding = await embedSingle(chunk, host, model);
      results.push(embedding);
    } catch (err) {
      console.error(`Failed to embed chunk: ${err}`);
      throw err;
    }
  }
  
  return results;
}

export async function embedQuery(
  query: string,
  options: EmbeddingRequestOptions = {},
): Promise<number[]> {
  const [vector] = await embedChunks([query], options);
  if (!vector) {
    throw new Error('Failed to embed query');
  }
  return vector;
}

export async function upsertEmbeddingsForNote(
  basePath: string,
  note: Note,
  options: EmbeddingRequestOptions = {},
): Promise<EmbeddingEntry[]> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
  
  // Combine title and content for better embeddings
  const textToEmbed = `${note.title}\n\n${note.content}`.trim();
  
  if (!textToEmbed || textToEmbed.length < 10) {
    // Skip notes with very little content
    console.log(`Skipping note "${note.title}" - too short for embeddings`);
    const existing = await loadEmbeddings(basePath);
    return existing;
  }
  
  const chunks = chunkText(textToEmbed, chunkSize, overlap);
  
  if (chunks.length === 0) {
    console.log(`Skipping note "${note.title}" - no chunks generated`);
    const existing = await loadEmbeddings(basePath);
    return existing;
  }
  
  const vectors = await embedChunks(chunks, options);
  
  if (vectors.length !== chunks.length) {
    throw new Error(`Embedding count mismatch: got ${vectors.length} embeddings for ${chunks.length} chunks`);
  }
  
  const now = new Date().toISOString();
  const model = options.model || DEFAULT_MODEL;

  const nextEntries: EmbeddingEntry[] = chunks.map((chunk, idx) => ({
    id: `${note.id}#${idx}`,
    noteId: note.id,
    chunk,
    embedding: vectors[idx],
    model,
    createdAt: now,
  }));

  const existing = await loadEmbeddings(basePath);
  const withoutNote = existing.filter((entry) => entry.noteId !== note.id);
  const merged = [...withoutNote, ...nextEntries];
  await saveEmbeddings(basePath, merged);
  return merged;
}

export async function removeEmbeddingsForNote(
  basePath: string,
  noteId: string,
): Promise<void> {
  const existing = await loadEmbeddings(basePath);
  const filtered = existing.filter((entry) => entry.noteId !== noteId);
  await saveEmbeddings(basePath, filtered);
}


