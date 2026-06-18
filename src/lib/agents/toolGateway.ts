import type {
  ToolApprovalPolicy,
  ToolCapabilityScope,
  ToolGatewayEntry,
  ToolRiskLevel,
  ToolSource,
} from '@/lib/workspace/types';
import type { RegisteredTool, ToolResult } from './types';

export type ToolGatewayApprovalMode = 'audit' | 'enforce';

export interface ToolGatewayExecutionContext {
  projectId?: string;
  artifactId?: string;
  runId?: string;
  requestSummary?: string;
  approvalMode?: ToolGatewayApprovalMode;
  approvedToolIds?: string[];
  approvedCapabilityScopes?: ToolCapabilityScope[];
}

interface BuiltinGatewaySpec {
  source: ToolSource;
  capabilityScopes: ToolCapabilityScope[];
  riskLevel: ToolRiskLevel;
  approvalPolicy: ToolApprovalPolicy;
  timeoutMs?: number;
  retryPolicy?: ToolGatewayEntry['retryPolicy'];
  auditRedaction?: string[];
}

const DEFAULT_TIMEOUT_MS = 60_000;

const builtinGatewaySpecs: Record<string, BuiltinGatewaySpec> = {
  search_documents: {
    source: 'builtin',
    capabilityScopes: ['read_local_files'],
    riskLevel: 'low',
    approvalPolicy: 'none',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  web_search: {
    source: 'builtin',
    capabilityScopes: ['network_read'],
    riskLevel: 'medium',
    approvalPolicy: 'session',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  read_file: {
    source: 'builtin',
    capabilityScopes: ['read_local_files'],
    riskLevel: 'low',
    approvalPolicy: 'none',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  write_file: {
    source: 'builtin',
    capabilityScopes: ['write_local_files'],
    riskLevel: 'medium',
    approvalPolicy: 'session',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  edit_file: {
    source: 'builtin',
    capabilityScopes: ['read_local_files', 'write_local_files'],
    riskLevel: 'medium',
    approvalPolicy: 'session',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  create_note: {
    source: 'builtin',
    capabilityScopes: ['write_local_files'],
    riskLevel: 'medium',
    approvalPolicy: 'session',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  save_memory: {
    source: 'builtin',
    capabilityScopes: ['write_local_files'],
    riskLevel: 'medium',
    approvalPolicy: 'session',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  recall_memory: {
    source: 'builtin',
    capabilityScopes: ['read_local_files'],
    riskLevel: 'low',
    approvalPolicy: 'none',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  run_command: {
    source: 'local-command',
    capabilityScopes: ['shell_command'],
    riskLevel: 'high',
    approvalPolicy: 'per_call',
    timeoutMs: 120_000,
  },
  run_code: {
    source: 'builtin',
    capabilityScopes: ['code_execution'],
    riskLevel: 'high',
    approvalPolicy: 'per_call',
    timeoutMs: 120_000,
  },
  generate_image: {
    source: 'builtin',
    capabilityScopes: ['network_read'],
    riskLevel: 'medium',
    approvalPolicy: 'session',
    timeoutMs: 180_000,
  },
  read_pdf: {
    source: 'builtin',
    capabilityScopes: ['read_local_files'],
    riskLevel: 'low',
    approvalPolicy: 'none',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  read_excel: {
    source: 'builtin',
    capabilityScopes: ['read_local_files'],
    riskLevel: 'low',
    approvalPolicy: 'none',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  generate_music: {
    source: 'builtin',
    capabilityScopes: ['network_read', 'write_local_files'],
    riskLevel: 'medium',
    approvalPolicy: 'session',
    timeoutMs: 600_000,
  },
  text_to_speech: {
    source: 'builtin',
    capabilityScopes: ['network_read', 'write_local_files'],
    riskLevel: 'medium',
    approvalPolicy: 'session',
    timeoutMs: 180_000,
  },
};

export function getToolGatewayEntry(tool: RegisteredTool): ToolGatewayEntry {
  const spec = builtinGatewaySpecs[tool.definition.name] || {
    source: 'builtin' as const,
    capabilityScopes: [],
    riskLevel: 'low' as const,
    approvalPolicy: 'none' as const,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  return {
    id: tool.definition.name,
    name: tool.definition.name,
    description: tool.definition.description,
    inputSchema: tool.definition.parameters,
    source: spec.source,
    capabilityScopes: spec.capabilityScopes,
    riskLevel: spec.riskLevel,
    approvalPolicy: spec.approvalPolicy,
    timeoutMs: spec.timeoutMs,
    retryPolicy: spec.retryPolicy,
    auditRedaction: spec.auditRedaction,
  };
}

export function getApprovalDecision(
  entry: ToolGatewayEntry,
  context?: ToolGatewayExecutionContext,
): 'approved' | 'denied' | 'not_required' {
  if (entry.approvalPolicy === 'none') return 'not_required';

  const approvedTool = context?.approvedToolIds?.includes(entry.id) ?? false;
  const approvedScopes = entry.capabilityScopes.every((scope) =>
    context?.approvedCapabilityScopes?.includes(scope),
  );

  if (approvedTool || approvedScopes) return 'approved';
  if ((context?.approvalMode || 'audit') === 'enforce') return 'denied';
  return 'not_required';
}

export function redactForLedger(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > 2_000 ? `${value.slice(0, 2_000)}... [truncated]` : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactForLedger(item));

  const redacted: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (/token|secret|password|api[_-]?key|authorization/i.test(key)) {
      redacted[key] = '[redacted]';
      continue;
    }
    redacted[key] = redactForLedger(nestedValue);
  }
  return redacted;
}

export function summarizeToolResultForLedger(result: ToolResult): unknown {
  return redactForLedger({
    success: result.success,
    error: result.error,
    content: result.content,
  });
}
