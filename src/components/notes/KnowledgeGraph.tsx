"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ZoomIn, ZoomOut, RotateCcw, Focus, Download, Pause, Play } from 'lucide-react';
import { GraphData, GraphSettings, NoteSummary } from './types';
import { getThemeColors, getNodeColor, mixWithWhite } from './graphUtils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph3D = dynamic<any>(
  () => import('react-force-graph-3d').then(mod => mod.default),
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
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  onPhysicsPausedChange: (paused: boolean) => void;
}

export function KnowledgeGraph({
  graphData,
  notes,
  settings,
  expanded,
  hoveredNode,
  physicsPaused,
  onNodeClick,
  onNodeHover,
  onPhysicsPausedChange,
}: KnowledgeGraphProps) {
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const threeJsRef = useRef<any>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 500 });

  // Load Three.js once
  useEffect(() => {
    if (typeof window !== 'undefined' && !threeJsRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      import('three').then((THREE: any) => {
        threeJsRef.current = THREE;
      });
    }
  }, []);

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


  const createNodeObject = useCallback((node: any) => {
    if (!threeJsRef.current) return null;
    
    // For spheres without glow and without labels, use default
    if (settings.nodeGeometry === 'sphere' && !settings.nodeGlow && !settings.showLabels) return null;
    
    const THREE = threeJsRef.current;
    const baseSize = (node.val || 2) * 0.5;
    // nodeSize 1.0 (100%) = vorher 0.2, also 0.2x Multiplikator
    const size = baseSize * settings.nodeSize * 0.2;
    let geometry: any;
    
    try {
      switch (settings.nodeGeometry) {
        case 'sphere':
          geometry = new THREE.SphereGeometry(size, 32, 32);
          break;
        case 'box':
          geometry = new THREE.BoxGeometry(size, size, size);
          break;
        case 'octahedron':
          geometry = new THREE.OctahedronGeometry(size);
          break;
        case 'tetrahedron':
          geometry = new THREE.TetrahedronGeometry(size);
          break;
        case 'icon':
          const shape = new THREE.Shape();
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
          geometry = new THREE.ExtrudeGeometry(shape, { depth: size * 0.3, bevelEnabled: true, bevelThickness: size * 0.1 });
          break;
        default:
          geometry = new THREE.SphereGeometry(size, 32, 32);
      }
      
      const color = getNodeColor(node, settings.graphTheme);
      const coreColor = mixWithWhite(color, 0.85);
      const midColor = mixWithWhite(color, 0.5);
      const outerColor = color;
      
      const material = new THREE.MeshBasicMaterial({
        color: settings.nodeGlow ? coreColor : color,
        transparent: true,
        opacity: settings.nodeOpacity,
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      
      // Add glow layers
      if (settings.nodeGlow) {
        const glowLayers = [
          { scale: 3.0, opacity: settings.glowIntensity * settings.bloomStrength * 0.15, color: outerColor, side: THREE.BackSide },
          { scale: 2.2, opacity: settings.glowIntensity * settings.bloomStrength * 0.25, color: outerColor, side: THREE.BackSide },
          { scale: 1.6, opacity: settings.glowIntensity * settings.bloomStrength * 0.4, color: midColor, side: undefined },
          { scale: 1.25, opacity: settings.glowIntensity * settings.bloomStrength * 0.6, color: coreColor, side: undefined },
        ];
        
        glowLayers.forEach(layer => {
          const glowGeometry = geometry.clone();
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: layer.color,
            transparent: true,
            opacity: layer.opacity,
            side: layer.side,
          });
          const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
          glowMesh.scale.multiplyScalar(layer.scale);
          mesh.add(glowMesh);
        });
      }
      
      // Add label sprite
      if (settings.showLabels && node.name) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          const text = node.name;
          const baseFontSize = 120;
          // labelSize 1.0 (100%) = vorher 2.5, also 2.5x Multiplikator
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
          
          const texture = new THREE.CanvasTexture(canvas);
          texture.needsUpdate = true;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          
          const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1,
            depthTest: false,
            depthWrite: false,
          });
          
          const sprite = new THREE.Sprite(spriteMaterial);
          const aspectRatio = canvas.width / canvas.height;
          // labelSize 1.0 (100%) = vorher 2.5, also 2.5x Multiplikator
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
  }, [settings]);

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentPos = graphRef.current.cameraPosition();
      graphRef.current.cameraPosition({ z: currentPos.z * 0.7 }, undefined, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentPos = graphRef.current.cameraPosition();
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
            nodeLabel={(node: any) => node.name || 'Node'}
            nodeLabelOpacity={settings.showLabels ? 1 : 0.8}
            nodeLabelPosition="top"
            nodeColor={(node: any) => getNodeColor(node, settings.graphTheme)}
            nodeVal={(node: any) => (node.val || 2) * settings.nodeSize * 0.2}
            nodeResolution={settings.nodeGlow ? 32 : 16}
            nodeOpacity={settings.nodeOpacity}
            linkOpacity={settings.linkGlow ? (settings.linkOpacity * 0.5) + 0.15 : settings.linkOpacity * 0.5}
            linkWidth={(link: any) => {
              const baseWidth = link.type === 'wiki' ? 1.2 : 0.8;
              return baseWidth * settings.linkWidth;
            }}
            linkColor={(link: any) => {
              return link.type === 'wiki' ? theme.wikiLink : theme.semanticLink;
            }}
            linkLineDash={(link: any) => link.type === 'semantic' ? [3, 3] : null}
            linkDirectionalArrowLength={settings.showArrows ? 3 * settings.linkWidth : 0}
            linkDirectionalArrowRelPos={1}
            linkDirectionalArrowColor={(link: any) => {
              return link.type === 'wiki' ? theme.wikiLink : theme.semanticLink;
            }}
            linkCurvature={settings.curvedLinks ? 0.15 : 0}
            nodeThreeObject={createNodeObject}
            ref={graphRef}
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
                const controls = graphRef.current.controls();
                if (controls) {
                  controls.autoRotate = false;
                  controls.enableDamping = true;
                  controls.dampingFactor = 0.1;
                }
              }
            }}
            onNodeClick={(node: any) => {
              if (node?.id) {
                onNodeClick(node.id);
              }
            }}
            onNodeHover={(node: any) => {
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
      {hoveredNode && (
        <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg border border-border/60 shadow-lg px-3 py-2 z-10 max-w-[200px]">
          <p className="text-sm font-medium text-foreground truncate">
            {notes.find(n => n.id === hoveredNode)?.title || hoveredNode}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Klicken zum Öffnen</p>
        </div>
      )}
    </div>
  );
}

