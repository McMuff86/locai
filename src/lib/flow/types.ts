import type { Connection, Edge, Node, Viewport } from '@xyflow/react';
import type { WorkflowPlan, WorkflowStatus } from '@/lib/agents/workflowTypes';

export type FlowNodeKind = 'input' | 'agent' | 'template' | 'output' | 'condition' | 'loop';
export type FlowNodeType = 'inputNode' | 'agentNode' | 'templateNode' | 'outputNode' | 'conditionNode' | 'loopNode';
export type FlowPortType = 'string' | 'json' | 'any' | 'stream';
export type FlowPortDirection = 'input' | 'output';

export type NodeRunStatus = 'idle' | 'running' | 'success' | 'error';

export interface NodeRuntimeState {
  status: NodeRunStatus;
  message?: string;
  updatedAt?: string;
}

interface BaseNodeData<K extends FlowNodeKind, C> extends Record<string, unknown> {
  kind: K;
  label: string;
  config: C;
  runtime?: NodeRuntimeState;
}

export interface InputNodeConfig {
  text: string;
  successCriteria?: string;
}

export interface AgentNodeConfig {
  provider?: 'ollama' | 'anthropic' | 'openai' | 'openrouter';
  model: string;
  prompt: string;
  systemPrompt?: string;
  tools: string[];
  successCriteria?: string;
}

export interface TemplateNodeConfig {
  template: string;
  successCriteria?: string;
}

export interface OutputNodeConfig {
  result?: string;
  saveToFile?: boolean;
  filePath?: string;
}

export interface ConditionNodeConfig {
  mode: 'llm' | 'expression';
  prompt: string;
  expression: string;
  provider?: 'ollama' | 'anthropic' | 'openai' | 'openrouter';
  model: string;
  successCriteria?: string;
}

export interface LoopNodeConfig {
  mode: 'count' | 'condition' | 'llm';
  maxIterations: number;
  count: number;
  conditionExpression: string;
  prompt: string;
  provider?: 'ollama' | 'anthropic' | 'openai' | 'openrouter';
  model: string;
  successCriteria?: string;
}

export type InputNodeData = BaseNodeData<'input', InputNodeConfig>;
export type AgentNodeData = BaseNodeData<'agent', AgentNodeConfig>;
export type TemplateNodeData = BaseNodeData<'template', TemplateNodeConfig>;
export type OutputNodeData = BaseNodeData<'output', OutputNodeConfig>;
export type ConditionNodeData = BaseNodeData<'condition', ConditionNodeConfig>;
export type LoopNodeData = BaseNodeData<'loop', LoopNodeConfig>;

export type FlowNodeData =
  | InputNodeData
  | AgentNodeData
  | TemplateNodeData
  | OutputNodeData
  | ConditionNodeData
  | LoopNodeData;

export type FlowNode = Node<FlowNodeData, FlowNodeType>;

export interface FlowEdgeData extends Record<string, unknown> {
  wireType?: FlowPortType;
}

export type FlowEdge = Edge<FlowEdgeData>;

export interface FlowNodePortSchema {
  inputs: Record<string, FlowPortType>;
  outputs: Record<string, FlowPortType>;
  defaultInput?: string;
  defaultOutput?: string;
}

export interface FlowConnectionValidationResult {
  isValid: boolean;
  sourceType: FlowPortType | null;
  targetType: FlowPortType | null;
  reason?: 'missing-node' | 'missing-port' | 'incompatible';
}

export type FlowConnectionCandidate = Pick<Connection, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>;

export interface FlowMetadata {
  name: string;
  description?: string;
}

export interface VisualWorkflow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
  metadata: FlowMetadata;
}

export interface WorkflowRunSummary {
  id: string;
  status: WorkflowStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  totalSteps?: number;
  error?: string;
  nodeStatuses?: Partial<Record<string, NodeRunStatus>>;
  stepTimings?: Array<{
    stepId: string;
    label: string;
    startedAt: string;
    completedAt?: string;
    durationMs: number;
    status: string;
    lane: number;
  }>;
}

export interface StoredWorkflow {
  id: string;
  name: string;
  description?: string;
  graph: VisualWorkflow;
  compiledPlan?: WorkflowPlan;
  runs: WorkflowRunSummary[];
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isFavorite: boolean;
}

export interface SavedFlowTemplate {
  id: string;
  name: string;
  description?: string;
  graph: VisualWorkflow;
  createdAt: string;
  updatedAt: string;
}

export interface FlowCompileResult {
  plan: WorkflowPlan;
  entryMessage: string;
  model: string;
  provider?: 'ollama' | 'anthropic' | 'openai' | 'openrouter';
  systemPrompt?: string;
  enabledTools: string[];
  outputNodeId: string | null;
  warnings: string[];
}
