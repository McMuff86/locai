"use client";

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, FileText, Settings, Radar } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  KnowledgeGraph,
  KnowledgeGraph2D,
  GraphControls,
  GraphTextView,
  GraphSearch,
  NodeDetailPanel,
} from '@/components/notes';
import { useNotesContext } from '../layout';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import type { GraphNode, GraphLink, GraphViewMode, GraphData } from '@/components/notes/types';

// Helper to extract ID from link source/target
function getLinkId(value: string | { id?: string } | unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

export default function GraphPage() {
  const router = useRouter();
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | null>(null);
  const { 
    basePath, 
    notes,
    semanticLinks,
    semanticThreshold,
    setSemanticThreshold,
    graphData: rawGraphData,
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

  const [graphViewMode, setGraphViewMode] = useState<GraphViewMode>('3d');

  // Apply orphan filtering and local graph filtering
  const graphData = useMemo((): GraphData => {
    let { nodes, links } = rawGraphData;

    // Orphan filtering
    if (!graphSettings.showOrphans) {
      const connectedNodeIds = new Set<string>();
      for (const link of links) {
        connectedNodeIds.add(getLinkId(link.source));
        connectedNodeIds.add(getLinkId(link.target));
      }
      nodes = nodes.filter(n => connectedNodeIds.has(n.id));
    }

    // Local graph filtering
    if (graphSettings.localGraph && selectedNode) {
      const depth = graphSettings.localGraphDepth;
      const reachable = new Set<string>([selectedNode]);
      
      // BFS to find nodes within depth
      let frontier = new Set<string>([selectedNode]);
      for (let d = 0; d < depth; d++) {
        const nextFrontier = new Set<string>();
        for (const link of links) {
          const s = getLinkId(link.source);
          const t = getLinkId(link.target);
          if (frontier.has(s) && !reachable.has(t)) {
            nextFrontier.add(t);
            reachable.add(t);
          }
          if (frontier.has(t) && !reachable.has(s)) {
            nextFrontier.add(s);
            reachable.add(s);
          }
        }
        frontier = nextFrontier;
      }

      nodes = nodes.filter(n => reachable.has(n.id));
      links = links.filter(l => {
        const s = getLinkId(l.source);
        const t = getLinkId(l.target);
        return reachable.has(s) && reachable.has(t);
      });
    }

    return { nodes, links };
  }, [rawGraphData, graphSettings.showOrphans, graphSettings.localGraph, graphSettings.localGraphDepth, selectedNode]);

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
    if (searchMatches.length === 0 || graphViewMode === 'text') return;
    const firstMatchId = searchMatches[0];
    const node = graphData.nodes.find(n => n.id === firstMatchId);
    if (node && graphRef.current && graphViewMode === '3d') {
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
  const isVisual = graphViewMode === '2d' || graphViewMode === '3d';

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
          
          {/* Search Bar + Local Graph controls */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <GraphSearch
                value={searchQuery}
                onChange={setSearchQuery}
                matchCount={searchMatches.length}
                onFocusFirst={handleFocusFirstMatch}
              />
            </div>
            
            {/* Local Graph Toggle */}
            {isVisual && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateGraphSettings({ localGraph: !graphSettings.localGraph })}
                  className={`px-2 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1 ${
                    graphSettings.localGraph 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  title="Lokaler Graph – zeigt nur den ausgewählten Node und seine Nachbarn"
                >
                  <Radar className="h-3 w-3" />
                  Lokal
                </button>
                {graphSettings.localGraph && (
                  <select
                    value={graphSettings.localGraphDepth}
                    onChange={(e) => updateGraphSettings({ localGraphDepth: parseInt(e.target.value) as 1 | 2 })}
                    className="px-1.5 py-1 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground"
                    title="Tiefe der Nachbarschaft"
                  >
                    <option value={1}>1 Hop</option>
                    <option value={2}>2 Hops</option>
                  </select>
                )}
              </div>
            )}
          </div>
          
          {/* Local Graph hint */}
          {graphSettings.localGraph && !selectedNode && isVisual && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
              💡 Klicke auf einen Node um den lokalen Graphen zu sehen.
            </div>
          )}
          
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
          
          {/* Visual 2D View */}
          {graphViewMode === '2d' && (
            <div className="relative">
              <KnowledgeGraph2D
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
          
          {/* Visual 3D View */}
          {graphViewMode === '3d' && (
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
