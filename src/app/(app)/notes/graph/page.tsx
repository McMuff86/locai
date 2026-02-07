"use client";

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, FileText, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  KnowledgeGraph, 
  GraphControls,
  GraphTextView,
  GraphSearch,
  NodeDetailPanel,
} from '@/components/notes';
import { useNotesContext } from '../layout';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import type { GraphNode, GraphLink } from '@/components/notes/types';

export default function GraphPage() {
  const router = useRouter();
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | null>(null);
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
    selectedNode,
    setSelectedNode,
    physicsPaused,
    setPhysicsPaused,
    searchQuery,
    setSearchQuery,
    searchMatches,
    generateEmbeddings,
    host,
  } = useNotesContext();

  const [graphViewMode, setGraphViewMode] = useState<'text' | 'visual'>('visual');

  // Handle node click - open detail panel instead of navigating
  const handleNodeClick = useCallback((noteId: string) => {
    setSelectedNode(noteId);
  }, [setSelectedNode]);

  // Handle navigate from detail panel
  const handleNavigate = useCallback((noteId: string) => {
    router.push(`/notes?note=${encodeURIComponent(noteId)}`);
  }, [router]);

  // Handle search focus — zoom camera to first match
  const handleFocusFirstMatch = useCallback(() => {
    if (searchMatches.length === 0 || graphViewMode !== 'visual') return;
    const firstMatchId = searchMatches[0];
    const node = graphData.nodes.find(n => n.id === firstMatchId);
    if (node && graphRef.current) {
      const fg = graphRef.current as unknown as {
        cameraPosition: (pos: { x: number; y: number; z: number }, lookAt?: { x: number; y: number; z: number }, ms?: number) => void;
      };
      const nodePos = node as unknown as { x?: number; y?: number; z?: number };
      fg.cameraPosition(
        { x: (nodePos.x || 0) + 40, y: (nodePos.y || 0) + 40, z: (nodePos.z || 0) + 80 },
        { x: nodePos.x || 0, y: nodePos.y || 0, z: nodePos.z || 0 },
        600
      );
    }
  }, [searchMatches, graphData.nodes, graphViewMode]);

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
          
          {/* Search Bar */}
          <GraphSearch
            value={searchQuery}
            onChange={setSearchQuery}
            matchCount={searchMatches.length}
            onFocusFirst={handleFocusFirstMatch}
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
            <div className="relative">
              <KnowledgeGraph
                graphData={graphData}
                notes={notes}
                settings={graphSettings}
                expanded={graphExpanded}
                hoveredNode={hoveredNode}
                physicsPaused={physicsPaused}
                searchMatches={searchMatches}
                searchActive={searchQuery.trim().length > 0}
                onNodeClick={handleNodeClick}
                onNodeHover={setHoveredNode}
                onPhysicsPausedChange={setPhysicsPaused}
                graphRefCallback={(ref) => { graphRef.current = ref; }}
              />
              
              {/* Node Detail Panel */}
              {selectedNode && (
                <NodeDetailPanel
                  noteId={selectedNode}
                  notes={notes}
                  graphData={graphData}
                  basePath={basePath}
                  onClose={() => setSelectedNode(null)}
                  onNavigate={handleNavigate}
                  onSelectNode={setSelectedNode}
                />
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
