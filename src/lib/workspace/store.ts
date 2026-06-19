import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import type {
  ArtifactSavepoint,
  ArtifactStatus,
  ArtifactType,
  CompleteRunLedgerEntryInput,
  CreateRunLedgerEntryInput,
  CreateWorkspaceArtifactInput,
  CreateWorkspaceProjectInput,
  RunLedgerEntry,
  SourceRef,
  UpdateWorkspaceArtifactInput,
  UpdateWorkspaceProjectInput,
  WorkspaceArtifact,
  WorkspaceArtifactWithContent,
  WorkspaceProject,
} from './types';

const INDEX_FILE = 'index.json';
const PROJECT_FILE = 'project.json';
const ARTIFACT_FILE = 'artifact.json';
const CONTENT_FILE = 'content.md';

interface ProjectIndexFile {
  version: 1;
  updatedAt: string;
  projects: WorkspaceProject[];
}

interface ArtifactRecord {
  project: WorkspaceProject;
  artifact: WorkspaceArtifact;
}

interface RunLedgerRecord {
  project: WorkspaceProject;
  entry: RunLedgerEntry;
}

function now(): string {
  return new Date().toISOString();
}

function homeDir(): string {
  return process.env.USERPROFILE || process.env.HOME || '/tmp';
}

export function defaultProjectsRoot(): string {
  return process.env.LOCAI_PROJECTS_PATH || path.join(homeDir(), '.locai', 'projects');
}

function assertSafeId(id: string, label: string): void {
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid ${label}`);
  }
}

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalizeTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
  );
}

function projectDir(root: string, projectId: string): string {
  assertSafeId(projectId, 'project ID');
  return path.join(root, projectId);
}

function projectFile(root: string, projectId: string): string {
  return path.join(projectDir(root, projectId), PROJECT_FILE);
}

function artifactDir(root: string, projectId: string, artifactId: string): string {
  assertSafeId(artifactId, 'artifact ID');
  return path.join(projectDir(root, projectId), 'artifacts', artifactId);
}

function artifactFile(root: string, projectId: string, artifactId: string): string {
  return path.join(artifactDir(root, projectId, artifactId), ARTIFACT_FILE);
}

function savepointFile(root: string, projectId: string, savepointId: string): string {
  assertSafeId(savepointId, 'savepoint ID');
  return path.join(projectDir(root, projectId), 'savepoints', `${savepointId}.json`);
}

function runFile(root: string, projectId: string, ledgerId: string): string {
  assertSafeId(ledgerId, 'run ledger ID');
  return path.join(projectDir(root, projectId), 'runs', `${ledgerId}.json`);
}

function contentPathForArtifact(artifactId: string): string {
  return path.posix.join('artifacts', artifactId, CONTENT_FILE);
}

function resolveProjectRelativeFile(root: string, projectId: string, relativePath: string): string {
  const base = path.resolve(projectDir(root, projectId));
  const candidate = path.resolve(base, ...relativePath.split('/').filter(Boolean));
  if (candidate !== base && !candidate.startsWith(base + path.sep)) {
    throw new Error('Invalid project-relative path');
  }
  return candidate;
}

async function ensureRoot(root: string): Promise<void> {
  await fs.mkdir(root, { recursive: true });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

async function quarantineCorruptJson(filePath: string): Promise<void> {
  try {
    const quarantinePath = `${filePath}.corrupt-${Date.now()}`;
    await fs.rename(filePath, quarantinePath);
  } catch {
    // Recovery is best-effort. The caller can continue as if the file is absent.
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    if (err instanceof SyntaxError) {
      await quarantineCorruptJson(filePath);
      return null;
    }
    throw err;
  }
}

async function loadProjectIndex(root: string): Promise<WorkspaceProject[]> {
  await ensureRoot(root);
  const parsed = await readJson<ProjectIndexFile | WorkspaceProject[]>(
    path.join(root, INDEX_FILE),
  );
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  return Array.isArray(parsed.projects) ? parsed.projects : [];
}

async function saveProjectIndex(root: string, projects: WorkspaceProject[]): Promise<void> {
  const sorted = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  await writeJson(path.join(root, INDEX_FILE), {
    version: 1,
    updatedAt: now(),
    projects: sorted,
  } satisfies ProjectIndexFile);
}

async function persistProject(project: WorkspaceProject, root: string): Promise<void> {
  await writeJson(projectFile(root, project.id), project);

  const index = await loadProjectIndex(root);
  const existing = index.findIndex((entry) => entry.id === project.id);
  if (existing >= 0) {
    index[existing] = project;
  } else {
    index.push(project);
  }
  await saveProjectIndex(root, index);
}

function validateProjectName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Project name is required');
  }
  return name.trim();
}

function validateArtifactTitle(title: unknown): string {
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Artifact title is required');
  }
  return title.trim();
}

function validateArtifactType(type: unknown): ArtifactType {
  const fallback: ArtifactType = 'research_brief';
  if (!type) return fallback;
  const allowed: ArtifactType[] = [
    'research_brief',
    'document',
    'sheet',
    'deck',
    'report',
    'code_app',
    'image',
    'audio',
    'workflow_result',
    'file_batch',
  ];
  if (typeof type === 'string' && allowed.includes(type as ArtifactType)) {
    return type as ArtifactType;
  }
  throw new Error('Invalid artifact type');
}

function validateArtifactStatus(status: unknown): ArtifactStatus {
  const allowed: ArtifactStatus[] = ['draft', 'review', 'final', 'archived'];
  if (typeof status === 'string' && allowed.includes(status as ArtifactStatus)) {
    return status as ArtifactStatus;
  }
  throw new Error('Invalid artifact status');
}

function normalizeSourceRefs(sourceRefs?: SourceRef[]): SourceRef[] {
  if (!Array.isArray(sourceRefs)) return [];
  return sourceRefs.map((source) => ({
    ...source,
    id: source.id || makeId('source'),
    capturedAt: source.capturedAt || now(),
  }));
}

async function readArtifactContent(root: string, artifact: WorkspaceArtifact): Promise<string> {
  try {
    return await fs.readFile(
      resolveProjectRelativeFile(root, artifact.projectId, artifact.contentPath),
      'utf-8',
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
}

async function writeArtifactContent(
  root: string,
  artifact: WorkspaceArtifact,
  content: string,
): Promise<void> {
  const filePath = resolveProjectRelativeFile(root, artifact.projectId, artifact.contentPath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

async function findArtifactRecord(
  artifactId: string,
  root: string,
): Promise<ArtifactRecord | null> {
  assertSafeId(artifactId, 'artifact ID');
  const projects = await listProjects(root);

  for (const project of projects) {
    if (!project.artifactIds.includes(artifactId)) continue;
    const artifact = await readJson<WorkspaceArtifact>(
      artifactFile(root, project.id, artifactId),
    );
    if (artifact) return { project, artifact };
  }

  return null;
}

async function findRunLedgerRecord(
  ledgerId: string,
  root: string,
): Promise<RunLedgerRecord | null> {
  assertSafeId(ledgerId, 'run ledger ID');
  const projects = await listProjects(root);

  for (const project of projects) {
    if (!project.runIds.includes(ledgerId)) continue;
    const entry = await readJson<RunLedgerEntry>(runFile(root, project.id, ledgerId));
    if (entry) return { project, entry };
  }

  return null;
}

export async function listProjects(basePath?: string): Promise<WorkspaceProject[]> {
  const root = basePath || defaultProjectsRoot();
  const index = await loadProjectIndex(root);
  return index.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function createProject(
  input: CreateWorkspaceProjectInput,
  basePath?: string,
): Promise<WorkspaceProject> {
  const root = basePath || defaultProjectsRoot();
  const timestamp = now();
  const project: WorkspaceProject = {
    id: makeId('project'),
    name: validateProjectName(input.name),
    description: input.description?.trim() || undefined,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: normalizeTags(input.tags),
    artifactIds: [],
    runIds: [],
  };

  await fs.mkdir(path.join(projectDir(root, project.id), 'artifacts'), { recursive: true });
  await fs.mkdir(path.join(projectDir(root, project.id), 'savepoints'), { recursive: true });
  await fs.mkdir(path.join(projectDir(root, project.id), 'sources'), { recursive: true });
  await fs.mkdir(path.join(projectDir(root, project.id), 'runs'), { recursive: true });
  await persistProject(project, root);
  return project;
}

export async function getProject(
  projectId: string,
  basePath?: string,
): Promise<WorkspaceProject | null> {
  const root = basePath || defaultProjectsRoot();
  assertSafeId(projectId, 'project ID');
  return readJson<WorkspaceProject>(projectFile(root, projectId));
}

export async function updateProject(
  projectId: string,
  input: UpdateWorkspaceProjectInput,
  basePath?: string,
): Promise<WorkspaceProject | null> {
  const root = basePath || defaultProjectsRoot();
  const project = await getProject(projectId, root);
  if (!project) return null;

  if (input.name !== undefined) project.name = validateProjectName(input.name);
  if (input.description !== undefined) {
    project.description = input.description.trim() || undefined;
  }
  if (input.status !== undefined) {
    if (input.status !== 'active' && input.status !== 'archived') {
      throw new Error('Invalid project status');
    }
    project.status = input.status;
  }
  if (input.tags !== undefined) project.tags = normalizeTags(input.tags);

  project.updatedAt = now();
  await persistProject(project, root);
  return project;
}

export async function deleteProject(projectId: string, basePath?: string): Promise<boolean> {
  const root = basePath || defaultProjectsRoot();
  assertSafeId(projectId, 'project ID');
  const project = await getProject(projectId, root);
  if (!project) return false;

  await fs.rm(projectDir(root, projectId), { recursive: true, force: true });
  const index = await loadProjectIndex(root);
  await saveProjectIndex(root, index.filter((entry) => entry.id !== projectId));
  return true;
}

export async function listArtifacts(
  projectId?: string,
  basePath?: string,
): Promise<WorkspaceArtifact[]> {
  const root = basePath || defaultProjectsRoot();
  const projects = projectId
    ? [await getProject(projectId, root)].filter(Boolean) as WorkspaceProject[]
    : await listProjects(root);

  const artifacts: WorkspaceArtifact[] = [];
  for (const project of projects) {
    for (const artifactId of project.artifactIds) {
      const artifact = await readJson<WorkspaceArtifact>(
        artifactFile(root, project.id, artifactId),
      );
      if (artifact) artifacts.push(artifact);
    }
  }

  return artifacts.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function createArtifact(
  input: CreateWorkspaceArtifactInput,
  basePath?: string,
): Promise<WorkspaceArtifactWithContent> {
  const root = basePath || defaultProjectsRoot();
  const project = await getProject(input.projectId, root);
  if (!project) throw new Error('Project not found');

  const timestamp = now();
  const artifactId = makeId('artifact');
  const artifact: WorkspaceArtifact = {
    id: artifactId,
    projectId: project.id,
    type: validateArtifactType(input.type),
    title: validateArtifactTitle(input.title),
    description: input.description?.trim() || undefined,
    status: 'draft',
    createdAt: timestamp,
    updatedAt: timestamp,
    contentPath: contentPathForArtifact(artifactId),
    sourceRefs: normalizeSourceRefs(input.sourceRefs),
    savepointIds: [],
    runIds: [],
    exportPaths: [],
  };

  await fs.mkdir(artifactDir(root, project.id, artifact.id), { recursive: true });
  await writeArtifactContent(root, artifact, input.content ?? '');
  await writeJson(artifactFile(root, project.id, artifact.id), artifact);

  project.artifactIds = Array.from(new Set([...project.artifactIds, artifact.id]));
  project.updatedAt = timestamp;
  await persistProject(project, root);

  return { ...artifact, content: input.content ?? '' };
}

export async function getArtifact(
  artifactId: string,
  basePath?: string,
): Promise<WorkspaceArtifactWithContent | null> {
  const root = basePath || defaultProjectsRoot();
  const record = await findArtifactRecord(artifactId, root);
  if (!record) return null;
  return {
    ...record.artifact,
    content: await readArtifactContent(root, record.artifact),
  };
}

export async function updateArtifact(
  artifactId: string,
  input: UpdateWorkspaceArtifactInput,
  basePath?: string,
): Promise<WorkspaceArtifactWithContent | null> {
  const root = basePath || defaultProjectsRoot();
  const record = await findArtifactRecord(artifactId, root);
  if (!record) return null;

  const artifact = { ...record.artifact };
  if (input.title !== undefined) artifact.title = validateArtifactTitle(input.title);
  if (input.description !== undefined) {
    artifact.description = input.description.trim() || undefined;
  }
  if (input.status !== undefined) artifact.status = validateArtifactStatus(input.status);
  if (input.sourceRefs !== undefined) artifact.sourceRefs = normalizeSourceRefs(input.sourceRefs);
  if (input.exportPaths !== undefined) {
    artifact.exportPaths = input.exportPaths.filter((entry) => typeof entry === 'string');
  }
  if (input.modelProvenance !== undefined) artifact.modelProvenance = input.modelProvenance;

  artifact.updatedAt = now();
  await writeJson(artifactFile(root, artifact.projectId, artifact.id), artifact);
  if (input.content !== undefined) {
    await writeArtifactContent(root, artifact, input.content);
  }

  record.project.updatedAt = artifact.updatedAt;
  await persistProject(record.project, root);

  return {
    ...artifact,
    content: input.content ?? await readArtifactContent(root, artifact),
  };
}

export async function deleteArtifact(artifactId: string, basePath?: string): Promise<boolean> {
  const root = basePath || defaultProjectsRoot();
  const record = await findArtifactRecord(artifactId, root);
  if (!record) return false;

  await fs.rm(artifactDir(root, record.project.id, artifactId), {
    recursive: true,
    force: true,
  });
  record.project.artifactIds = record.project.artifactIds.filter((id) => id !== artifactId);
  record.project.updatedAt = now();
  await persistProject(record.project, root);
  return true;
}

export async function createSavepoint(
  artifactId: string,
  reason: string,
  createdBy: ArtifactSavepoint['createdBy'],
  basePath?: string,
): Promise<ArtifactSavepoint | null> {
  const root = basePath || defaultProjectsRoot();
  const record = await findArtifactRecord(artifactId, root);
  if (!record) return null;
  const content = await readArtifactContent(root, record.artifact);

  const savepointId = makeId('savepoint');
  const snapshotPath = path.posix.join(
    'artifacts',
    record.artifact.id,
    'savepoints',
    `${savepointId}.md`,
  );
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  const savepoint: ArtifactSavepoint = {
    id: savepointId,
    artifactId: record.artifact.id,
    createdAt: now(),
    createdBy,
    reason: reason.trim() || 'Savepoint',
    contentHash,
    contentSnapshotPath: snapshotPath,
    sourceRefs: record.artifact.sourceRefs,
  };

  const snapshotFile = resolveProjectRelativeFile(root, record.artifact.projectId, snapshotPath);
  await fs.mkdir(path.dirname(snapshotFile), { recursive: true });
  await fs.writeFile(snapshotFile, content, 'utf-8');
  await writeJson(
    path.join(projectDir(root, record.artifact.projectId), 'savepoints', `${savepoint.id}.json`),
    savepoint,
  );

  const artifact: WorkspaceArtifact = {
    ...record.artifact,
    savepointIds: Array.from(new Set([...record.artifact.savepointIds, savepoint.id])),
    updatedAt: savepoint.createdAt,
  };
  await writeJson(artifactFile(root, artifact.projectId, artifact.id), artifact);
  record.project.updatedAt = artifact.updatedAt;
  await persistProject(record.project, root);

  return savepoint;
}

export async function listSavepoints(
  artifactId: string,
  basePath?: string,
): Promise<ArtifactSavepoint[]> {
  const root = basePath || defaultProjectsRoot();
  const record = await findArtifactRecord(artifactId, root);
  if (!record) return [];

  const savepoints: ArtifactSavepoint[] = [];
  for (const savepointId of record.artifact.savepointIds) {
    const savepoint = await readJson<ArtifactSavepoint>(
      savepointFile(root, record.project.id, savepointId),
    );
    if (savepoint) savepoints.push(savepoint);
  }

  return savepoints.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function listRunLedgerEntries(
  projectId?: string,
  artifactId?: string,
  basePath?: string,
): Promise<RunLedgerEntry[]> {
  const root = basePath || defaultProjectsRoot();
  const projects = projectId
    ? [await getProject(projectId, root)].filter(Boolean) as WorkspaceProject[]
    : await listProjects(root);

  const entries: RunLedgerEntry[] = [];
  for (const project of projects) {
    for (const ledgerId of project.runIds) {
      const entry = await readJson<RunLedgerEntry>(runFile(root, project.id, ledgerId));
      if (!entry) continue;
      if (artifactId && entry.artifactId !== artifactId) continue;
      entries.push(entry);
    }
  }

  return entries.sort((a, b) => {
    const bTime = b.completedAt || b.startedAt;
    const aTime = a.completedAt || a.startedAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

export async function getRunLedgerEntry(
  ledgerId: string,
  basePath?: string,
): Promise<RunLedgerEntry | null> {
  const root = basePath || defaultProjectsRoot();
  const record = await findRunLedgerRecord(ledgerId, root);
  return record?.entry || null;
}

export async function createRunLedgerEntry(
  input: CreateRunLedgerEntryInput,
  basePath?: string,
): Promise<RunLedgerEntry> {
  const root = basePath || defaultProjectsRoot();
  const project = await getProject(input.projectId, root);
  if (!project) throw new Error('Project not found');

  let artifactRecord: ArtifactRecord | null = null;
  if (input.artifactId) {
    artifactRecord = await findArtifactRecord(input.artifactId, root);
    if (!artifactRecord || artifactRecord.project.id !== project.id) {
      throw new Error('Artifact not found in project');
    }
  }

  const timestamp = input.startedAt || now();
  const entry: RunLedgerEntry = {
    id: makeId('ledger'),
    projectId: project.id,
    artifactId: input.artifactId,
    runId: input.runId,
    requestSummary: input.requestSummary.trim() || input.toolId,
    toolId: input.toolId,
    toolSource: input.toolSource,
    capabilityScopes: input.capabilityScopes,
    approvalPolicy: input.approvalPolicy,
    approvalDecision: input.approvalDecision,
    startedAt: timestamp,
    changedFiles: input.changedFiles,
    externalSideEffects: input.externalSideEffects,
    redactedArguments: input.redactedArguments,
  };

  await writeJson(runFile(root, project.id, entry.id), entry);

  project.runIds = Array.from(new Set([...project.runIds, entry.id]));
  project.updatedAt = timestamp;
  await persistProject(project, root);

  if (artifactRecord) {
    const artifact: WorkspaceArtifact = {
      ...artifactRecord.artifact,
      runIds: Array.from(new Set([...artifactRecord.artifact.runIds, entry.id])),
      updatedAt: timestamp,
    };
    await writeJson(artifactFile(root, artifact.projectId, artifact.id), artifact);
  }

  return entry;
}

export async function completeRunLedgerEntry(
  ledgerId: string,
  input: CompleteRunLedgerEntryInput,
  basePath?: string,
): Promise<RunLedgerEntry | null> {
  const root = basePath || defaultProjectsRoot();
  const record = await findRunLedgerRecord(ledgerId, root);
  if (!record) return null;

  const entry: RunLedgerEntry = {
    ...record.entry,
    completedAt: input.completedAt || now(),
    success: input.success,
    error: input.error,
    changedFiles: input.changedFiles ?? record.entry.changedFiles,
    externalSideEffects: input.externalSideEffects ?? record.entry.externalSideEffects,
    redactedResult: input.redactedResult,
  };

  await writeJson(runFile(root, record.project.id, entry.id), entry);
  return entry;
}
