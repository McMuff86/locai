"use client";

import { Button } from '@/components/ui/button';
import { 
  Hash, Settings, Palette, Zap, ZapOff, Sparkles,
  Loader2, X, ChevronDown, ChevronUp, Eye, LayoutList, Link2, Brain, Layers
} from 'lucide-react';
import { GraphSettings, labelColorPresets, SemanticLink, LinkFilter, GraphViewMode } from './types';
import { getThemeColors } from './graphUtils';

interface GraphControlsProps {
  settings: GraphSettings;
  onSettingsChange: (settings: Partial<GraphSettings>) => void;
  semanticLinks: SemanticLink[];
  semanticThreshold: number;
  onThresholdChange: (threshold: number) => void;
  graphViewMode: GraphViewMode;
  onViewModeChange: (mode: GraphViewMode) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  isGeneratingEmbeddings: boolean;
  embeddingsStatus: string | null;
  onGenerateEmbeddings: () => void;
  onDismissStatus: () => void;
  basePath?: string;
  wikiLinkCount: number;
  nodeCount: number;
}

export function GraphControls({
  settings,
  onSettingsChange,
  semanticLinks,
  semanticThreshold,
  onThresholdChange,
  graphViewMode,
  onViewModeChange,
  expanded,
  onExpandedChange,
  isGeneratingEmbeddings,
  embeddingsStatus,
  onGenerateEmbeddings,
  onDismissStatus,
  basePath,
  wikiLinkCount,
  nodeCount,
}: GraphControlsProps) {
  const theme = getThemeColors(settings.graphTheme);

  return (
    <div className="space-y-2">
      {/* Header with stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-medium">Verknüpfungen</h2>
          <p className="text-[11px] text-muted-foreground/70">
            {nodeCount} Notes · {wikiLinkCount} Wiki · {semanticLinks.length} Semantisch
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Link Filter Toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => onSettingsChange({ linkFilter: 'all' })}
              className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                settings.linkFilter === 'all' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              title="Alle Links anzeigen"
            >
              <Layers className="h-3 w-3" />
              Alle
            </button>
            <button
              onClick={() => onSettingsChange({ linkFilter: 'wiki' })}
              className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                settings.linkFilter === 'wiki' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              title="Nur Wiki-Links [[...]]"
            >
              <Link2 className="h-3 w-3" />
              Wiki
            </button>
            <button
              onClick={() => onSettingsChange({ linkFilter: 'semantic' })}
              className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                settings.linkFilter === 'semantic' 
                  ? 'bg-locai-success text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              title="Nur Semantische Links (Embeddings)"
            >
              <Brain className="h-3 w-3" />
              AI
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => onViewModeChange('text')}
              className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                graphViewMode === 'text' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <LayoutList className="h-3 w-3" />
              Text
            </button>
            <button
              onClick={() => onViewModeChange('2d')}
              className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                graphViewMode === '2d' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Eye className="h-3 w-3" />
              2D
            </button>
            <button
              onClick={() => onViewModeChange('3d')}
              className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                graphViewMode === '3d' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Eye className="h-3 w-3" />
              3D
            </button>
          </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerateEmbeddings}
            disabled={isGeneratingEmbeddings || !basePath}
            className="gap-1.5"
          >
            {isGeneratingEmbeddings ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Embeddings
              </>
            )}
          </Button>
          
          <Button
            size="sm"
            variant={expanded ? "default" : "outline"}
            onClick={() => onExpandedChange(!expanded)}
            className="gap-1.5"
            title={expanded ? "Verkleinern" : "Vergrößern"}
          >
            {expanded ? (
              <>
                <ChevronDown className="h-3 w-3" />
                <span className="hidden sm:inline">Klein</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3 w-3" />
                <span className="hidden sm:inline">Groß</span>
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Embedding Status */}
      {(isGeneratingEmbeddings || embeddingsStatus) && (
        <div className={`rounded-md border p-3 transition-colors ${
          isGeneratingEmbeddings 
            ? 'border-primary/40 bg-primary/5' 
            : embeddingsStatus?.startsWith('✓')
            ? 'border-green-500/40 bg-green-500/5'
            : 'border-yellow-500/40 bg-yellow-500/5'
        }`}>
          <div className="flex items-center gap-2">
            {isGeneratingEmbeddings && (
              <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            <span className={`text-xs ${
              isGeneratingEmbeddings 
                ? 'text-primary' 
                : embeddingsStatus?.startsWith('✓')
                ? 'text-green-600 dark:text-green-400'
                : 'text-yellow-600 dark:text-yellow-400'
            }`}>
              {embeddingsStatus || 'Embeddings werden generiert...'}
            </span>
            {!isGeneratingEmbeddings && embeddingsStatus && (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 ml-auto"
                onClick={onDismissStatus}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Legend + Threshold - single compact row */}
      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5" style={{ backgroundColor: theme.wikiLink }} />
          <span className="text-muted-foreground/70">Wiki</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5" style={{ borderTop: '2px dashed', borderColor: theme.semanticLink }} />
          <span className="text-muted-foreground/70">Semantisch ({semanticLinks.length})</span>
        </div>
        {semanticLinks.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-muted-foreground/70">Schwelle:</span>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={semanticThreshold}
              onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
              className="w-20 h-1"
              style={{ accentColor: theme.semanticLink }}
            />
            <span className="font-mono text-muted-foreground/70">{Math.round(semanticThreshold * 100)}%</span>
          </div>
        )}
        
      </div>

      {/* Graph Settings (only in visual mode) */}
      {(graphViewMode === '2d' || graphViewMode === '3d') && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onSettingsChange({ showLabels: !settings.showLabels })}
            className={`px-2 py-0.5 text-[11px] rounded-md border transition-colors flex items-center gap-1 ${
              settings.showLabels
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
            title="Labels immer anzeigen"
          >
            <Hash className="h-3 w-3" />
            Labels
          </button>

          <select
            value={settings.graphTheme}
            onChange={(e) => onSettingsChange({ graphTheme: e.target.value as any })}
            className="px-1.5 py-0.5 text-[11px] rounded-md border border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/50"
          >
            <option value="cyber">Cyber</option>
            <option value="obsidian">Obsidian</option>
            <option value="neon">Neon</option>
            <option value="minimal">Minimal</option>
          </select>

          <select
            value={settings.nodeGeometry}
            onChange={(e) => onSettingsChange({ nodeGeometry: e.target.value as any })}
            className="px-1.5 py-0.5 text-[11px] rounded-md border border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/50"
            title="Node Geometrie"
          >
            <option value="sphere">Kugel</option>
            <option value="box">Würfel</option>
            <option value="octahedron">Oktaeder</option>
            <option value="tetrahedron">Tetraeder</option>
            <option value="icon">Icon</option>
          </select>

          <button
            onClick={() => onSettingsChange({ nodeGlow: !settings.nodeGlow })}
            className={`px-1.5 py-0.5 text-[11px] rounded-md border transition-colors ${
              settings.nodeGlow
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
            title="Node Glow"
          >
            {settings.nodeGlow ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
          </button>

          <button
            onClick={() => onSettingsChange({ showAdvancedSettings: !settings.showAdvancedSettings })}
            className={`px-1.5 py-0.5 text-[11px] rounded-md border transition-colors ${
              settings.showAdvancedSettings
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
            title="Erweiterte Einstellungen"
          >
            <Settings className="h-3 w-3" />
          </button>
        </div>
      )}
      
      {/* Advanced Settings Panel */}
      {(graphViewMode === '2d' || graphViewMode === '3d') && settings.showAdvancedSettings && (
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5 space-y-2">
          {/* Sliders - compact inline layout, 3 per row */}
          <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
            {/* Node Opacity */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap w-16 flex-shrink-0">Transparenz</span>
              <input type="range" min="0.1" max="1" step="0.05" value={settings.nodeOpacity}
                onChange={(e) => onSettingsChange({ nodeOpacity: parseFloat(e.target.value) })}
                className="flex-1 h-1 min-w-0" style={{ accentColor: theme.wikiLink }} />
              <span className="text-[10px] font-mono text-muted-foreground/70 w-7 text-right flex-shrink-0">{Math.round(settings.nodeOpacity * 100)}%</span>
            </div>

            {/* Link Opacity */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap w-16 flex-shrink-0">Link Sicht.</span>
              <input type="range" min="0.1" max="1" step="0.05" value={settings.linkOpacity}
                onChange={(e) => onSettingsChange({ linkOpacity: parseFloat(e.target.value) })}
                className="flex-1 h-1 min-w-0" style={{ accentColor: theme.semanticLink }} />
              <span className="text-[10px] font-mono text-muted-foreground/70 w-7 text-right flex-shrink-0">{Math.round(settings.linkOpacity * 100)}%</span>
            </div>

            {/* Node Size */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap w-16 flex-shrink-0">Node Größe</span>
              <input type="range" min="0.3" max="3.0" step="0.1" value={settings.nodeSize}
                onChange={(e) => onSettingsChange({ nodeSize: parseFloat(e.target.value) })}
                className="flex-1 h-1 min-w-0" style={{ accentColor: theme.wikiLink }} />
              <span className="text-[10px] font-mono text-muted-foreground/70 w-7 text-right flex-shrink-0">{Math.round(settings.nodeSize * 100)}%</span>
            </div>

            {/* Link Width */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap w-16 flex-shrink-0">Link Dicke</span>
              <input type="range" min="0.2" max="2" step="0.1" value={settings.linkWidth}
                onChange={(e) => onSettingsChange({ linkWidth: parseFloat(e.target.value) })}
                className="flex-1 h-1 min-w-0" style={{ accentColor: theme.semanticLink }} />
              <span className="text-[10px] font-mono text-muted-foreground/70 w-7 text-right flex-shrink-0">{Math.round(settings.linkWidth * 100)}%</span>
            </div>

            {/* Semantic Links Cap */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap w-16 flex-shrink-0">AI Max</span>
              <input type="range" min="10" max="500" step="10" value={settings.semanticLinksCap}
                onChange={(e) => onSettingsChange({ semanticLinksCap: parseInt(e.target.value) })}
                className="flex-1 h-1 min-w-0" style={{ accentColor: theme.semanticLink }} />
              <span className="text-[10px] font-mono text-muted-foreground/70 w-7 text-right flex-shrink-0">{settings.semanticLinksCap}</span>
            </div>

            {/* Glow Intensity */}
            {settings.nodeGlow && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground whitespace-nowrap w-16 flex-shrink-0">Glow</span>
                <input type="range" min="0.1" max="1" step="0.05" value={settings.glowIntensity}
                  onChange={(e) => onSettingsChange({ glowIntensity: parseFloat(e.target.value) })}
                  className="flex-1 h-1 min-w-0" style={{ accentColor: theme.wikiLink }} />
                <span className="text-[10px] font-mono text-muted-foreground/70 w-7 text-right flex-shrink-0">{Math.round(settings.glowIntensity * 100)}%</span>
              </div>
            )}

            {/* Bloom Strength */}
            {settings.nodeGlow && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground whitespace-nowrap w-16 flex-shrink-0">Bloom</span>
                <input type="range" min="0.2" max="2" step="0.1" value={settings.bloomStrength}
                  onChange={(e) => onSettingsChange({ bloomStrength: parseFloat(e.target.value) })}
                  className="flex-1 h-1 min-w-0" style={{ accentColor: theme.wikiLink }} />
                <span className="text-[10px] font-mono text-muted-foreground/70 w-7 text-right flex-shrink-0">{Math.round(settings.bloomStrength * 100)}%</span>
              </div>
            )}

            {/* Label Size */}
            {settings.showLabels && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground whitespace-nowrap w-16 flex-shrink-0">Label Gr.</span>
                <input type="range" min="0.3" max="2.0" step="0.1" value={settings.labelSize}
                  onChange={(e) => onSettingsChange({ labelSize: parseFloat(e.target.value) })}
                  className="flex-1 h-1 min-w-0" style={{ accentColor: theme.semanticLink }} />
                <span className="text-[10px] font-mono text-muted-foreground/70 w-7 text-right flex-shrink-0">{Math.round(settings.labelSize * 100)}%</span>
              </div>
            )}
          </div>

          {/* Toggles + Label Color - compact row */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/30">
            <button
              onClick={() => onSettingsChange({ showArrows: !settings.showArrows })}
              className={`px-2 py-0.5 text-[11px] rounded-md transition-colors ${
                settings.showArrows
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-muted/50 text-muted-foreground border border-border/40 hover:bg-muted'
              }`}
            >
              Pfeile {settings.showArrows ? 'An' : 'Aus'}
            </button>
            <button
              onClick={() => onSettingsChange({ curvedLinks: !settings.curvedLinks })}
              className={`px-2 py-0.5 text-[11px] rounded-md transition-colors ${
                settings.curvedLinks
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-muted/50 text-muted-foreground border border-border/40 hover:bg-muted'
              }`}
            >
              {settings.curvedLinks ? 'Kurvig' : 'Gerade'}
            </button>
            <button
              onClick={() => onSettingsChange({ showOrphans: !settings.showOrphans })}
              className={`px-2 py-0.5 text-[11px] rounded-md transition-colors ${
                settings.showOrphans
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-muted/50 text-muted-foreground border border-border/40 hover:bg-muted'
              }`}
            >
              Verwaiste {settings.showOrphans ? 'An' : 'Aus'}
            </button>
            {settings.showLabels && (
              <button
                onClick={() => onSettingsChange({ labelGlow: !settings.labelGlow })}
                className={`px-2 py-0.5 text-[11px] rounded-md transition-colors ${
                  settings.labelGlow
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-muted/50 text-muted-foreground border border-border/40 hover:bg-muted'
                }`}
              >
                Label Glow {settings.labelGlow ? 'An' : 'Aus'}
              </button>
            )}

            {/* Label Color - inline */}
            {settings.showLabels && (
              <>
                <div className="w-px h-4 bg-border/40 mx-0.5" />
                <span className="text-[11px] text-muted-foreground">Farbe:</span>
                <div className="flex items-center gap-0.5">
                  {labelColorPresets.map((preset) => (
                    <button
                      key={preset.color}
                      onClick={() => onSettingsChange({ labelColor: preset.color })}
                      className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-110 ${
                        settings.labelColor === preset.color ? 'border-white shadow-md scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: preset.color }}
                      title={preset.name}
                    />
                  ))}
                  <input
                    type="color"
                    value={settings.labelColor}
                    onChange={(e) => onSettingsChange({ labelColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border border-border/40 ml-0.5"
                    title="Eigene Farbe"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

