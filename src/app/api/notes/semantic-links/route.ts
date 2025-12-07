import { NextRequest, NextResponse } from 'next/server';
import { loadEmbeddings, cosineSimilarity } from '@/lib/notes/embeddings';

export const runtime = 'nodejs';

interface SemanticLink {
  source: string;
  target: string;
  similarity: number;
}

function getBasePath(req: NextRequest, bodyBasePath?: string | null): string | null {
  return (
    bodyBasePath ||
    req.nextUrl.searchParams.get('basePath') ||
    req.headers.get('x-notes-path') ||
    process.env.LOCAL_NOTES_PATH ||
    null
  );
}

// Calculate average embedding for a note from its chunks
function calculateNoteEmbedding(
  noteId: string,
  embeddings: { noteId: string; embedding: number[] }[]
): number[] | null {
  const noteEmbeddings = embeddings.filter(e => e.noteId === noteId);
  if (noteEmbeddings.length === 0) return null;
  
  // Average all chunk embeddings for this note
  const dims = noteEmbeddings[0].embedding.length;
  const avgEmbedding = new Array(dims).fill(0);
  
  for (const entry of noteEmbeddings) {
    for (let i = 0; i < dims; i++) {
      avgEmbedding[i] += entry.embedding[i];
    }
  }
  
  for (let i = 0; i < dims; i++) {
    avgEmbedding[i] /= noteEmbeddings.length;
  }
  
  return avgEmbedding;
}

export async function GET(req: NextRequest) {
  const basePath = getBasePath(req);
  const threshold = parseFloat(req.nextUrl.searchParams.get('threshold') || '0.7');
  
  if (!basePath) {
    return NextResponse.json({ error: 'basePath is required' }, { status: 400 });
  }
  
  try {
    const embeddings = await loadEmbeddings(basePath);
    
    if (embeddings.length === 0) {
      return NextResponse.json({ 
        links: [], 
        message: 'Keine Embeddings vorhanden. Klicke "Embeddings" um Vektoren zu generieren.' 
      });
    }
    
    // Get unique note IDs
    const noteIds = [...new Set(embeddings.map(e => e.noteId))];
    
    // Calculate average embedding per note
    const noteEmbeddings = new Map<string, number[]>();
    for (const noteId of noteIds) {
      const avgEmb = calculateNoteEmbedding(noteId, embeddings);
      if (avgEmb) {
        noteEmbeddings.set(noteId, avgEmb);
      }
    }
    
    // Calculate pairwise similarity
    const semanticLinks: SemanticLink[] = [];
    const noteIdArray = Array.from(noteEmbeddings.keys());
    
    for (let i = 0; i < noteIdArray.length; i++) {
      for (let j = i + 1; j < noteIdArray.length; j++) {
        const idA = noteIdArray[i];
        const idB = noteIdArray[j];
        const embA = noteEmbeddings.get(idA);
        const embB = noteEmbeddings.get(idB);
        
        if (embA && embB) {
          const similarity = cosineSimilarity(embA, embB);
          
          if (similarity >= threshold) {
            semanticLinks.push({
              source: idA,
              target: idB,
              similarity: Math.round(similarity * 100) / 100
            });
          }
        }
      }
    }
    
    // Sort by similarity (highest first)
    semanticLinks.sort((a, b) => b.similarity - a.similarity);
    
    return NextResponse.json({
      links: semanticLinks,
      noteCount: noteIds.length,
      embeddingCount: embeddings.length,
      threshold
    });
    
  } catch (err) {
    console.error('Semantic links error:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Fehler beim Laden der Embeddings' 
    }, { status: 500 });
  }
}

