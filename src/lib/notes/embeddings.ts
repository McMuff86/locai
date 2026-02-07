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
  if (!text || typeof text !== 'string') return [];
  
  // Clean whitespace safely
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean || clean.length < 10) return [];

  // Ensure valid parameters
  const safeChunkSize = Math.max(100, Math.min(chunkSize, 10000));
  const safeOverlap = Math.max(0, Math.min(overlap, safeChunkSize - 10));

  const chunks: string[] = [];
  let start = 0;
  let iterations = 0;
  const maxIterations = 1000; // Safety limit
  
  while (start < clean.length && iterations < maxIterations) {
    iterations++;
    const end = Math.min(start + safeChunkSize, clean.length);
    const chunk = clean.slice(start, end).trim();
    
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    // Move start forward, ensuring we always make progress
    const nextStart = end - safeOverlap;
    if (nextStart <= start) {
      start = end; // Force progress
    } else {
      start = nextStart;
    }
    
    if (start >= clean.length) break;
  }
  
  return chunks;
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
  const filePath = embeddingsPath(basePath);
  console.log(`[Embeddings] Loading from ${filePath}`);
  
  const lines = await readLines(filePath);
  const entries: EmbeddingEntry[] = [];
  let skipped = 0;
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as EmbeddingEntry;
      // Validate entry has required fields
      if (entry.id && entry.noteId && Array.isArray(entry.embedding)) {
        entries.push(entry);
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }
  
  console.log(`[Embeddings] Loaded ${entries.length} entries, skipped ${skipped} invalid`);
  return entries;
}

async function saveEmbeddings(basePath: string, entries: EmbeddingEntry[]): Promise<void> {
  await fs.mkdir(basePath, { recursive: true });
  
  // Filter out any invalid entries before saving
  const validEntries = entries.filter(e => 
    e.id && e.noteId && Array.isArray(e.embedding) && e.embedding.length > 0
  );
  
  console.log(`[Embeddings] Saving ${validEntries.length} entries to ${embeddingsPath(basePath)}`);
  
  const content = validEntries.map((entry) => JSON.stringify(entry)).join('\n');
  await fs.writeFile(embeddingsPath(basePath), content, 'utf8');
}

async function embedSingle(
  text: string,
  host: string,
  model: string,
): Promise<number[]> {
  // Limit text length to avoid timeouts
  const truncatedText = text.slice(0, 8000);
  
  const url = `${host}/api/embeddings`;
  const requestBody = JSON.stringify({ model, prompt: truncatedText });
  
  // Use AbortController with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: requestBody,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API Fehler: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    // Read response as text first, then parse
    const responseText = await response.text();
    
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Ollama gab eine leere Antwort zurück');
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`JSON Parse-Fehler: ${responseText.slice(0, 100)}`);
    }
    
    // Ollama returns { embedding: number[] }
    if (data.embedding && Array.isArray(data.embedding) && data.embedding.length > 0) {
      return data.embedding;
    }
    
    throw new Error(`Keine Embeddings in Antwort: ${JSON.stringify(data).slice(0, 100)}`);
    
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Ollama Timeout - dauert zu lange');
    }
    
    throw err;
  }
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
  console.log(`[Embeddings] Processing note: "${note.title}" (${note.id})`);
  
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
  
  // Combine title and content for better embeddings
  const textToEmbed = `${note.title}\n\n${note.content || ''}`.trim();
  
  if (!textToEmbed || textToEmbed.length < 10) {
    console.log(`[Embeddings] Skipping "${note.title}" - too short (${textToEmbed.length} chars)`);
    const existing = await loadEmbeddings(basePath);
    return existing;
  }
  
  const chunks = chunkText(textToEmbed, chunkSize, overlap);
  console.log(`[Embeddings] Created ${chunks.length} chunks for "${note.title}"`);
  
  if (chunks.length === 0) {
    console.log(`[Embeddings] Skipping "${note.title}" - no chunks generated`);
    const existing = await loadEmbeddings(basePath);
    return existing;
  }
  
  // Process chunks one at a time with better error handling
  const vectors: number[][] = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      console.log(`[Embeddings] Embedding chunk ${i + 1}/${chunks.length} for "${note.title}"`);
      const vector = await embedSingle(
        chunks[i], 
        (options.host || DEFAULT_HOST).replace(/\/$/, ''),
        options.model || DEFAULT_MODEL
      );
      vectors.push(vector);
    } catch (err) {
      console.error(`[Embeddings] Failed chunk ${i + 1} for "${note.title}":`, err);
      throw new Error(`Chunk ${i + 1}/${chunks.length} fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    }
  }
  
  if (vectors.length === 0) {
    throw new Error('Keine Embeddings generiert');
  }
  
  const now = new Date().toISOString();
  const model = options.model || DEFAULT_MODEL;

  const nextEntries: EmbeddingEntry[] = vectors.map((embedding, idx) => ({
    id: `${note.id}#${idx}`,
    noteId: note.id,
    chunk: chunks[idx],
    embedding,
    model,
    createdAt: now,
  }));

  console.log(`[Embeddings] Created ${nextEntries.length} entries for "${note.title}"`);

  const existing = await loadEmbeddings(basePath);
  const withoutNote = existing.filter((entry) => entry.noteId !== note.id);
  const merged = [...withoutNote, ...nextEntries];
  await saveEmbeddings(basePath, merged);
  
  console.log(`[Embeddings] Saved. Total entries: ${merged.length}`);
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


