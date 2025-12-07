import { EmbeddingEntry, EmbeddingSearchResult, Note } from './types';
import { cosineSimilarity } from './embeddings';

export interface RankedResult {
  noteId: string;
  title: string;
  tags: string[];
  score: number;
  snippet: string;
  matchType: 'title' | 'content' | 'tag';
}

// Get excerpt around the match
function getExcerpt(text: string, searchTerm: string, maxLength: number = 120): string {
  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  const index = lowerText.indexOf(lowerSearch);
  
  if (index === -1) return text.slice(0, maxLength);
  
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + searchTerm.length + 80);
  
  let excerpt = text.slice(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';
  
  return excerpt;
}

export function basicSearch(notes: Note[], query: string, limit = 10): RankedResult[] {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return [];

  const results: RankedResult[] = [];

  for (const note of notes) {
    const titleLower = note.title.toLowerCase();
    const contentLower = note.content.toLowerCase();
    const tagsLower = note.tags.map(t => t.toLowerCase());
    
    let score = 0;
    let matchType: 'title' | 'content' | 'tag' = 'content';
    let snippet = '';

    // Title match (highest priority)
    if (titleLower.includes(queryLower)) {
      score += 10;
      matchType = 'title';
      snippet = note.content.slice(0, 100) + (note.content.length > 100 ? '...' : '');
    }

    // Tag match (high priority)
    const matchingTag = tagsLower.find(t => t.includes(queryLower));
    if (matchingTag) {
      score += 5;
      if (matchType !== 'title') {
        matchType = 'tag';
        snippet = note.content.slice(0, 100) + (note.content.length > 100 ? '...' : '');
      }
    }

    // Content match
    if (contentLower.includes(queryLower)) {
      score += 3;
      if (matchType === 'content' || !snippet) {
        snippet = getExcerpt(note.content, query);
      }
    }

    // Also check for partial word matches in content
    const words = queryLower.split(/\s+/).filter(Boolean);
    for (const word of words) {
      if (word.length >= 2 && contentLower.includes(word)) {
        score += 1;
        if (!snippet) {
          snippet = getExcerpt(note.content, word);
        }
      }
    }

    if (score > 0) {
      results.push({ 
        noteId: note.id, 
        title: note.title,
        tags: note.tags,
        score, 
        snippet: snippet || note.content.slice(0, 100),
        matchType
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function semanticSearch(
  entries: EmbeddingEntry[],
  queryEmbedding: number[],
  limit = 10,
): EmbeddingSearchResult[] {
  const scored: EmbeddingSearchResult[] = entries.map((entry) => ({
    noteId: entry.noteId,
    chunk: entry.chunk,
    score: cosineSimilarity(entry.embedding, queryEmbedding),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}


