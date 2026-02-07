"use client";

import React, { createContext, useContext, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { FileText, Network, Loader2 } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useModels } from '@/hooks/useModels';
import { useNotes, useGraph } from '@/components/notes';
import { NoteSummary } from '@/components/notes/types';

// Context for sharing notes data between pages
interface NotesContextValue {
  basePath: string | undefined;
  notes: NoteSummary[];
  loading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  selectedModel: string;
  installedModels: string[];
  host?: string;
  searxngUrl?: string;
  // Graph data
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

const NotesContext = createContext<NotesContextValue | null>(null);

export function useNotesContext() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotesContext must be used within NotesLayout');
  }
  return context;
}

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { settings, isLoaded } = useSettings();
  const { models, selectedModel } = useModels(settings?.ollamaHost);
  
  const basePath = settings?.notesPath;
  
  const {
    notes,
    loading,
    error,
    fetchNotes,
  } = useNotes({ basePath });

  const {
    semanticLinks,
    semanticThreshold,
    setSemanticThreshold,
    graphData,
    graphSettings,
    updateGraphSettings,
    isGeneratingEmbeddings,
    embeddingsStatus,
    setEmbeddingsStatus,
    graphExpanded,
    setGraphExpanded,
    hoveredNode,
    setHoveredNode,
    selectedNode,
    setSelectedNode,
    physicsPaused,
    setPhysicsPaused,
    searchQuery,
    setSearchQuery,
    searchMatches,
    generateEmbeddings,
    fetchSemanticLinks,
  } = useGraph({ basePath, notes });

  // Fetch notes on mount
  useEffect(() => {
    if (basePath) {
      fetchNotes();
    }
  }, [basePath, fetchNotes]);

  // Tab items
  const tabs = [
    { href: '/notes', label: 'Notizen', icon: FileText, exact: true },
    { href: '/notes/graph', label: 'Verknüpfungen', icon: Network, exact: false },
  ];

  // Show loading while settings are being loaded
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const contextValue: NotesContextValue = {
    basePath,
    notes,
    loading,
    error,
    fetchNotes,
    selectedModel,
    installedModels: models.map(m => m.name),
    host: settings?.ollamaHost,
    searxngUrl: settings?.searxngUrl,
    semanticLinks,
    semanticThreshold,
    setSemanticThreshold,
    graphData,
    graphSettings,
    updateGraphSettings,
    isGeneratingEmbeddings,
    embeddingsStatus,
    setEmbeddingsStatus,
    graphExpanded,
    setGraphExpanded,
    hoveredNode,
    setHoveredNode,
    selectedNode,
    setSelectedNode,
    physicsPaused,
    setPhysicsPaused,
    searchQuery,
    setSearchQuery,
    searchMatches,
    generateEmbeddings,
    fetchSemanticLinks,
  };

  return (
    <NotesContext.Provider value={contextValue}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex-shrink-0 border-b border-border bg-muted/30">
          <div className="flex items-center px-4">
            {tabs.map((tab) => {
              const isActive = tab.exact 
                ? pathname === tab.href 
                : pathname?.startsWith(tab.href);
              
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </NotesContext.Provider>
  );
}
