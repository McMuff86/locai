"use client";

import React from 'react';
import {
  Crop,
  FlipHorizontal,
  FlipVertical,
  Maximize,
  RotateCcw,
  RotateCw,
  Sun,
  Contrast,
  Droplets,
  CircleDot,
  Paintbrush,
  Eraser,
  Type,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Pipette,
  Undo2,
  Redo2,
  RotateCcw as ResetIcon,
  Save,
  SaveAll,
  Download,
  Eye,
  Sparkles,
  MessageSquare,
  SplitSquareHorizontal,
  Palette,
  Move,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ImageTool, DrawSettings, AdjustSettings, ShapeType } from '@/hooks/useImageEditor';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImageToolbarProps {
  activeTool: ImageTool;
  onToolChange: (tool: ImageTool) => void;
  drawSettings: DrawSettings;
  onDrawSettingChange: <K extends keyof DrawSettings>(key: K, val: DrawSettings[K]) => void;
  adjustSettings: AdjustSettings;
  onAdjustSettingChange: <K extends keyof AdjustSettings>(key: K, val: AdjustSettings[K]) => void;
  onApplyAdjustments: () => void;
  onResetAdjustments: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: () => void;
  onRotate: (deg: number) => void;
  onFlip: (dir: 'h' | 'v') => void;
  onApplyCrop: () => void;
  cropActive: boolean;
  compareMode: boolean;
  onToggleCompare: () => void;
  isDirty: boolean;
  comfyAvailable: boolean;
  rotation: number;
  onRotationChange: (deg: number) => void;
}

// ── ToolButton ────────────────────────────────────────────────────────────────

function ToolBtn({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? 'default' : 'ghost'}
          size="sm"
          className={`h-7 w-7 p-0 ${active ? 'bg-primary text-primary-foreground' : ''}`}
          onClick={onClick}
          disabled={disabled}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-border/50 mx-0.5" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImageToolbar({
  activeTool,
  onToolChange,
  drawSettings,
  onDrawSettingChange,
  adjustSettings,
  onAdjustSettingChange,
  onApplyAdjustments,
  onResetAdjustments,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  onSave,
  onSaveAs,
  onExport,
  onRotate,
  onFlip,
  onApplyCrop,
  cropActive,
  compareMode,
  onToggleCompare,
  isDirty,
  comfyAvailable,
  rotation,
  onRotationChange,
}: ImageToolbarProps) {
  const isAdjustTool = ['brightness', 'contrast', 'saturation', 'blur', 'sharpen', 'grayscale', 'sepia', 'invert'].includes(activeTool);
  const isDrawTool = ['draw', 'eraser', 'text', 'shapes', 'colorPicker', 'blurRegion'].includes(activeTool);
  const isTransformTool = ['crop', 'resize', 'rotate', 'flip'].includes(activeTool);

  const shapeIcons: Record<ShapeType, React.ComponentType<{ className?: string }>> = {
    rect: Square,
    circle: Circle,
    line: Minus,
    arrow: ArrowRight,
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-1 border-b border-border/40 bg-muted/20 px-2 py-1.5">
        {/* Main toolbar row */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {/* Utility */}
          <ToolBtn icon={Undo2} label="Rückgängig (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
          <ToolBtn icon={Redo2} label="Wiederherstellen (Ctrl+Y)" onClick={onRedo} disabled={!canRedo} />
          <ToolBtn icon={ResetIcon} label="Zurücksetzen" onClick={onReset} />
          <Sep />

          {/* Transform */}
          <ToolBtn icon={Move} label="Auswahl" active={activeTool === 'select'} onClick={() => onToolChange('select')} />
          <ToolBtn icon={Crop} label="Zuschneiden" active={activeTool === 'crop'} onClick={() => onToolChange('crop')} />
          <ToolBtn icon={Maximize} label="Grösse ändern" active={activeTool === 'resize'} onClick={() => onToolChange('resize')} />
          <ToolBtn icon={RotateCw} label="90° rechts" onClick={() => onRotate(90)} />
          <ToolBtn icon={RotateCcw} label="90° links" onClick={() => onRotate(-90)} />
          <ToolBtn icon={FlipHorizontal} label="H spiegeln" onClick={() => onFlip('h')} />
          <ToolBtn icon={FlipVertical} label="V spiegeln" onClick={() => onFlip('v')} />
          <Sep />

          {/* Adjust */}
          <ToolBtn icon={Sun} label="Helligkeit" active={activeTool === 'brightness'} onClick={() => onToolChange('brightness')} />
          <ToolBtn icon={Contrast} label="Kontrast" active={activeTool === 'contrast'} onClick={() => onToolChange('contrast')} />
          <ToolBtn icon={Droplets} label="Sättigung" active={activeTool === 'saturation'} onClick={() => onToolChange('saturation')} />
          <ToolBtn icon={CircleDot} label="Weichzeichnen" active={activeTool === 'blur'} onClick={() => onToolChange('blur')} />
          <Sep />

          {/* Draw */}
          <ToolBtn icon={Paintbrush} label="Zeichnen" active={activeTool === 'draw'} onClick={() => onToolChange('draw')} />
          <ToolBtn icon={Eraser} label="Radierer" active={activeTool === 'eraser'} onClick={() => onToolChange('eraser')} />
          <ToolBtn icon={Type} label="Text" active={activeTool === 'text'} onClick={() => onToolChange('text')} />
          <ToolBtn icon={Square} label="Formen" active={activeTool === 'shapes'} onClick={() => onToolChange('shapes')} />
          <ToolBtn icon={Pipette} label="Farbpipette" active={activeTool === 'colorPicker'} onClick={() => onToolChange('colorPicker')} />
          <ToolBtn icon={Eye} label="Region weichzeichnen" active={activeTool === 'blurRegion'} onClick={() => onToolChange('blurRegion')} />
          <Sep />

          {/* AI */}
          <ToolBtn icon={MessageSquare} label="AI Beschreibung" active={activeTool === 'aiDescribe'} onClick={() => onToolChange('aiDescribe')} />
          <ToolBtn icon={Sparkles} label="AI Bearbeiten" active={activeTool === 'aiEdit'} onClick={() => onToolChange('aiEdit')} disabled={!comfyAvailable} />
          <ToolBtn icon={SplitSquareHorizontal} label="Vorher/Nachher" active={compareMode} onClick={onToggleCompare} />
          <Sep />

          {/* Save */}
          <ToolBtn icon={Save} label="Speichern" onClick={onSave} disabled={!isDirty} />
          <ToolBtn icon={SaveAll} label="Speichern unter..." onClick={onSaveAs} />
          <ToolBtn icon={Download} label="Exportieren" onClick={onExport} />
        </div>

        {/* Secondary toolbar - context sensitive */}
        {cropActive && activeTool === 'crop' && (
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-6 text-xs px-2" onClick={onApplyCrop}>
              Zuschneiden anwenden
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => onToolChange('select')}>
              Abbrechen
            </Button>
          </div>
        )}

        {activeTool === 'rotate' && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs text-muted-foreground w-14">Rotation</span>
            <Slider
              value={[rotation]}
              onValueChange={([v]) => onRotationChange(v)}
              min={-180}
              max={180}
              step={1}
              className="flex-1 max-w-48"
            />
            <span className="text-xs font-mono w-10 text-right">{rotation}°</span>
          </div>
        )}

        {isAdjustTool && (
          <div className="flex items-center gap-2 px-1">
            {activeTool === 'brightness' && (
              <>
                <span className="text-xs text-muted-foreground w-14">Helligkeit</span>
                <Slider
                  value={[adjustSettings.brightness]}
                  onValueChange={([v]) => onAdjustSettingChange('brightness', v)}
                  min={-100}
                  max={100}
                  step={1}
                  className="flex-1 max-w-48"
                />
                <span className="text-xs font-mono w-8 text-right">{adjustSettings.brightness}</span>
              </>
            )}
            {activeTool === 'contrast' && (
              <>
                <span className="text-xs text-muted-foreground w-14">Kontrast</span>
                <Slider
                  value={[adjustSettings.contrast]}
                  onValueChange={([v]) => onAdjustSettingChange('contrast', v)}
                  min={-100}
                  max={100}
                  step={1}
                  className="flex-1 max-w-48"
                />
                <span className="text-xs font-mono w-8 text-right">{adjustSettings.contrast}</span>
              </>
            )}
            {activeTool === 'saturation' && (
              <>
                <span className="text-xs text-muted-foreground w-14">Sättigung</span>
                <Slider
                  value={[adjustSettings.saturation]}
                  onValueChange={([v]) => onAdjustSettingChange('saturation', v)}
                  min={0}
                  max={200}
                  step={1}
                  className="flex-1 max-w-48"
                />
                <span className="text-xs font-mono w-8 text-right">{adjustSettings.saturation}%</span>
              </>
            )}
            {activeTool === 'blur' && (
              <>
                <span className="text-xs text-muted-foreground w-14">Unschärfe</span>
                <Slider
                  value={[adjustSettings.blur]}
                  onValueChange={([v]) => onAdjustSettingChange('blur', v)}
                  min={0}
                  max={20}
                  step={0.5}
                  className="flex-1 max-w-48"
                />
                <span className="text-xs font-mono w-8 text-right">{adjustSettings.blur}px</span>
              </>
            )}
            {(activeTool === 'sharpen' || activeTool === 'grayscale' || activeTool === 'sepia' || activeTool === 'invert') && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={adjustSettings[activeTool] ? 'default' : 'outline'}
                  className="h-6 text-xs"
                  onClick={() => onAdjustSettingChange(activeTool as 'sharpen' | 'grayscale' | 'sepia' | 'invert', !adjustSettings[activeTool as 'sharpen' | 'grayscale' | 'sepia' | 'invert'])}
                >
                  {adjustSettings[activeTool as keyof AdjustSettings] ? 'Aktiv' : 'Inaktiv'}
                </Button>
              </div>
            )}
            <Button size="sm" className="h-6 text-xs px-2 ml-auto" onClick={onApplyAdjustments}>
              Anwenden
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onResetAdjustments}>
              Zurücksetzen
            </Button>
          </div>
        )}

        {isDrawTool && (
          <div className="flex items-center gap-2 px-1 flex-wrap">
            {/* Color picker */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Farbe</span>
              <input
                type="color"
                value={drawSettings.color}
                onChange={(e) => onDrawSettingChange('color', e.target.value)}
                className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
              />
            </div>

            {/* Brush size */}
            {(activeTool === 'draw' || activeTool === 'eraser') && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Grösse</span>
                <Slider
                  value={[drawSettings.brushSize]}
                  onValueChange={([v]) => onDrawSettingChange('brushSize', v)}
                  min={1}
                  max={50}
                  step={1}
                  className="w-24"
                />
                <span className="text-xs font-mono w-6 text-right">{drawSettings.brushSize}</span>
              </div>
            )}

            {/* Brush opacity / strength */}
            {(activeTool === 'draw' || activeTool === 'eraser') && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Stärke</span>
                <Slider
                  value={[drawSettings.brushOpacity]}
                  onValueChange={([v]) => onDrawSettingChange('brushOpacity', v)}
                  min={1}
                  max={100}
                  step={1}
                  className="w-24"
                />
                <span className="text-xs font-mono w-8 text-right">{drawSettings.brushOpacity}%</span>
              </div>
            )}

            {/* Brush flow */}
            {(activeTool === 'draw' || activeTool === 'eraser') && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Fluss</span>
                <Slider
                  value={[drawSettings.brushFlow]}
                  onValueChange={([v]) => onDrawSettingChange('brushFlow', v)}
                  min={1}
                  max={100}
                  step={1}
                  className="w-24"
                />
                <span className="text-xs font-mono w-8 text-right">{drawSettings.brushFlow}%</span>
              </div>
            )}

            {/* Font size for text */}
            {activeTool === 'text' && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Schrift</span>
                <Slider
                  value={[drawSettings.fontSize]}
                  onValueChange={([v]) => onDrawSettingChange('fontSize', v)}
                  min={8}
                  max={72}
                  step={1}
                  className="w-24"
                />
                <span className="text-xs font-mono w-6 text-right">{drawSettings.fontSize}</span>
              </div>
            )}

            {/* Shape options */}
            {activeTool === 'shapes' && (
              <>
                <div className="flex items-center gap-0.5">
                  {(['rect', 'circle', 'line', 'arrow'] as ShapeType[]).map((s) => {
                    const ShapeIcon = shapeIcons[s];
                    return (
                      <ToolBtn
                        key={s}
                        icon={ShapeIcon}
                        label={s}
                        active={drawSettings.shapeType === s}
                        onClick={() => onDrawSettingChange('shapeType', s)}
                      />
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  variant={drawSettings.shapeFilled ? 'default' : 'outline'}
                  className="h-6 text-xs px-2"
                  onClick={() => onDrawSettingChange('shapeFilled', !drawSettings.shapeFilled)}
                >
                  <Palette className="h-3 w-3 mr-1" />
                  {drawSettings.shapeFilled ? 'Gefüllt' : 'Umriss'}
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Stärke</span>
                  <Slider
                    value={[drawSettings.strokeWidth]}
                    onValueChange={([v]) => onDrawSettingChange('strokeWidth', v)}
                    min={1}
                    max={20}
                    step={1}
                    className="w-20"
                  />
                  <span className="text-xs font-mono w-4">{drawSettings.strokeWidth}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
