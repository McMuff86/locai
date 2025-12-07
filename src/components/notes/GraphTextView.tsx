"use client";

import { ArrowRight, Link2, Sparkles } from 'lucide-react';
import { NoteSummary, SemanticLink, GraphData, GraphTheme } from './types';
import { getNodeColor } from './graphUtils';

interface GraphTextViewProps {
  graphData: GraphData;
  notes: NoteSummary[];
  semanticLinks: SemanticLink[];
  graphTheme: GraphTheme;
  expanded: boolean;
  onNoteClick: (noteId: string) => void;
}

export function GraphTextView({
  graphData,
  notes,
  semanticLinks,
  graphTheme,
  expanded,
  onNoteClick,
}: GraphTextViewProps) {
  const wikiLinks = graphData.links.filter((l) => l.type === 'wiki');

  return (
    <div className={`rounded-md border border-border/60 bg-muted/20 p-3 overflow-y-auto space-y-4 ${
      expanded ? 'max-h-[70vh]' : 'max-h-[500px]'
    }`}>
      {/* Semantic Links Section */}
      <div>
        <h3 className="text-xs font-semibold text-emerald-500 mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Semantische Ähnlichkeiten ({semanticLinks.length})
        </h3>
        {semanticLinks.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Keine semantischen Links. Klicke &quot;Embeddings&quot; um Vektoren zu generieren.
          </p>
        ) : (
          <div className="space-y-1.5">
            {semanticLinks.map((link, idx) => {
              const sourceNote = notes.find(n => n.id === link.source);
              const targetNote = notes.find(n => n.id === link.target);
              return (
                <div 
                  key={idx}
                  className="flex items-center gap-2 text-xs p-2 rounded bg-emerald-500/10 border border-emerald-500/20"
                >
                  <span 
                    className="text-foreground font-medium cursor-pointer hover:text-emerald-400 transition-colors"
                    onClick={() => sourceNote && onNoteClick(sourceNote.id)}
                  >
                    {sourceNote?.title || link.source}
                  </span>
                  <ArrowRight className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  <span 
                    className="text-foreground font-medium cursor-pointer hover:text-emerald-400 transition-colors"
                    onClick={() => targetNote && onNoteClick(targetNote.id)}
                  >
                    {targetNote?.title || link.target}
                  </span>
                  <span className="ml-auto text-emerald-500 font-mono text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded">
                    {Math.round(link.similarity * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Wiki Links Section */}
      <div>
        <h3 className="text-xs font-semibold text-blue-500 mb-2 flex items-center gap-1.5">
          <Link2 className="h-3 w-3" />
          Wiki-Links ({wikiLinks.length})
        </h3>
        {wikiLinks.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Keine Wiki-Links. Verwende [[Notizname]] in deinen Notizen um Verknüpfungen zu erstellen.
          </p>
        ) : (
          <div className="space-y-1.5">
            {wikiLinks.map((link, idx) => {
              const sourceNote = notes.find(n => n.id === link.source);
              const targetNote = notes.find(n => n.id === link.target);
              return (
                <div 
                  key={idx}
                  className="flex items-center gap-2 text-xs p-2 rounded bg-blue-500/10 border border-blue-500/20"
                >
                  <span 
                    className="text-foreground font-medium cursor-pointer hover:text-blue-400 transition-colors"
                    onClick={() => sourceNote && onNoteClick(sourceNote.id)}
                  >
                    {sourceNote?.title || link.source}
                  </span>
                  <ArrowRight className="h-3 w-3 text-blue-500 flex-shrink-0" />
                  <span 
                    className="text-foreground font-medium cursor-pointer hover:text-blue-400 transition-colors"
                    onClick={() => targetNote && onNoteClick(targetNote.id)}
                  >
                    {targetNote?.title || link.target}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Notes Overview */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          Alle Notizen ({notes.length})
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {notes.map(note => (
            <span
              key={note.id}
              className="text-[10px] px-2 py-1 rounded-full border cursor-pointer hover:border-primary transition-colors"
              style={{ 
                borderColor: getNodeColor({ tags: note.tags }, graphTheme) + '60',
                backgroundColor: getNodeColor({ tags: note.tags }, graphTheme) + '15'
              }}
              onClick={() => onNoteClick(note.id)}
            >
              {note.title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

