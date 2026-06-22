"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Activity,
  BookmarkPlus,
  Briefcase,
  Clock,
  FileText,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ExternalAgentPanel } from '@/components/workspace/ExternalAgentPanel';
import { cn } from '@/lib/utils';
import type {
  WorkspaceArtifact,
  WorkspaceArtifactWithContent,
  WorkspaceProject,
  ArtifactSavepoint,
  RunLedgerEntry,
  ToolGatewayEntry,
} from '@/lib/workspace/types';

interface ProjectsResponse {
  success: boolean;
  projects?: WorkspaceProject[];
  error?: string;
}

interface ArtifactsResponse {
  success: boolean;
  artifacts?: WorkspaceArtifact[];
  error?: string;
}

interface ArtifactResponse {
  success: boolean;
  artifact?: WorkspaceArtifactWithContent;
  error?: string;
}

interface SavepointsResponse {
  success: boolean;
  savepoints?: ArtifactSavepoint[];
  error?: string;
}

interface RunsResponse {
  success: boolean;
  runs?: RunLedgerEntry[];
  error?: string;
}

interface ToolsResponse {
  success: boolean;
  tools?: ToolGatewayEntry[];
  error?: string;
}

const artifactTypeLabels: Record<string, string> = {
  research_brief: 'Research',
  document: 'Doc',
  sheet: 'Sheet',
  deck: 'Deck',
  report: 'Report',
  code_app: 'Code',
  image: 'Image',
  audio: 'Audio',
  workflow_result: 'Workflow',
  file_batch: 'Files',
};

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('de-CH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }
  return data as T;
}

function researchBriefTemplate(title: string): string {
  return `# ${title}

## Goal


## Plan


## Sources


## Findings


## Analysis


## Risks / assumptions


## Open questions


## Next actions

`;
}

function toArtifactSummary(artifact: WorkspaceArtifactWithContent): WorkspaceArtifact {
  return {
    id: artifact.id,
    projectId: artifact.projectId,
    type: artifact.type,
    title: artifact.title,
    description: artifact.description,
    status: artifact.status,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    contentPath: artifact.contentPath,
    sourceRefs: artifact.sourceRefs,
    savepointIds: artifact.savepointIds,
    runIds: artifact.runIds,
    exportPaths: artifact.exportPaths,
    modelProvenance: artifact.modelProvenance,
  };
}

export default function WorkspacePage() {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [artifacts, setArtifacts] = useState<WorkspaceArtifact[]>([]);
  const [savepoints, setSavepoints] = useState<ArtifactSavepoint[]>([]);
  const [runs, setRuns] = useState<RunLedgerEntry[]>([]);
  const [tools, setTools] = useState<ToolGatewayEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<WorkspaceArtifactWithContent | null>(null);
  const [artifactContent, setArtifactContent] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newArtifactTitle, setNewArtifactTitle] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);
  const [isLoadingArtifact, setIsLoadingArtifact] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingSavepoint, setIsCreatingSavepoint] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const gatewaySummary = useMemo(() => {
    const approvalRequired = tools.filter((tool) => tool.approvalPolicy !== 'none').length;
    return {
      approvalRequired,
      safeTools: tools.length - approvalRequired,
    };
  }, [tools]);

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setError(null);
    try {
      const data = await fetchJson<ProjectsResponse>('/api/workspace/projects');
      const nextProjects = data.projects || [];
      setProjects(nextProjects);
      setSelectedProjectId((current) => {
        if (current && nextProjects.some((project) => project.id === current)) return current;
        return nextProjects[0]?.id || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Projekte konnten nicht geladen werden');
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const loadArtifacts = useCallback(async (projectId: string) => {
    setIsLoadingArtifacts(true);
    setError(null);
    try {
      const data = await fetchJson<ArtifactsResponse>(
        `/api/workspace/artifacts?projectId=${encodeURIComponent(projectId)}`,
      );
      const nextArtifacts = data.artifacts || [];
      setArtifacts(nextArtifacts);
      setSelectedArtifactId((current) => {
        if (current && nextArtifacts.some((artifact) => artifact.id === current)) return current;
        return nextArtifacts[0]?.id || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artefakte konnten nicht geladen werden');
    } finally {
      setIsLoadingArtifacts(false);
    }
  }, []);

  const loadArtifact = useCallback(async (artifactId: string) => {
    setIsLoadingArtifact(true);
    setError(null);
    try {
      const data = await fetchJson<ArtifactResponse>(
        `/api/workspace/artifacts/${encodeURIComponent(artifactId)}`,
      );
      setSelectedArtifact(data.artifact || null);
      setArtifactContent(data.artifact?.content || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artefakt konnte nicht geladen werden');
    } finally {
      setIsLoadingArtifact(false);
    }
  }, []);

  const loadSavepoints = useCallback(async (artifactId: string) => {
    try {
      const data = await fetchJson<SavepointsResponse>(
        `/api/workspace/artifacts/${encodeURIComponent(artifactId)}/savepoints`,
      );
      setSavepoints(data.savepoints || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Savepoints konnten nicht geladen werden');
    }
  }, []);

  const loadRuns = useCallback(async (projectId: string, artifactId?: string) => {
    try {
      const params = new URLSearchParams({ projectId });
      if (artifactId) params.set('artifactId', artifactId);
      const data = await fetchJson<RunsResponse>(`/api/workspace/runs?${params.toString()}`);
      setRuns(data.runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run-Ledger konnte nicht geladen werden');
    }
  }, []);

  const loadTools = useCallback(async () => {
    try {
      const data = await fetchJson<ToolsResponse>('/api/workspace/tools');
      setTools(data.tools || []);
    } catch {
      // Tool gateway status is helpful but should not block workspace use.
      setTools([]);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    void loadTools();
  }, [loadProjects, loadTools]);

  useEffect(() => {
    if (!selectedProjectId) {
      setArtifacts([]);
      setSelectedArtifactId(null);
      return;
    }
    void loadArtifacts(selectedProjectId);
  }, [loadArtifacts, selectedProjectId]);

  useEffect(() => {
    if (!selectedArtifactId) {
      setSelectedArtifact(null);
      setArtifactContent('');
      setSavepoints([]);
      return;
    }
    void loadArtifact(selectedArtifactId);
    void loadSavepoints(selectedArtifactId);
  }, [loadArtifact, loadSavepoints, selectedArtifactId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setRuns([]);
      return;
    }
    void loadRuns(selectedProjectId, selectedArtifactId || undefined);
  }, [loadRuns, selectedArtifactId, selectedProjectId]);

  async function createNewProject() {
    const name = newProjectName.trim();
    if (!name) return;
    setError(null);
    try {
      const data = await fetchJson<{ success: boolean; project: WorkspaceProject }>(
        '/api/workspace/projects',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        },
      );
      setProjects((current) => [data.project, ...current]);
      setSelectedProjectId(data.project.id);
      setNewProjectName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Projekt konnte nicht erstellt werden');
    }
  }

  async function createResearchArtifact() {
    if (!selectedProjectId) return;
    const title = newArtifactTitle.trim() || 'Research Brief';
    setError(null);
    try {
      const data = await fetchJson<{ success: boolean; artifact: WorkspaceArtifactWithContent }>(
        '/api/workspace/artifacts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: selectedProjectId,
            type: 'research_brief',
            title,
            content: researchBriefTemplate(title),
          }),
        },
      );
      setArtifacts((current) => [toArtifactSummary(data.artifact), ...current]);
      setSelectedArtifactId(data.artifact.id);
      setSelectedArtifact(data.artifact);
      setArtifactContent(data.artifact.content);
      setNewArtifactTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artefakt konnte nicht erstellt werden');
    }
  }

  async function saveArtifact(): Promise<WorkspaceArtifactWithContent | null> {
    if (!selectedArtifact) return null;
    setIsSaving(true);
    setError(null);
    try {
      const data = await fetchJson<ArtifactResponse>(
        `/api/workspace/artifacts/${encodeURIComponent(selectedArtifact.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: artifactContent }),
        },
      );
      if (data.artifact) {
        setSelectedArtifact(data.artifact);
        setArtifacts((current) =>
          current.map((artifact) =>
            artifact.id === data.artifact?.id
              ? {
                  ...artifact,
                  updatedAt: data.artifact.updatedAt,
                  sourceRefs: data.artifact.sourceRefs,
                  exportPaths: data.artifact.exportPaths,
                }
              : artifact,
          ),
        );
        return data.artifact;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artefakt konnte nicht gespeichert werden');
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function createArtifactSavepoint() {
    if (!selectedArtifact) return;
    setIsCreatingSavepoint(true);
    setError(null);
    try {
      const savedArtifact = await saveArtifact();
      if (!savedArtifact) return;
      const artifactId = savedArtifact.id;
      const data = await fetchJson<{ success: boolean; savepoint: ArtifactSavepoint }>(
        `/api/workspace/artifacts/${encodeURIComponent(artifactId)}/savepoints`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Manual workspace savepoint', createdBy: 'user' }),
        },
      );
      setSavepoints((current) => [data.savepoint, ...current]);
      const nextArtifact = {
        ...savedArtifact,
        savepointIds: Array.from(new Set([...savedArtifact.savepointIds, data.savepoint.id])),
        updatedAt: data.savepoint.createdAt,
      };
      setSelectedArtifact(nextArtifact);
      setArtifacts((current) =>
        current.map((artifact) =>
          artifact.id === artifactId
            ? {
                ...artifact,
                savepointIds: Array.from(new Set([...artifact.savepointIds, data.savepoint.id])),
                updatedAt: data.savepoint.createdAt,
              }
            : artifact,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Savepoint konnte nicht erstellt werden');
    } finally {
      setIsCreatingSavepoint(false);
    }
  }

  const emptyProjectState = !isLoadingProjects && projects.length === 0;
  const emptyArtifactState = !isLoadingArtifacts && selectedProject && artifacts.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card">
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight">Workspace</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{projects.length} Projekte</span>
                <span>{artifacts.length} Artefakte im aktuellen Projekt</span>
                <span>{tools.length} Tools im Gateway</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 gap-2">
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void createNewProject();
                }}
                placeholder="Projektname"
                className="w-full sm:w-48"
              />
              <Button
                onClick={() => void createNewProject()}
                disabled={!newProjectName.trim()}
                title="Projekt erstellen"
              >
                <Plus className="h-4 w-4" />
                Projekt
              </Button>
            </div>
            <Button variant="outline" onClick={() => void loadProjects()} title="Aktualisieren">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="mt-3">
          <ExternalAgentPanel
            projectId={selectedProjectId}
            artifactId={selectedArtifactId}
            onRunComplete={() => {
              if (selectedProjectId) void loadRuns(selectedProjectId, selectedArtifactId || undefined);
            }}
          />
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[260px_320px_minmax(0,1fr)]">
        <aside className="min-h-0 border-b border-border/60 lg:border-b-0 lg:border-r">
          <div className="flex h-11 items-center justify-between border-b border-border/60 px-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Projekte
            </div>
            {isLoadingProjects && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="h-full overflow-y-auto p-2">
            {emptyProjectState ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Noch keine Projekte.
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => {
                  const active = project.id === selectedProjectId;
                  return (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left transition-colors',
                        active
                          ? 'bg-primary/15 text-primary'
                          : 'text-foreground hover:bg-muted/60',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{project.name}</span>
                        {project.status === 'archived' && (
                          <Archive className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span>{project.artifactIds.length}</span>
                        <Clock className="h-3.5 w-3.5" />
                        <span className="truncate">{formatDate(project.updatedAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <aside className="min-h-0 border-b border-border/60 lg:border-b-0 lg:border-r">
          <div className="flex h-11 items-center justify-between border-b border-border/60 px-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Artefakte
            </div>
            {isLoadingArtifacts && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="border-b border-border/60 p-2">
            <div className="flex gap-2">
              <Input
                value={newArtifactTitle}
                onChange={(event) => setNewArtifactTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void createResearchArtifact();
                }}
                placeholder="Research Brief"
                disabled={!selectedProjectId}
              />
              <Button
                onClick={() => void createResearchArtifact()}
                disabled={!selectedProjectId}
                title="Research-Brief erstellen"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="h-full overflow-y-auto p-2">
            {emptyArtifactState ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Noch keine Artefakte.
              </div>
            ) : (
              <div className="space-y-1">
                {artifacts.map((artifact) => {
                  const active = artifact.id === selectedArtifactId;
                  return (
                    <button
                      key={artifact.id}
                      onClick={() => setSelectedArtifactId(artifact.id)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-transparent hover:border-border hover:bg-muted/50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-sm font-medium">{artifact.title}</span>
                        <Badge variant="outline" className="flex-shrink-0 rounded-md">
                          {artifactTypeLabels[artifact.type] || artifact.type}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{artifact.status}</span>
                        <span className="truncate">{formatDate(artifact.updatedAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden">
          {isLoadingArtifact ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Lade Artefakt
            </div>
          ) : selectedArtifact ? (
            <>
              <div className="border-b border-border/60 px-4 py-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-md">
                        {artifactTypeLabels[selectedArtifact.type] || selectedArtifact.type}
                      </Badge>
                      <Badge variant="outline" className="rounded-md">
                        {selectedArtifact.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(selectedArtifact.updatedAt)}
                      </span>
                    </div>
                    <h2 className="truncate text-lg font-semibold">{selectedArtifact.title}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void loadArtifact(selectedArtifact.id)}
                      title="Artefakt neu laden"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reload
                    </Button>
                    <Button onClick={() => void saveArtifact()} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void createArtifactSavepoint()}
                      disabled={isSaving || isCreatingSavepoint}
                      title="Savepoint erstellen"
                    >
                      {isCreatingSavepoint ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <BookmarkPlus className="h-4 w-4" />
                      )}
                      Savepoint
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-h-0 overflow-hidden p-4">
                  <Textarea
                    value={artifactContent}
                    onChange={(event) => setArtifactContent(event.target.value)}
                    className="h-full min-h-[420px] resize-none font-mono text-sm leading-6"
                  />
                </div>

                <aside className="border-t border-border/60 p-4 xl:border-l xl:border-t-0">
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        Quellen
                      </div>
                      {selectedArtifact.sourceRefs.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          Keine Quellen verknüpft.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedArtifact.sourceRefs.map((source) => (
                            <div key={source.id} className="rounded-lg border p-3">
                              <div className="text-sm font-medium">{source.title}</div>
                              <div className="text-xs text-muted-foreground">{source.kind}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-medium">Provenienz</div>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Savepoints</dt>
                          <dd>{selectedArtifact.savepointIds.length}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Runs</dt>
                          <dd>{runs.length}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Exports</dt>
                          <dd>{selectedArtifact.exportPaths.length}</dd>
                        </div>
                      </dl>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <BookmarkPlus className="h-4 w-4 text-muted-foreground" />
                        Savepoints
                      </div>
                      {savepoints.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          Noch keine Savepoints.
                        </div>
                      ) : (
                        <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                          {savepoints.map((savepoint) => (
                            <div key={savepoint.id} className="rounded-lg border p-3 text-sm">
                              <div className="font-medium">{savepoint.reason}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {savepoint.createdBy} · {formatDate(savepoint.createdAt)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        Run-Ledger
                      </div>
                      {runs.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          Noch keine Runs verknüpft.
                        </div>
                      ) : (
                        <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                          {runs.map((run) => (
                            <div key={run.id} className="rounded-lg border p-3 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-medium">{run.toolId}</span>
                                <Badge variant={run.success === false ? 'destructive' : 'outline'} className="rounded-md">
                                  {run.success === undefined ? 'running' : run.success ? 'ok' : 'fail'}
                                </Badge>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {run.approvalPolicy} · {formatDate(run.completedAt || run.startedAt)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-medium">Gateway</div>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Audit-Tools</dt>
                          <dd>{tools.length}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Ohne Approval</dt>
                          <dd>{gatewaySummary.safeTools}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Approval nötig</dt>
                          <dd>{gatewaySummary.approvalRequired}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-sm rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {selectedProject
                  ? 'Wähle ein Artefakt oder erstelle einen Research Brief.'
                  : 'Erstelle zuerst ein Projekt.'}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
