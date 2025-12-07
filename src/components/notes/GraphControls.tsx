"use client";

import { Button } from '@/components/ui/button';
import { 
  Hash, Settings, Palette, Zap, ZapOff, Sparkles,
  Loader2, X, ChevronDown, ChevronUp, Eye, LayoutList
} from 'lucide-react';
import { GraphSettings, labelColorPresets, SemanticLink } from './types';
import { getThemeColors } from './graphUtils';

interface GraphControlsProps {
  settings: GraphSettings;
  onSettingsChange: (settings: Partial<GraphSettings>) => void;
  semanticLinks: SemanticLink[];
  semanticThreshold: number;
  onThresholdChange: (threshold: number) => void;
  graphViewMode: 'text' | 'visual';
  onViewModeChange: (mode: 'text' | 'visual') => void;
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
    <div className="space-y-3">
      {/* Header with stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-medium">Verknüpfungen</h2>
          <p className="text-xs text-muted-foreground">
            {nodeCount} Notes / {wikiLinkCount} Wiki-Links / {semanticLinks.length} Semantische Links
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              onClick={() => onViewModeChange('visual')}
              className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                graphViewMode === 'visual' 
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
      
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5" style={{ backgroundColor: theme.wikiLink }} />
          <span className="text-muted-foreground">[[Wikilinks]]</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5" style={{ borderTop: '2px dashed', borderColor: theme.semanticLink }} />
          <span className="text-muted-foreground">Semantisch ähnlich ({semanticLinks.length})</span>
        </div>
      </div>
      
      {/* Controls Row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Threshold Slider */}
        {semanticLinks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Schwellenwert:</span>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={semanticThreshold}
              onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
              className="w-24 h-1.5"
              style={{ accentColor: theme.semanticLink }}
            />
            <span className="text-xs font-mono text-muted-foreground">{Math.round(semanticThreshold * 100)}%</span>
          </div>
        )}
        
        {/* Graph Settings (only in visual mode) */}
        {graphViewMode === 'visual' && (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              onClick={() => onSettingsChange({ showLabels: !settings.showLabels })}
              className={`px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1 ${
                settings.showLabels 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              title="Labels immer anzeigen"
            >
              <Hash className="h-3 w-3" />
              Labels
            </button>
            
            <select
              value={settings.graphTheme}
              onChange={(e) => onSettingsChange({ graphTheme: e.target.value as any })}
              className="px-2 py-1 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted"
            >
              <option value="cyber">Cyber</option>
              <option value="obsidian">Obsidian</option>
              <option value="neon">Neon</option>
              <option value="minimal">Minimal</option>
            </select>
            
            <select
              value={settings.nodeGeometry}
              onChange={(e) => onSettingsChange({ nodeGeometry: e.target.value as any })}
              className="px-2 py-1 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted"
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
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                settings.nodeGlow 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              title="Node Glow"
            >
              {settings.nodeGlow ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            </button>
            
            <button
              onClick={() => onSettingsChange({ showAdvancedSettings: !settings.showAdvancedSettings })}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                settings.showAdvancedSettings 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              title="Erweiterte Einstellungen"
            >
              <Settings className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      
      {/* Advanced Settings Panel */}
      {graphViewMode === 'visual' && settings.showAdvancedSettings && (
        <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            {/* Node Opacity */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Node Transparenz</span>
                <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.nodeOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={settings.nodeOpacity}
                onChange={(e) => onSettingsChange({ nodeOpacity: parseFloat(e.target.value) })}
                className="w-full h-1.5"
                style={{ accentColor: theme.wikiLink }}
              />
            </div>
            
            {/* Link Opacity */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Link Sichtbarkeit</span>
                <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.linkOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={settings.linkOpacity}
                onChange={(e) => onSettingsChange({ linkOpacity: parseFloat(e.target.value) })}
                className="w-full h-1.5"
                style={{ accentColor: theme.semanticLink }}
              />
            </div>
            
            {/* Glow Intensity */}
            {settings.nodeGlow && (
              <div className="space-y-1 col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Glow Intensität
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.glowIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={settings.glowIntensity}
                  onChange={(e) => onSettingsChange({ glowIntensity: parseFloat(e.target.value) })}
                  className="w-full h-1.5"
                  style={{ accentColor: theme.wikiLink }}
                />
              </div>
            )}
            
            {/* Node Size */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Node Größe</span>
                <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.nodeSize * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="3.0"
                step="0.1"
                value={settings.nodeSize}
                onChange={(e) => onSettingsChange({ nodeSize: parseFloat(e.target.value) })}
                className="w-full h-1.5"
                style={{ accentColor: theme.wikiLink }}
              />
            </div>
            
            {/* Label Size */}
            {settings.showLabels && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    Label Größe
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.labelSize * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.0"
                  step="0.1"
                  value={settings.labelSize}
                  onChange={(e) => onSettingsChange({ labelSize: parseFloat(e.target.value) })}
                  className="w-full h-1.5"
                  style={{ accentColor: theme.semanticLink }}
                />
              </div>
            )}
            
            {/* Label Color */}
            {settings.showLabels && (
              <div className="space-y-2 col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Palette className="h-3 w-3" />
                    Label Farbe
                  </span>
                  <div className="flex items-center gap-1">
                    {labelColorPresets.map((preset) => (
                      <button
                        key={preset.color}
                        onClick={() => onSettingsChange({ labelColor: preset.color })}
                        className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${
                          settings.labelColor === preset.color ? 'border-white shadow-lg scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: preset.color }}
                        title={preset.name}
                      />
                    ))}
                    <div className="relative ml-2">
                      <input
                        type="color"
                        value={settings.labelColor}
                        onChange={(e) => onSettingsChange({ labelColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border border-border"
                        title="Eigene Farbe"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Label Glow Toggle */}
            {settings.showLabels && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Label Glow
                  </span>
                  <button
                    onClick={() => onSettingsChange({ labelGlow: !settings.labelGlow })}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      settings.labelGlow 
                        ? 'bg-primary/20 text-primary border border-primary/30' 
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    {settings.labelGlow ? 'An' : 'Aus'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Link Width */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Link Dicke</span>
                <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.linkWidth * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2"
                step="0.1"
                value={settings.linkWidth}
                onChange={(e) => onSettingsChange({ linkWidth: parseFloat(e.target.value) })}
                className="w-full h-1.5"
                style={{ accentColor: theme.semanticLink }}
              />
            </div>
            
            {/* Bloom Strength */}
            {settings.nodeGlow && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Bloom
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.bloomStrength * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2"
                  step="0.1"
                  value={settings.bloomStrength}
                  onChange={(e) => onSettingsChange({ bloomStrength: parseFloat(e.target.value) })}
                  className="w-full h-1.5"
                  style={{ accentColor: theme.wikiLink }}
                />
              </div>
            )}
            
            {/* Show Arrows Toggle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Pfeile</span>
                <button
                  onClick={() => onSettingsChange({ showArrows: !settings.showArrows })}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    settings.showArrows 
                      ? 'bg-primary/20 text-primary border border-primary/30' 
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {settings.showArrows ? 'An' : 'Aus'}
                </button>
              </div>
            </div>
            
            {/* Curved Links Toggle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Linien</span>
                <button
                  onClick={() => onSettingsChange({ curvedLinks: !settings.curvedLinks })}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    settings.curvedLinks 
                      ? 'bg-primary/20 text-primary border border-primary/30' 
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {settings.curvedLinks ? 'Kurvig' : 'Gerade'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

