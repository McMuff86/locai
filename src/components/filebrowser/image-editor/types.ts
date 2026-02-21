// ============================================================================
// Image Editor — Shared Types
// ============================================================================

export interface ImageEditorProps {
  imageUrl: string;
  rootId: string;
  relativePath: string;
  fileName: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayerBase {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  lineHeight: number;
  tracking: number;
  kerning: number;
  align: 'left' | 'center' | 'right';
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundPadding: number;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  shapeType: 'rect' | 'circle' | 'line' | 'arrow';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  filled: boolean;
  strokeWidth: number;
}

export type AdjustmentType =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'blur'
  | 'sharpen'
  | 'grayscale'
  | 'sepia'
  | 'invert';

export interface AdjustmentLayer extends LayerBase {
  kind: 'adjustment';
  adjustmentType: AdjustmentType;
  enabled: boolean;
  value: number;
}

export type SceneLayer = TextLayer | ShapeLayer | AdjustmentLayer;

export interface HistoryEntry {
  id: string;
  label: string;
  createdAt: number;
  bitmapDataUrl: string;
  textLayers: TextLayer[];
  shapeLayers: ShapeLayer[];
  adjustmentLayers: AdjustmentLayer[];
  layerOrder: string[];
}

export interface TransformBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionState {
  mask: ImageData | null;
  bounds: { x: number; y: number; w: number; h: number } | null;
  active: boolean;
}

export const TEXT_LINE_HEIGHT = 1.2;
