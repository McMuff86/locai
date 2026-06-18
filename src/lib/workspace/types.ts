export type WorkspaceProjectStatus = 'active' | 'archived';

export interface WorkspaceProject {
  id: string;
  name: string;
  description?: string;
  status: WorkspaceProjectStatus;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  artifactIds: string[];
  runIds: string[];
}

export const ARTIFACT_TYPES = [
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
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export type ArtifactStatus = 'draft' | 'review' | 'final' | 'archived';

export type SourceRefKind =
  | 'web'
  | 'document'
  | 'note'
  | 'memory'
  | 'file'
  | 'conversation'
  | 'workflow_run';

export interface SourceRef {
  id: string;
  kind: SourceRefKind;
  title: string;
  uri?: string;
  localPath?: string;
  excerpt?: string;
  capturedAt: string;
  reliability?: 'unknown' | 'low' | 'medium' | 'high';
}

export interface ModelProvenance {
  provider: string;
  model: string;
  role?: string;
  promptTokens?: number;
  completionTokens?: number;
  createdAt: string;
  note?: string;
}

export interface WorkspaceArtifact {
  id: string;
  projectId: string;
  type: ArtifactType;
  title: string;
  description?: string;
  status: ArtifactStatus;
  createdAt: string;
  updatedAt: string;
  contentPath: string;
  sourceRefs: SourceRef[];
  savepointIds: string[];
  runIds: string[];
  exportPaths: string[];
  modelProvenance?: ModelProvenance[];
}

export interface WorkspaceArtifactWithContent extends WorkspaceArtifact {
  content: string;
}

export interface ArtifactSavepoint {
  id: string;
  artifactId: string;
  createdAt: string;
  createdBy: 'user' | 'agent' | 'workflow';
  reason: string;
  contentHash: string;
  contentSnapshotPath: string;
  sourceRefs: SourceRef[];
}

export type ToolCapabilityScope =
  | 'read_local_files'
  | 'write_local_files'
  | 'delete_local_files'
  | 'network_read'
  | 'external_write'
  | 'account_action'
  | 'shell_command'
  | 'code_execution'
  | 'browser_read'
  | 'browser_action'
  | 'secret_access';

export type ToolSource =
  | 'builtin'
  | 'mcp'
  | 'openapi'
  | 'local-command'
  | 'browser'
  | 'external-service';

export type ToolApprovalPolicy = 'none' | 'session' | 'per_call' | 'blocked';

export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolRetryPolicy {
  maxAttempts: number;
  backoffMs?: number;
}

export interface ToolGatewayEntry {
  id: string;
  name: string;
  description: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  source: ToolSource;
  capabilityScopes: ToolCapabilityScope[];
  riskLevel: ToolRiskLevel;
  approvalPolicy: ToolApprovalPolicy;
  timeoutMs?: number;
  retryPolicy?: ToolRetryPolicy;
  auditRedaction?: string[];
}

export interface RunLedgerEntry {
  id: string;
  projectId: string;
  artifactId?: string;
  runId?: string;
  requestSummary: string;
  toolId: string;
  toolSource: ToolSource;
  capabilityScopes: ToolCapabilityScope[];
  approvalPolicy: ToolApprovalPolicy;
  approvalDecision?: 'approved' | 'denied' | 'not_required';
  startedAt: string;
  completedAt?: string;
  success?: boolean;
  error?: string;
  changedFiles?: string[];
  externalSideEffects?: string[];
  redactedArguments?: unknown;
  redactedResult?: unknown;
}

export interface CreateRunLedgerEntryInput {
  projectId: string;
  artifactId?: string;
  runId?: string;
  requestSummary: string;
  toolId: string;
  toolSource: ToolSource;
  capabilityScopes: ToolCapabilityScope[];
  approvalPolicy: ToolApprovalPolicy;
  approvalDecision?: RunLedgerEntry['approvalDecision'];
  startedAt?: string;
  changedFiles?: string[];
  externalSideEffects?: string[];
  redactedArguments?: unknown;
}

export interface CompleteRunLedgerEntryInput {
  completedAt?: string;
  success: boolean;
  error?: string;
  changedFiles?: string[];
  externalSideEffects?: string[];
  redactedResult?: unknown;
}

export interface CreateWorkspaceProjectInput {
  name: string;
  description?: string;
  tags?: string[];
}

export interface UpdateWorkspaceProjectInput {
  name?: string;
  description?: string;
  status?: WorkspaceProjectStatus;
  tags?: string[];
}

export interface CreateWorkspaceArtifactInput {
  projectId: string;
  type?: ArtifactType;
  title: string;
  description?: string;
  content?: string;
  sourceRefs?: SourceRef[];
}

export interface UpdateWorkspaceArtifactInput {
  title?: string;
  description?: string;
  status?: ArtifactStatus;
  content?: string;
  sourceRefs?: SourceRef[];
  exportPaths?: string[];
  modelProvenance?: ModelProvenance[];
}
