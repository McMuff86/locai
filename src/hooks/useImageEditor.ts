"use client";

import { useCallback, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageTool =
  | 'select'
  | 'crop'
  | 'resize'
  | 'rotate'
  | 'flip'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'blur'
  | 'sharpen'
  | 'grayscale'
  | 'sepia'
  | 'invert'
  | 'draw'
  | 'eraser'
  | 'text'
  | 'shapes'
  | 'colorPicker'
  | 'blurRegion'
  | 'aiDescribe'
  | 'aiEdit'
  | 'compare';

export type ShapeType = 'rect' | 'circle' | 'line' | 'arrow';

export interface DrawSettings {
  color: string;
  brushSize: number;
  fontSize: number;
  fontFamily: string;
  shapeType: ShapeType;
  shapeFilled: boolean;
  strokeWidth: number;
}

export interface AdjustSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  sharpen: boolean;
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_UNDO = 20;

const DEFAULT_DRAW: DrawSettings = {
  color: '#ff0000',
  brushSize: 4,
  fontSize: 24,
  fontFamily: 'sans-serif',
  shapeType: 'rect',
  shapeFilled: false,
  strokeWidth: 2,
};

const DEFAULT_ADJUST: AdjustSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 100,
  blur: 0,
  sharpen: false,
  grayscale: false,
  sepia: false,
  invert: false,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<ImageTool>('select');
  const [drawSettings, setDrawSettings] = useState<DrawSettings>({ ...DEFAULT_DRAW });
  const [adjustSettings, setAdjustSettings] = useState<AdjustSettings>({ ...DEFAULT_ADJUST });
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [rotation, setRotation] = useState(0);

  // Undo/Redo stacks store data URLs for simplicity
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const originalDataRef = useRef<string>('');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    undoStackRef.current.push(dataUrl);
    if (undoStackRef.current.length > MAX_UNDO) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    setIsDirty(true);
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save current to redo
    redoStackRef.current.push(canvas.toDataURL('image/png'));

    const prev = undoStackRef.current.pop()!;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setCanUndo(undoStackRef.current.length > 0);
      setCanRedo(true);
    };
    img.src = prev;
  }, []);

  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || redoStackRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save current to undo
    undoStackRef.current.push(canvas.toDataURL('image/png'));

    const next = redoStackRef.current.pop()!;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setCanUndo(true);
      setCanRedo(redoStackRef.current.length > 0);
    };
    img.src = next;
  }, []);

  const resetToOriginal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalDataRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
      setIsDirty(false);
      setAdjustSettings({ ...DEFAULT_ADJUST });
      setRotation(0);
      setCropRect(null);
    };
    img.src = originalDataRef.current;
  }, []);

  const setOriginal = useCallback((dataUrl: string) => {
    originalDataRef.current = dataUrl;
  }, []);

  const updateDrawSetting = useCallback(<K extends keyof DrawSettings>(key: K, value: DrawSettings[K]) => {
    setDrawSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateAdjustSetting = useCallback(<K extends keyof AdjustSettings>(key: K, value: AdjustSettings[K]) => {
    setAdjustSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetAdjustments = useCallback(() => {
    setAdjustSettings({ ...DEFAULT_ADJUST });
  }, []);

  return {
    canvasRef,
    activeTool,
    setActiveTool,
    drawSettings,
    setDrawSettings,
    updateDrawSetting,
    adjustSettings,
    setAdjustSettings,
    updateAdjustSetting,
    resetAdjustments,
    cropRect,
    setCropRect,
    isDirty,
    setIsDirty,
    compareMode,
    setCompareMode,
    comparePosition,
    setComparePosition,
    rotation,
    setRotation,
    canUndo,
    canRedo,
    saveState,
    undo,
    redo,
    resetToOriginal,
    setOriginal,
    originalDataRef,
  };
}
