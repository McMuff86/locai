import { Note, NoteGraph, NoteLink, NoteNode } from './types';

export function buildGraph(notes: Note[]): NoteGraph {
  const nodes: NoteNode[] = notes.map((note) => ({
    id: note.id,
    label: note.title,
    tags: note.tags,
    updatedAt: note.updatedAt,
  }));

  const edges: NoteLink[] = [];
  const seen = new Set<string>();

  for (const note of notes) {
    for (const link of note.links) {
      const key = `${note.id}->${link}`;
      if (seen.has(key)) continue;
      edges.push({ source: note.id, target: link });
      seen.add(key);
    }
  }

  return { nodes, edges };
}


