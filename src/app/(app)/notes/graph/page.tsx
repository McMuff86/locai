"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, FileText, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  KnowledgeGraph, 
  GraphControls,
  GraphTextView,
} from '@/components/notes';
import { useNotesContext } from '../layout';

export default function GraphPage() {
  const router = useRouter();
  const { 
    basePath, 
    notes,
    semanticLinks,
    semanticThreshold,
    setSemanticThreshold,
    graphData,
    graphSettings,
    updateGraphSettings,
    isGeneratingEmbeddings,
    embeddingsStatus,
    setEmbeddingsStatus,
    graphExpanded,
    setGraphExpanded,
    hoveredNode,
    setHoveredNode,
    physicsPaused,
    setPhysicsPaused,
    generateEmbeddings,
    host,
  } = useNotesContext();

  const [graphViewMode, setGraphViewMode] = useState<'text' | 'visual'>('visual');

  // Handle node click - navigate to notes page with note ID
  const handleNodeClick = useCallback((noteId: string) => {
    router.push(`/notes?note=${encodeURIComponent(noteId)}`);
  }, [router]);

  // If no notes path is configured, show setup message
  if (!basePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-muted/30 rounded-full p-6 mb-6">
          <FileText className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Verknüpfungen</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Um den Wissensgraphen zu nutzen, konfiguriere bitte zuerst den Notizen-Pfad in den Einstellungen.
        </p>
        <Link href="/settings">
          <Button className="gap-2">
            <Settings className="h-4 w-4" />
            Einstellungen öffnen
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
          <FolderOpen className="h-4 w-4" />
          <span>Einstellungen → Notizen → Notizen Pfad</span>
        </div>
      </div>
    );
  }

  const wikiLinkCount = graphData.links.filter(l => l.type === 'wiki').length;

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      <ScrollArea className="flex-1">
        <div className="rounded-lg border border-border p-4 space-y-3">
          {/* Controls */}
          <GraphControls
            settings={graphSettings}
            onSettingsChange={updateGraphSettings}
            semanticLinks={semanticLinks}
            semanticThreshold={semanticThreshold}
            onThresholdChange={setSemanticThreshold}
            graphViewMode={graphViewMode}
            onViewModeChange={setGraphViewMode}
            expanded={graphExpanded}
            onExpandedChange={setGraphExpanded}
            isGeneratingEmbeddings={isGeneratingEmbeddings}
            embeddingsStatus={embeddingsStatus}
            onGenerateEmbeddings={() => generateEmbeddings(host)}
            onDismissStatus={() => setEmbeddingsStatus(null)}
            basePath={basePath}
            wikiLinkCount={wikiLinkCount}
            nodeCount={graphData.nodes.length}
          />
          
          {/* Text View */}
          {graphViewMode === 'text' && (
            <GraphTextView
              graphData={graphData}
              notes={notes}
              semanticLinks={semanticLinks}
              graphTheme={graphSettings.graphTheme}
              expanded={graphExpanded}
              onNoteClick={handleNodeClick}
              linkFilter={graphSettings.linkFilter}
            />
          )}
          
          {/* Visual 3D View */}
          {graphViewMode === 'visual' && (
            <KnowledgeGraph
              graphData={graphData}
              notes={notes}
              settings={graphSettings}
              expanded={graphExpanded}
              hoveredNode={hoveredNode}
              physicsPaused={physicsPaused}
              onNodeClick={handleNodeClick}
              onNodeHover={setHoveredNode}
              onPhysicsPausedChange={setPhysicsPaused}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

