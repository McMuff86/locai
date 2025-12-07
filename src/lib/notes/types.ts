export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: string[];
  createdAt: string;
  updatedAt: string;
}

export type NoteSummary = Omit<Note, 'content'>;

export interface NoteInput {
  id?: string;
  title: string;
  content: string;
  tags?: string[];
  links?: string[];
}

export interface NoteLink {
  source: string;
  target: string;
  type?: string;
}

export interface NoteNode {
  id: string;
  label: string;
  tags: string[];
  updatedAt: string;
}

export interface NoteGraph {
  nodes: NoteNode[];
  edges: NoteLink[];
}

export interface EmbeddingEntry {
  id: string;
  noteId: string;
  chunk: string;
  embedding: number[];
  model: string;
  createdAt: string;
}

export interface EmbeddingRequestOptions {
  host?: string;
  model?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface EmbeddingSearchResult {
  noteId: string;
  score: number;
  chunk: string;
}


