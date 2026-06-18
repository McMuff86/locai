"use client";

import React, { createContext, useContext } from 'react';
import type { ModelInfo } from '@/lib/providers/types';
import type { NoteSummary } from './types';
import type { useGraph } from './hooks/useGraph';

export interface NotesContextValue {
  basePath: string | undefined;
  notes: NoteSummary[];
  loading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  selectedModel: string;
  installedModels: string[];
  allModels: ModelInfo[];
  host?: string;
  searxngUrl?: string;
  semanticLinks: { source: string; target: string; similarity: number }[];
  semanticThreshold: number;
  setSemanticThreshold: (threshold: number) => void;
  graphData: ReturnType<typeof useGraph>['graphData'];
  graphSettings: ReturnType<typeof useGraph>['graphSettings'];
  updateGraphSettings: ReturnType<typeof useGraph>['updateGraphSettings'];
  isGeneratingEmbeddings: boolean;
  embeddingsStatus: string | null;
  setEmbeddingsStatus: React.Dispatch<React.SetStateAction<string | null>>;
  graphExpanded: boolean;
  setGraphExpanded: (expanded: boolean) => void;
  hoveredNode: string | null;
  setHoveredNode: (nodeId: string | null) => void;
  selectedNode: string | null;
  setSelectedNode: (nodeId: string | null) => void;
  physicsPaused: boolean;
  setPhysicsPaused: (paused: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchMatches: string[];
  generateEmbeddings: (host?: string) => Promise<void>;
  fetchSemanticLinks: () => Promise<void>;
}

export const NotesContext = createContext<NotesContextValue | null>(null);

export function useNotesContext() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotesContext must be used within NotesLayout');
  }
  return context;
}
