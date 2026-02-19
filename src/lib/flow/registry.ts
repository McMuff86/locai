import type { Connection, XYPosition } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type {
  FlowConnectionCandidate,
  FlowConnectionValidationResult,
  FlowEdge,
  FlowNode,
  FlowNodeKind,
  FlowNodePortSchema,
  FlowNodeType,
  FlowPortDirection,
  FlowPortType,
  StoredWorkflow,
  VisualWorkflow,
} from '@/lib/flow/types';

export interface FlowNodeDefinition {
  kind: FlowNodeKind;
  type: FlowNodeType;
  label: string;
  description: string;
  accentClass: string;
}

const DEFAULT_WIRE_TYPE: FlowPortType = 'any';

export const FLOW_NODE_DEFINITIONS: FlowNodeDefinition[] = [
  {
    kind: 'input',
    type: 'inputNode',
    label: 'Input',
    description: 'Startpunkt mit Nutzereingabe',
    accentClass: 'text-emerald-300',
  },
  {
    kind: 'agent',
    type: 'agentNode',
    label: 'Agent',
    description: 'LLM Step mit Tools',
    accentClass: 'text-fuchsia-300',
  },
  {
    kind: 'template',
    type: 'templateNode',
    label: 'Template',
    description: 'Text-Template mit Variablen',
    accentClass: 'text-cyan-300',
  },
  {
    kind: 'output',
    type: 'outputNode',
    label: 'Output',
    description: 'Zeigt das finale Ergebnis',
    accentClass: 'text-amber-300',
  },
];

export const FLOW_NODE_PORTS: Record<FlowNodeKind, FlowNodePortSchema> = {
  input: {
    inputs: {},
    outputs: {
      text: 'string',
    },
    defaultOutput: 'text',
  },
  agent: {
    inputs: {
      prompt: 'string',
    },
    outputs: {
      result: 'string',
      stream: 'stream',
    },
    defaultInput: 'prompt',
    defaultOutput: 'result',
  },
  template: {
    inputs: {
      variables: 'json',
    },
    outputs: {
      text: 'string',
    },
    defaultInput: 'variables',
    defaultOutput: 'text',
  },
  output: {
    inputs: {
      result: 'any',
    },
    outputs: {},
    defaultInput: 'result',
  },
};

export const FLOW_WIRE_COLORS: Record<FlowPortType, string> = {
  string: '#34d399',
  json: '#22d3ee',
  any: '#94a3b8',
  stream: '#f59e0b',
};

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nodeTypeFromKind(kind: FlowNodeKind): FlowNodeType {
  switch (kind) {
    case 'input':
      return 'inputNode';
    case 'agent':
      return 'agentNode';
    case 'template':
      return 'templateNode';
    case 'output':
      return 'outputNode';
  }
}

function findNodeById(nodes: FlowNode[], nodeId: string): FlowNode | undefined {
  return nodes.find((node) => node.id === nodeId);
}

function firstPortName(ports: Record<string, FlowPortType>): string | null {
  const [first] = Object.keys(ports);
  return first ?? null;
}

function resolvePortTypeFromSchema(
  schema: FlowNodePortSchema,
  direction: FlowPortDirection,
  handleId?: string | null,
): FlowPortType | null {
  const ports = direction === 'input' ? schema.inputs : schema.outputs;

  if (handleId != null) {
    return ports[handleId] ?? null;
  }

  const configuredDefault = direction === 'input' ? schema.defaultInput : schema.defaultOutput;
  const fallbackPortName = configuredDefault && ports[configuredDefault] ? configuredDefault : firstPortName(ports);

  if (!fallbackPortName) {
    return null;
  }

  return ports[fallbackPortName] ?? null;
}

export function resolveNodePortType(
  node: FlowNode,
  direction: FlowPortDirection,
  handleId?: string | null,
): FlowPortType | null {
  const schema = FLOW_NODE_PORTS[node.data.kind];
  return resolvePortTypeFromSchema(schema, direction, handleId);
}

export function isPortTypeCompatible(sourceType: FlowPortType, targetType: FlowPortType): boolean {
  if (sourceType === 'any' || targetType === 'any') {
    return true;
  }

  if (sourceType === targetType) {
    return true;
  }

  if (sourceType === 'json' && targetType === 'string') {
    return true;
  }

  return false;
}

export function validateFlowConnection(
  connection: FlowConnectionCandidate,
  nodes: FlowNode[],
): FlowConnectionValidationResult {
  const sourceNode = findNodeById(nodes, connection.source);
  const targetNode = findNodeById(nodes, connection.target);

  if (!sourceNode || !targetNode) {
    return {
      isValid: false,
      sourceType: null,
      targetType: null,
      reason: 'missing-node',
    };
  }

  const sourceType = resolveNodePortType(sourceNode, 'output', connection.sourceHandle);
  const targetType = resolveNodePortType(targetNode, 'input', connection.targetHandle);

  if (!sourceType || !targetType) {
    return {
      isValid: false,
      sourceType,
      targetType,
      reason: 'missing-port',
    };
  }

  if (!isPortTypeCompatible(sourceType, targetType)) {
    return {
      isValid: false,
      sourceType,
      targetType,
      reason: 'incompatible',
    };
  }

  return {
    isValid: true,
    sourceType,
    targetType,
  };
}

export function getFlowConnectionErrorMessage(validation: FlowConnectionValidationResult): string {
  switch (validation.reason) {
    case 'missing-node':
      return 'Verbindung konnte nicht aufgeloest werden.';
    case 'missing-port':
      return 'Port-Typ konnte fuer die Verbindung nicht bestimmt werden.';
    case 'incompatible':
      if (validation.sourceType && validation.targetType) {
        return `Inkompatible Port-Typen: ${validation.sourceType} -> ${validation.targetType}.`;
      }
      return 'Inkompatible Port-Typen.';
    default:
      return 'Verbindung ist nicht zulaessig.';
  }
}

export function createWireStyle(wireType: FlowPortType): CSSProperties {
  return {
    stroke: FLOW_WIRE_COLORS[wireType],
    strokeWidth: wireType === 'stream' ? 2.6 : 2.2,
    strokeDasharray: wireType === 'stream' ? '5 3' : undefined,
  };
}

function resolveWireTypeFromConnection(connection: FlowConnectionCandidate, nodes: FlowNode[]): FlowPortType {
  const validation = validateFlowConnection(connection, nodes);
  return validation.sourceType ?? validation.targetType ?? DEFAULT_WIRE_TYPE;
}

export function decorateFlowEdge(edge: FlowEdge, nodes: FlowNode[]): FlowEdge {
  const wireType =
    edge.data?.wireType ??
    resolveWireTypeFromConnection(
      {
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
      },
      nodes,
    );

  return {
    ...edge,
    type: edge.type ?? 'smoothstep',
    animated: edge.animated ?? wireType === 'stream',
    data: {
      ...edge.data,
      wireType,
    },
    style: {
      ...edge.style,
      ...createWireStyle(wireType),
    },
  };
}

export function createFlowEdgeFromConnection(connection: Connection, nodes: FlowNode[]): FlowEdge | null {
  const validation = validateFlowConnection(connection, nodes);
  if (!validation.isValid || !validation.sourceType) {
    return null;
  }

  return decorateFlowEdge(
    {
      id: makeId('edge'),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'smoothstep',
      data: {
        wireType: validation.sourceType,
      },
    },
    nodes,
  );
}

export function createFlowNode(kind: FlowNodeKind, position: XYPosition): FlowNode {
  const common = {
    id: makeId(kind),
    position,
    type: nodeTypeFromKind(kind),
    draggable: true,
  } as const;

  switch (kind) {
    case 'input':
      return {
        ...common,
        data: {
          kind: 'input',
          label: 'Input',
          runtime: { status: 'idle' },
          config: {
            text: 'Beschreibe hier die Aufgabe fuer den Flow.',
            successCriteria: 'Eingabe wurde bereitgestellt',
          },
        },
      };
    case 'agent':
      return {
        ...common,
        data: {
          kind: 'agent',
          label: 'Agent',
          runtime: { status: 'idle' },
          config: {
            model: 'llama3',
            prompt: 'Bearbeite die Aufgabe auf Basis des Kontexts.',
            systemPrompt: '',
            tools: ['search_documents', 'read_file'],
            successCriteria: 'Der Schritt liefert verwertbare Ergebnisse.',
          },
        },
      };
    case 'template':
      return {
        ...common,
        data: {
          kind: 'template',
          label: 'Template',
          runtime: { status: 'idle' },
          config: {
            template: 'Fasse folgendes Ergebnis zusammen: {{result}}',
            successCriteria: 'Template-Text wurde korrekt angewendet.',
          },
        },
      };
    case 'output':
      return {
        ...common,
        data: {
          kind: 'output',
          label: 'Output',
          runtime: { status: 'idle' },
          config: {
            result: '',
            saveToFile: false,
            filePath: '',
          },
        },
      };
  }
}

export function createDefaultVisualWorkflow(): VisualWorkflow {
  const inputNode = createFlowNode('input', { x: 80, y: 220 });
  const agentNode = createFlowNode('agent', { x: 380, y: 220 });
  const outputNode = createFlowNode('output', { x: 700, y: 220 });
  const nodes = [inputNode, agentNode, outputNode];

  const edges: FlowEdge[] = [
    {
      id: `${inputNode.id}-${agentNode.id}`,
      source: inputNode.id,
      target: agentNode.id,
      type: 'smoothstep',
    },
    {
      id: `${agentNode.id}-${outputNode.id}`,
      source: agentNode.id,
      target: outputNode.id,
      type: 'smoothstep',
    },
  ].map((edge) => decorateFlowEdge(edge, nodes));

  return {
    metadata: {
      name: 'Neuer Flow',
      description: 'Input -> Agent -> Output',
    },
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function createDefaultStoredWorkflow(): StoredWorkflow {
  const now = new Date().toISOString();
  const graph = createDefaultVisualWorkflow();

  return {
    id: 'current',
    name: graph.metadata.name,
    description: graph.metadata.description,
    graph,
    runs: [],
    createdAt: now,
    updatedAt: now,
    tags: [],
    isFavorite: false,
  };
}
