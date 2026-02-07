"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ZoomIn, ZoomOut, RotateCcw, Focus, Download, Pause, Play } from 'lucide-react';
import { GraphData, GraphNode, GraphLink, GraphSettings, NoteSummary } from './types';
import { getThemeColors, getNodeColor, mixWithWhite } from './graphUtils';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import type * as THREE from 'three';

// Dynamic import with proper typing
const ForceGraph3D = dynamic<Record<string, unknown>>(
  () => import('react-force-graph-3d').then(mod => mod.default) as never,
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-muted-foreground">Lade 3D Graph...</div>
  }
);

interface KnowledgeGraphProps {
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
  graphRefCallback?: (ref: ForceGraphMethods<GraphNode, GraphLink> | null) => void;
}

// Helper to extract ID from link source/target
function getLinkId(value: string | { id?: string } | unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

export function KnowledgeGraph({
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
  graphRefCallback,
}: KnowledgeGraphProps) {
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | null>(null);
  const threeJsRef = useRef<typeof THREE | null>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 500 });

  // Load Three.js once
  useEffect(() => {
    if (typeof window !== 'undefined' && !threeJsRef.current) {
      import('three').then((threeModule) => {
        threeJsRef.current = threeModule;
      });
    }
  }, []);

  // Pass graphRef to parent
  const setGraphRef = useCallback((ref: ForceGraphMethods<GraphNode, GraphLink> | null) => {
    graphRef.current = ref;
    graphRefCallback?.(ref);
  }, [graphRefCallback]);

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
    
    // Initial update
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setGraphDimensions({ width: rect.width, height: rect.height });
    }
    
    return () => {
      resizeObserver.disconnect();
    };
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

  // Is a node a search match?
  const isSearchMatch = useCallback((nodeId: string) => {
    return searchMatches.includes(nodeId);
  }, [searchMatches]);

  const createNodeObject = useCallback((node: GraphNode) => {
    if (!threeJsRef.current) return null;
    
    const isMatch = searchActive && isSearchMatch(node.id);
    const isDimmed = searchActive && searchMatches.length > 0 && !isMatch;
    
    // For spheres without glow and without labels and no search dimming, use default
    if (settings.nodeGeometry === 'sphere' && !settings.nodeGlow && !settings.showLabels && !searchActive) return null;
    
    const ThreeJS = threeJsRef.current;
    const baseSize = (node.val || 2) * 0.5;
    // Enlarge matched nodes during search
    const searchScale = isMatch ? 1.5 : 1.0;
    const size = baseSize * settings.nodeSize * 0.2 * searchScale;
    let geometry: THREE.BufferGeometry;
    
    try {
      switch (settings.nodeGeometry) {
        case 'sphere':
          geometry = new ThreeJS.SphereGeometry(size, 32, 32);
          break;
        case 'box':
          geometry = new ThreeJS.BoxGeometry(size, size, size);
          break;
        case 'octahedron':
          geometry = new ThreeJS.OctahedronGeometry(size);
          break;
        case 'tetrahedron':
          geometry = new ThreeJS.TetrahedronGeometry(size);
          break;
        case 'icon': {
          const shape = new ThreeJS.Shape();
          const radius = size;
          const sides = 6;
          for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
          }
          shape.closePath();
          geometry = new ThreeJS.ExtrudeGeometry(shape, { depth: size * 0.3, bevelEnabled: true, bevelThickness: size * 0.1 });
          break;
        }
        default:
          geometry = new ThreeJS.SphereGeometry(size, 32, 32);
      }
      
      const color = getNodeColor(node, settings.graphTheme);
      const coreColor = mixWithWhite(color, 0.85);
      const midColor = mixWithWhite(color, 0.5);
      const outerColor = color;
      
      // Dim non-matching nodes during search
      const opacity = isDimmed ? settings.nodeOpacity * 0.2 : settings.nodeOpacity;
      
      const material = new ThreeJS.MeshBasicMaterial({
        color: settings.nodeGlow ? coreColor : color,
        transparent: true,
        opacity,
      });
      
      const mesh = new ThreeJS.Mesh(geometry, material);
      
      // Add glow layers (skip for dimmed nodes)
      if (settings.nodeGlow && !isDimmed) {
        const glowLayers = [
          { scale: 3.0, opacity: settings.glowIntensity * settings.bloomStrength * 0.15, color: outerColor, side: ThreeJS.BackSide },
          { scale: 2.2, opacity: settings.glowIntensity * settings.bloomStrength * 0.25, color: outerColor, side: ThreeJS.BackSide },
          { scale: 1.6, opacity: settings.glowIntensity * settings.bloomStrength * 0.4, color: midColor, side: undefined },
          { scale: 1.25, opacity: settings.glowIntensity * settings.bloomStrength * 0.6, color: coreColor, side: undefined },
        ];
        
        glowLayers.forEach(layer => {
          const glowGeometry = geometry.clone();
          const glowMaterial = new ThreeJS.MeshBasicMaterial({
            color: layer.color,
            transparent: true,
            opacity: layer.opacity,
            side: layer.side,
          });
          const glowMesh = new ThreeJS.Mesh(glowGeometry, glowMaterial);
          glowMesh.scale.multiplyScalar(layer.scale);
          mesh.add(glowMesh);
        });
      }
      
      // Add label sprite (skip for dimmed nodes)
      if (settings.showLabels && node.name && !isDimmed) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          const text = node.name;
          const baseFontSize = 120;
          const scaledFontSize = Math.round(baseFontSize * settings.labelSize * 2.5);
          const glowPadding = scaledFontSize * 1.5;
          
          context.font = `500 ${scaledFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          const textMetrics = context.measureText(text);
          const textWidth = textMetrics.width;
          
          canvas.width = Math.ceil(textWidth + glowPadding * 2);
          canvas.height = Math.ceil(scaledFontSize * 2 + glowPadding);
          
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.font = `500 ${scaledFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          
          const glowColor = settings.labelColor === '#ffffff' ? color : settings.labelColor;
          
          if (settings.labelGlow) {
            const bloomLayers = [
              { blur: scaledFontSize * 1.0 * settings.bloomStrength, alpha: 0.15, color: glowColor },
              { blur: scaledFontSize * 0.6 * settings.bloomStrength, alpha: 0.25, color: mixWithWhite(glowColor, 0.3) },
              { blur: scaledFontSize * 0.35 * settings.bloomStrength, alpha: 0.4, color: mixWithWhite(glowColor, 0.5) },
              { blur: scaledFontSize * 0.15 * settings.bloomStrength, alpha: 0.7, color: mixWithWhite(glowColor, 0.7) },
            ];
            
            bloomLayers.forEach(layer => {
              context.shadowColor = layer.color;
              context.shadowBlur = layer.blur;
              context.shadowOffsetX = 0;
              context.shadowOffsetY = 0;
              context.fillStyle = `rgba(255, 255, 255, ${layer.alpha})`;
              context.fillText(text, centerX, centerY);
            });
          }
          
          context.shadowBlur = 0;
          context.fillStyle = settings.labelColor;
          context.fillText(text, centerX, centerY);
          
          const texture = new ThreeJS.CanvasTexture(canvas);
          texture.needsUpdate = true;
          texture.minFilter = ThreeJS.LinearFilter;
          texture.magFilter = ThreeJS.LinearFilter;
          
          const spriteMaterial = new ThreeJS.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1,
            depthTest: false,
            depthWrite: false,
          });
          
          const sprite = new ThreeJS.Sprite(spriteMaterial);
          const aspectRatio = canvas.width / canvas.height;
          const spriteHeight = size * 2.0 * settings.labelSize * 2.5;
          sprite.scale.set(spriteHeight * aspectRatio, spriteHeight, 1);
          sprite.position.set(0, size * 2.2, 0);
          sprite.renderOrder = 999;
          mesh.add(sprite);
        }
      }
      
      return mesh;
    } catch (err) {
      console.error('Error creating custom node geometry:', err);
      return null;
    }
  }, [settings, searchActive, searchMatches, isSearchMatch]);

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentPos = (graphRef.current as unknown as { cameraPosition: () => { x: number; y: number; z: number } }).cameraPosition();
      graphRef.current.cameraPosition({ z: currentPos.z * 0.7 }, undefined, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentPos = (graphRef.current as unknown as { cameraPosition: () => { x: number; y: number; z: number } }).cameraPosition();
      graphRef.current.cameraPosition({ z: currentPos.z * 1.4 }, undefined, 400);
    }
  };

  const handleReset = () => {
    if (graphRef.current) {
      graphRef.current.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 600);
    }
  };

  const handleFit = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  const handleExport = () => {
    if (graphRef.current) {
      const renderer = graphRef.current.renderer();
      if (renderer) {
        const canvas = renderer.domElement;
        const link = document.createElement('a');
        link.download = `graph-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
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

  // Build hover label with connection info
  const getNodeLabel = useCallback((node: GraphNode) => {
    const counts = connectionCounts(node.id);
    const note = notes.find(n => n.id === node.id);
    const tags = note?.tags?.length ? `\n🏷️ ${note.tags.join(', ')}` : '';
    const links = counts.total > 0 ? `\n🔗 ${counts.wiki} Wiki / ${counts.semantic} Semantic` : '\n🔗 Keine Verknüpfungen';
    return `${node.name || 'Node'}${tags}${links}`;
  }, [connectionCounts, notes]);

  // Build link label (hover tooltip)
  const getLinkLabel = useCallback((link: GraphLink) => {
    if (link.type === 'semantic' && link.similarity) {
      return `Ähnlichkeit: ${Math.round(link.similarity * 100)}%`;
    }
    return link.type === 'wiki' ? '[[Wikilink]]' : 'Semantisch';
  }, []);

  return (
    <div 
      ref={graphContainerRef}
      className={`w-full rounded-md border overflow-hidden relative transition-all duration-300 ${
        expanded ? 'h-[70vh] min-h-[500px]' : 'h-[500px]'
      } ${
        settings.graphTheme === 'cyber' 
          ? 'graph-container-cyber border-cyan-500/30' 
          : settings.graphTheme === 'neon'
          ? 'graph-container-neon border-purple-500/30'
          : 'bg-muted/30 border-border/60'
      } ${settings.showLabels ? 'graph-labels-visible' : ''}`}
      style={{ 
        minHeight: '360px',
        background: theme.background !== 'rgba(0, 0, 0, 0)' ? theme.background : undefined
      }}
    >
      {graphData.nodes.length > 0 ? (
        ForceGraph3D ? (
          <ForceGraph3D
            graphData={graphData}
            width={graphDimensions.width}
            height={graphDimensions.height}
            nodeLabel={getNodeLabel}
            nodeLabelOpacity={settings.showLabels ? 1 : 0.8}
            nodeLabelPosition="top"
            nodeColor={(node: GraphNode) => {
              if (searchActive && searchMatches.length > 0 && !isSearchMatch(node.id)) {
                return '#333333';
              }
              return getNodeColor(node, settings.graphTheme);
            }}
            nodeVal={(node: GraphNode) => {
              const base = (node.val || 2) * settings.nodeSize * 0.2;
              // Enlarge search matches
              if (searchActive && isSearchMatch(node.id)) return base * 2;
              return base;
            }}
            nodeResolution={settings.nodeGlow ? 32 : 16}
            nodeOpacity={settings.nodeOpacity}
            linkLabel={getLinkLabel}
            linkOpacity={(link: GraphLink) => {
              if (searchActive && searchMatches.length > 0) {
                const s = getLinkId(link.source);
                const t = getLinkId(link.target);
                const connected = searchMatches.includes(s) || searchMatches.includes(t);
                if (!connected) return 0.05;
              }
              return settings.linkGlow ? (settings.linkOpacity * 0.5) + 0.15 : settings.linkOpacity * 0.5;
            }}
            linkWidth={(link: GraphLink) => {
              const baseWidth = link.type === 'wiki' ? 1.2 : 0.8;
              // Scale semantic links by similarity
              const simScale = link.type === 'semantic' && link.similarity ? link.similarity : 1;
              return baseWidth * settings.linkWidth * simScale;
            }}
            linkColor={(link: GraphLink) => {
              return link.type === 'wiki' ? theme.wikiLink : theme.semanticLink;
            }}
            linkLineDash={(link: GraphLink) => link.type === 'semantic' ? [3, 3] : null}
            linkDirectionalArrowLength={settings.showArrows ? 3 * settings.linkWidth : 0}
            linkDirectionalArrowRelPos={1}
            linkDirectionalArrowColor={(link: GraphLink) => {
              return link.type === 'wiki' ? theme.wikiLink : theme.semanticLink;
            }}
            linkCurvature={settings.curvedLinks ? 0.15 : 0}
            nodeThreeObject={createNodeObject}
            ref={(ref: ForceGraphMethods<GraphNode, GraphLink> | null) => setGraphRef(ref)}
            enableNodeDrag={true}
            enableNavigationControls={true}
            enablePointerInteraction={true}
            controlType="orbit"
            d3AlphaMin={0.1}
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.6}
            cooldownTime={1500}
            cooldownTicks={30}
            warmupTicks={30}
            linkDistance={80}
            nodeRelSize={4}
            dagMode={undefined}
            onEngineStop={() => {
              if (graphRef.current) {
                const controls = graphRef.current.controls() as { autoRotate?: boolean; enableDamping?: boolean; dampingFactor?: number };
                if (controls) {
                  controls.autoRotate = false;
                  controls.enableDamping = true;
                  controls.dampingFactor = 0.1;
                }
              }
            }}
            onNodeClick={(node: GraphNode) => {
              if (node?.id) {
                onNodeClick(node.id);
              }
            }}
            onNodeHover={(node: GraphNode | null) => {
              onNodeHover(node?.id || null);
              if (graphContainerRef.current) {
                graphContainerRef.current.style.cursor = node ? 'pointer' : 'grab';
              }
            }}
            backgroundColor="rgba(0,0,0,0)"
            showNavInfo={false}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            3D Graph konnte nicht geladen werden. Bitte Seite neu laden.
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
          🖱️ Drag: Drehen • Scroll: Zoom • Rechtsklick: Pan
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
