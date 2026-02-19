"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ZoomIn, ZoomOut, RotateCcw, Focus, Download, Pause, Play } from 'lucide-react';
import { GraphData, GraphNode, GraphLink, GraphSettings, NoteSummary } from './types';
import { getThemeColors, getNodeColor, mixWithWhite } from './graphUtils';

// Dynamic import for 2D graph
const ForceGraph2D = dynamic<Record<string, unknown>>(
  () => import('react-force-graph-2d').then(mod => mod.default) as never,
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-muted-foreground">Lade 2D Graph...</div>
  }
);

interface KnowledgeGraph2DProps {
  graphData: GraphData;
  notes: NoteSummary[];
  settings: GraphSettings;
  expanded: boolean;
  hoveredNode: string | null;
  physicsPaused: boolean;
  searchMatches?: string[];
  searchActive?: boolean;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  onPhysicsPausedChange: (paused: boolean) => void;
}

// Helper to extract ID from link source/target
function getLinkId(value: string | { id?: string } | unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

// Minimal ref interface for 2D graph methods we use
interface ForceGraph2DMethods {
  zoom: (scale?: number, durationMs?: number) => number;
  zoomToFit: (durationMs?: number, padding?: number) => void;
  centerAt: (x?: number, y?: number, durationMs?: number) => void;
  pauseAnimation: () => void;
  resumeAnimation: () => void;
}

export function KnowledgeGraph2D({
  graphData,
  notes,
  settings,
  expanded,
  hoveredNode,
  physicsPaused,
  searchMatches = [],
  searchActive = false,
  onNodeClick,
  onNodeHover,
  onPhysicsPausedChange,
}: KnowledgeGraph2DProps) {
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph2DMethods | null>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 500 });

  // Update graph dimensions when container size changes
  useEffect(() => {
    const container = graphContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setGraphDimensions({ width, height });
        }
      }
    });

    resizeObserver.observe(container);
    
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setGraphDimensions({ width: rect.width, height: rect.height });
    }
    
    return () => resizeObserver.disconnect();
  }, [expanded]);

  const theme = getThemeColors(settings.graphTheme);

  // Compute connection counts for hover tooltips
  const connectionCounts = useCallback((nodeId: string) => {
    let wiki = 0;
    let semantic = 0;
    for (const link of graphData.links) {
      const s = getLinkId(link.source);
      const t = getLinkId(link.target);
      if (s === nodeId || t === nodeId) {
        if (link.type === 'wiki') wiki++;
        else semantic++;
      }
    }
    return { wiki, semantic, total: wiki + semantic };
  }, [graphData.links]);

  const isSearchMatch = useCallback((nodeId: string) => {
    return searchMatches.includes(nodeId);
  }, [searchMatches]);

  // Canvas node painting for 2D
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isMatch = searchActive && isSearchMatch(node.id);
    const isDimmed = searchActive && searchMatches.length > 0 && !isMatch;
    
    const baseSize = (node.val || 2) * 0.5;
    const searchScale = isMatch ? 1.5 : 1.0;
    const size = baseSize * settings.nodeSize * 1.5 * searchScale;
    const color = getNodeColor(node, settings.graphTheme);
    const x = (node as unknown as { x: number }).x;
    const y = (node as unknown as { y: number }).y;
    
    if (x === undefined || y === undefined) return;

    // Draw glow
    if (settings.nodeGlow && !isDimmed) {
      const glowColor = mixWithWhite(color, 0.5);
      const gradient = ctx.createRadialGradient(x, y, size * 0.5, x, y, size * 3);
      gradient.addColorStop(0, glowColor + Math.round(settings.glowIntensity * settings.bloomStrength * 80).toString(16).padStart(2, '0'));
      gradient.addColorStop(1, glowColor + '00');
      ctx.beginPath();
      ctx.arc(x, y, size * 3, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Draw node circle
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fillStyle = isDimmed ? '#333333' : color;
    ctx.globalAlpha = isDimmed ? settings.nodeOpacity * 0.2 : settings.nodeOpacity;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Draw border for search matches
    if (isMatch) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // Always draw labels in 2D (with adaptive sizing)
    if (!isDimmed && node.name) {
      const fontSize = Math.max(3, settings.labelSize * 3.5);
      ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Label glow
      if (settings.labelGlow) {
        const glowColor = settings.labelColor === '#ffffff' ? color : settings.labelColor;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 4 * settings.bloomStrength;
      }
      
      ctx.fillStyle = settings.labelColor;
      ctx.fillText(node.name, x, y - size - fontSize * 0.6);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  }, [settings, searchActive, searchMatches, isSearchMatch]);

  // Link canvas drawing
  const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const source = link.source as unknown as { x: number; y: number };
    const target = link.target as unknown as { x: number; y: number };
    if (!source?.x || !target?.x) return;

    const linkColor = link.type === 'wiki' ? theme.wikiLink : theme.semanticLink;
    const baseWidth = link.type === 'wiki' ? 1.2 : 0.8;
    const simScale = link.type === 'semantic' && link.similarity ? link.similarity : 1;
    const width = baseWidth * settings.linkWidth * simScale;

    // Dim links during search
    if (searchActive && searchMatches.length > 0) {
      const s = getLinkId(link.source);
      const t = getLinkId(link.target);
      const connected = searchMatches.includes(s) || searchMatches.includes(t);
      if (!connected) {
        ctx.globalAlpha = 0.05;
      }
    }

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    
    if (settings.curvedLinks) {
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const offset = Math.sqrt(dx * dx + dy * dy) * 0.15;
      ctx.quadraticCurveTo(midX - dy * 0.15 + offset * 0.1, midY + dx * 0.15, target.x, target.y);
    } else {
      ctx.lineTo(target.x, target.y);
    }
    
    ctx.strokeStyle = linkColor;
    ctx.lineWidth = width;
    
    if (link.type === 'semantic') {
      ctx.setLineDash([3, 3]);
    } else {
      ctx.setLineDash([]);
    }
    
    const linkGlowOpacity = settings.linkGlow ? (settings.linkOpacity * 0.5) + 0.15 : settings.linkOpacity * 0.5;
    ctx.globalAlpha = Math.min(ctx.globalAlpha, linkGlowOpacity);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Draw arrow
    if (settings.showArrows) {
      const arrowLen = 4 * settings.linkWidth;
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const nodeSize = 5;
      const ax = target.x - Math.cos(angle) * nodeSize;
      const ay = target.y - Math.sin(angle) * nodeSize;
      
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(
        ax - arrowLen * Math.cos(angle - Math.PI / 6),
        ay - arrowLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        ax - arrowLen * Math.cos(angle + Math.PI / 6),
        ay - arrowLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = linkColor;
      ctx.fill();
    }
  }, [settings, theme, searchActive, searchMatches]);

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.4, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 0.7, 400);
    }
  };

  const handleReset = () => {
    if (graphRef.current) {
      graphRef.current.centerAt(0, 0, 600);
      graphRef.current.zoom(1, 600);
    }
  };

  const handleFit = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  const handleExport = () => {
    const container = graphContainerRef.current;
    if (!container) return;
    const canvas = container.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `graph-2d-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleTogglePhysics = () => {
    if (graphRef.current) {
      if (physicsPaused) {
        graphRef.current.resumeAnimation();
      } else {
        graphRef.current.pauseAnimation();
      }
      onPhysicsPausedChange(!physicsPaused);
    }
  };

  // Build hover label
  const getNodeLabel = useCallback((node: GraphNode) => {
    const counts = connectionCounts(node.id);
    const note = notes.find(n => n.id === node.id);
    const tags = note?.tags?.length ? `\n🏷️ ${note.tags.join(', ')}` : '';
    const links = counts.total > 0 ? `\n🔗 ${counts.wiki} Wiki / ${counts.semantic} Semantic` : '\n🔗 Keine Verknüpfungen';
    return `${node.name || 'Node'}${tags}${links}`;
  }, [connectionCounts, notes]);

  const getLinkLabel = useCallback((link: GraphLink) => {
    if (link.type === 'semantic' && link.similarity) {
      return `Ähnlichkeit: ${Math.round(link.similarity * 100)}%`;
    }
    return link.type === 'wiki' ? '[[Wikilink]]' : 'Semantisch';
  }, []);

  // Parse background for canvas
  const bgColor = theme.background.startsWith('linear') 
    ? (settings.graphTheme === 'minimal' ? '#fafafa' : '#050c19')
    : 'transparent';

  return (
    <div 
      ref={graphContainerRef}
      className={`w-full rounded-md border overflow-hidden relative transition-all duration-300 ${
        expanded ? 'h-[85vh] min-h-[600px]' : 'h-[calc(100vh-280px)] min-h-[400px]'
      } ${
        settings.graphTheme === 'cyber' 
          ? 'graph-container-cyber border-cyan-500/30' 
          : settings.graphTheme === 'neon'
          ? 'graph-container-neon border-purple-500/30'
          : 'bg-muted/30 border-border/60'
      }`}
      style={{ 
        minHeight: '360px',
        background: theme.background !== 'rgba(0, 0, 0, 0)' ? theme.background : undefined
      }}
    >
      {graphData.nodes.length > 0 ? (
        ForceGraph2D ? (
          <ForceGraph2D
            graphData={graphData}
            width={graphDimensions.width}
            height={graphDimensions.height}
            nodeLabel={getNodeLabel}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
              const size = ((node.val || 2) * 0.5) * settings.nodeSize * 1.5;
              const x = (node as unknown as { x: number }).x;
              const y = (node as unknown as { y: number }).y;
              if (x === undefined || y === undefined) return;
              ctx.beginPath();
              ctx.arc(x, y, size + 2, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkLabel={getLinkLabel}
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => 'replace' as const}
            ref={(ref: ForceGraph2DMethods | null) => { graphRef.current = ref; }}
            enableNodeDrag={true}
            enablePanInteraction={true}
            enableZoomInteraction={true}
            d3AlphaMin={0.1}
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.6}
            cooldownTime={1500}
            cooldownTicks={30}
            warmupTicks={30}
            onNodeClick={(node: GraphNode) => {
              if (node?.id) onNodeClick(node.id);
            }}
            onNodeHover={(node: GraphNode | null) => {
              onNodeHover(node?.id || null);
              if (graphContainerRef.current) {
                graphContainerRef.current.style.cursor = node ? 'pointer' : 'grab';
              }
            }}
            backgroundColor={bgColor}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            2D Graph konnte nicht geladen werden. Bitte Seite neu laden.
          </div>
        )
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Keine Notizen zum Anzeigen
        </div>
      )}
      
      {/* Floating Graph Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-10">
        <div className="text-[10px] text-muted-foreground/60 bg-background/50 backdrop-blur-sm px-2 py-1 rounded">
          🖱️ Drag: Verschieben • Scroll: Zoom • Node-Drag: Bewegen
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-background/80 backdrop-blur-sm rounded-lg border border-border/60 shadow-lg overflow-hidden">
            <button onClick={handleZoomIn} className="p-2 hover:bg-primary/20 transition-colors border-r border-border/40" title="Zoom In (+)">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button onClick={handleZoomOut} className="p-2 hover:bg-primary/20 transition-colors border-r border-border/40" title="Zoom Out (-)">
              <ZoomOut className="h-4 w-4" />
            </button>
            <button onClick={handleReset} className="p-2 hover:bg-primary/20 transition-colors" title="Ansicht zurücksetzen">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          
          <button
            onClick={handleTogglePhysics}
            className={`p-2 backdrop-blur-sm rounded-lg border shadow-lg transition-colors ${
              physicsPaused 
                ? 'bg-yellow-500/20 border-yellow-500/40 hover:bg-yellow-500/30' 
                : 'bg-background/80 border-border/60 hover:bg-primary/20'
            }`}
            title={physicsPaused ? "Animation fortsetzen" : "Animation pausieren"}
          >
            {physicsPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          
          <button onClick={handleFit} className="p-2 bg-background/80 backdrop-blur-sm rounded-lg border border-border/60 shadow-lg hover:bg-primary/20 transition-colors" title="Alle Nodes anzeigen">
            <Focus className="h-4 w-4" />
          </button>
          
          <button onClick={handleExport} className="p-2 bg-background/80 backdrop-blur-sm rounded-lg border border-border/60 shadow-lg hover:bg-primary/20 transition-colors" title="Als PNG exportieren">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Hovered Node Info */}
      {hoveredNode && (() => {
        const note = notes.find(n => n.id === hoveredNode);
        const counts = connectionCounts(hoveredNode);
        return (
          <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg border border-border/60 shadow-lg px-3 py-2 z-10 max-w-[240px]">
            <p className="text-sm font-medium text-foreground truncate">
              {note?.title || hoveredNode}
            </p>
            {note?.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {note.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="text-[9px] px-1 py-0.5 bg-primary/10 text-primary rounded">#{tag}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground">
                🔗 {counts.total} ({counts.wiki} Wiki, {counts.semantic} AI)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Klicken für Details</p>
          </div>
        );
      })()}
    </div>
  );
}
