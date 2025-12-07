// Shared types for Notes components
import { NoteSummary } from '@/lib/notes';

export interface NoteForm {
  title: string;
  content: string;
}

export interface SearchResult {
  noteId: string;
  title: string;
  tags: string[];
  score: number;
  snippet: string;
  matchType: 'title' | 'content' | 'tag';
}

export interface SemanticLink {
  source: string;
  target: string;
  similarity: number;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'wiki' | 'semantic';
  similarity?: number;
}

export interface GraphNode {
  id: string;
  name: string;
  val: number;
  tags: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export type GraphTheme = 'cyber' | 'obsidian' | 'neon' | 'minimal';
export type NodeGeometry = 'sphere' | 'box' | 'octahedron' | 'tetrahedron' | 'icon';

export interface GraphSettings {
  showLabels: boolean;
  graphTheme: GraphTheme;
  nodeGlow: boolean;
  linkGlow: boolean;
  nodeOpacity: number;
  linkOpacity: number;
  glowIntensity: number;
  nodeGeometry: NodeGeometry;
  showAdvancedSettings: boolean;
  labelSize: number;
  labelGlow: boolean;
  nodeSize: number;
  metalness: number;
  roughness: number;
  linkWidth: number;
  showArrows: boolean;
  bloomStrength: number;
  curvedLinks: boolean;
  labelColor: string;
}

export const defaultGraphSettings: GraphSettings = {
  showLabels: true,      // Labels standardmäßig ON
  graphTheme: 'cyber',
  nodeGlow: true,
  linkGlow: true,
  nodeOpacity: 0.9,
  linkOpacity: 0.45,
  glowIntensity: 0.5,
  nodeGeometry: 'sphere',
  showAdvancedSettings: true,
  labelSize: 1.0,        // 100% = optimale Größe (intern 2.5x skaliert)
  labelGlow: true,
  nodeSize: 1.0,         // 100% = optimale Größe (intern 0.2x skaliert)
  metalness: 0.3,
  roughness: 0.2,
  linkWidth: 0.4,
  showArrows: true,
  bloomStrength: 0.8,
  curvedLinks: true,
  labelColor: '#ffffff',
};

export const labelColorPresets = [
  { name: 'Weiß', color: '#ffffff' },
  { name: 'Schwarz', color: '#1a1a1a' },
  { name: 'Cyan', color: '#00ffff' },
  { name: 'Gold', color: '#ffd700' },
  { name: 'Grün', color: '#00ff88' },
  { name: 'Pink', color: '#ff69b4' },
  { name: 'Orange', color: '#ff8c00' },
];

// Re-export from lib/notes for convenience
export type { Note, NoteSummary } from '@/lib/notes';

