/**
 * Types for the Image Gallery components
 */

export interface ImageInfo {
  id: string;
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  type?: 'image' | 'video';
}

export interface ImageMetadata {
  positivePrompt?: string;
  negativePrompt?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  model?: string;
  width?: number;
  height?: number;
}

export type GridSize = 'tiny' | 'small' | 'medium' | 'large';
export type FilterMode = 'all' | 'favorites';

export interface GalleryConfig {
  comfyUIPath: string;
  outputPath?: string;
}

// Grid CSS classes
export const GRID_CLASSES: Record<GridSize, string> = {
  tiny: 'grid-cols-6 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-1',
  small: 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5',
  medium: 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2',
  large: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3',
};

// LocalStorage keys
export const FAVORITES_KEY = 'locai-gallery-favorites';

