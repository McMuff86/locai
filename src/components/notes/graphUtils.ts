import { GraphTheme } from './types';

// Theme color definitions
export interface ThemeColors {
  nodeColors: string[];
  wikiLink: string;
  semanticLink: string;
  background: string;
  glow: boolean;
}

export const graphThemes: Record<GraphTheme, ThemeColors> = {
  cyber: {
    nodeColors: ['#88d4ff', '#a8ffcc', '#ffd866', '#ffaa66', '#88ffff', '#ff88cc', '#ccff88', '#ffcc88'],
    wikiLink: '#88ccff',
    semanticLink: '#ffd700',
    background: 'linear-gradient(135deg, rgba(5,12,25,0.98) 0%, rgba(0,8,18,0.99) 100%)',
    glow: true,
  },
  obsidian: {
    nodeColors: ['#a78bfa', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#f472b6', '#22d3d8', '#a3e635'],
    wikiLink: '#a78bfa',
    semanticLink: '#34d399',
    background: 'linear-gradient(135deg, rgba(15,15,22,0.98) 0%, rgba(10,10,16,0.99) 100%)',
    glow: true,
  },
  neon: {
    nodeColors: ['#ff44ff', '#44ffff', '#ffff44', '#ff8844', '#44ff88', '#ff4488', '#8844ff', '#44ff44'],
    wikiLink: '#ff66ff',
    semanticLink: '#66ffff',
    background: 'linear-gradient(135deg, rgba(20,5,35,0.98) 0%, rgba(12,0,22,0.99) 100%)',
    glow: true,
  },
  minimal: {
    nodeColors: ['#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#9ca3af', '#d1d5db', '#a1a1aa', '#d4d4d8'],
    wikiLink: '#94a3b8',
    semanticLink: '#64748b',
    background: 'rgba(0, 0, 0, 0.02)',
    glow: false,
  },
};

export function getThemeColors(theme: GraphTheme): ThemeColors {
  return graphThemes[theme];
}

// Color function for graph nodes based on first tag
export function getNodeColor(node: { tags?: string[] }, theme: GraphTheme): string {
  const themeColors = getThemeColors(theme);
  const colors = themeColors.nodeColors;
  
  if (!node.tags || node.tags.length === 0) return '#6b7280'; // gray
  
  // Simple hash based on first tag
  const firstTag = node.tags[0] || '';
  let hash = 0;
  for (let i = 0; i < firstTag.length; i++) {
    hash = firstTag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Mix color with white for neon glow effect
export function mixWithWhite(hexColor: string, whiteAmount: number): string {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Mix with white
  const mixedR = Math.round(r + (255 - r) * whiteAmount);
  const mixedG = Math.round(g + (255 - g) * whiteAmount);
  const mixedB = Math.round(b + (255 - b) * whiteAmount);
  
  return `#${mixedR.toString(16).padStart(2, '0')}${mixedG.toString(16).padStart(2, '0')}${mixedB.toString(16).padStart(2, '0')}`;
}

