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
  ConditionNodeConfig,
  LoopNodeConfig,
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
  {
    kind: 'condition',
    type: 'conditionNode',
    label: 'Condition',
    description: 'Verzweigung basierend auf Bedingung',
    accentClass: 'text-violet-300',
  },
  {
    kind: 'loop',
    type: 'loopNode',
    label: 'Loop',
    description: 'Wiederholte Ausfuehrung',
    accentClass: 'text-orange-300',
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
  condition: {
    inputs: {
      input: 'any',
    },
    outputs: {
      true: 'any',
      false: 'any',
    },
    defaultInput: 'input',
    defaultOutput: 'true',
  },
  loop: {
    inputs: {
      input: 'any',
      'loop-back': 'any',
    },
    outputs: {
      body: 'any',
      done: 'any',
    },
    defaultInput: 'input',
    defaultOutput: 'body',
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
    case 'condition':
      return 'conditionNode';
    case 'loop':
      return 'loopNode';
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
    case 'condition':
      return {
        ...common,
        data: {
          kind: 'condition',
          label: 'Condition',
          runtime: { status: 'idle' },
          config: {
            mode: 'expression',
            prompt: 'Ist das Ergebnis zufriedenstellend?',
            expression: 'result.length > 0',
            model: 'llama3',
            successCriteria: 'Bedingung wurde ausgewertet',
          } satisfies ConditionNodeConfig,
        },
      };
    case 'loop':
      return {
        ...common,
        data: {
          kind: 'loop',
          label: 'Loop',
          runtime: { status: 'idle' },
          config: {
            mode: 'count',
            maxIterations: 5,
            count: 3,
            conditionExpression: 'result.length > 0',
            prompt: 'Soll die Schleife weiterlaufen?',
            model: 'llama3',
            successCriteria: 'Schleife wurde ausgefuehrt',
          } satisfies LoopNodeConfig,
        },
      };
  }
}

export function createPdfProcessingWorkflow(): VisualWorkflow {
  const inputNode: FlowNode = {
    id: makeId('input'),
    position: { x: 80, y: 220 },
    type: 'inputNode',
    draggable: true,
    data: {
      kind: 'input',
      label: 'PDF Aufgabe',
      runtime: { status: 'idle' },
      config: {
        text: 'Lies die Datei /workspace/dokument.pdf und erstelle eine strukturierte Zusammenfassung.',
        successCriteria: 'PDF-Pfad und Aufgabe wurden bereitgestellt',
      },
    },
  };

  const readPdfAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 360, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'PDF lesen',
      runtime: { status: 'idle' },
      config: {
        model: 'llama3',
        prompt: 'Lies die angegebene PDF-Datei mit dem read_file Tool und gib den vollstaendigen Inhalt zurueck.',
        systemPrompt: 'Du bist ein Dokumenten-Assistent. Lies Dateien praezise und gib den Inhalt vollstaendig zurueck.',
        tools: ['read_file', 'search_documents'],
        successCriteria: 'PDF-Inhalt wurde erfolgreich extrahiert',
      },
    },
  };

  const formatTemplate: FlowNode = {
    id: makeId('template'),
    position: { x: 640, y: 220 },
    type: 'templateNode',
    draggable: true,
    data: {
      kind: 'template',
      label: 'Analyse-Prompt',
      runtime: { status: 'idle' },
      config: {
        template:
          'Analysiere das folgende PDF-Dokument und erstelle eine strukturierte Zusammenfassung:\n\n---\n{{result}}\n---\n\nBitte erstelle:\n1. Eine kurze Zusammenfassung (3-5 Saetze)\n2. Die wichtigsten Kernpunkte als Liste\n3. Relevante Details oder Zahlen',
        successCriteria: 'Analyse-Prompt wurde korrekt zusammengesetzt',
      },
    },
  };

  const analyzeAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 920, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'PDF analysieren',
      runtime: { status: 'idle' },
      config: {
        model: 'llama3',
        prompt: 'Fuehre die Analyse gemaess den Anweisungen durch. Strukturiere die Ausgabe klar und uebersichtlich.',
        systemPrompt: 'Du bist ein Experte fuer Dokumentenanalyse. Erstelle praezise, gut strukturierte Zusammenfassungen.',
        tools: [],
        successCriteria: 'Strukturierte Zusammenfassung wurde erstellt',
      },
    },
  };

  const outputNode: FlowNode = {
    id: makeId('output'),
    position: { x: 1220, y: 220 },
    type: 'outputNode',
    draggable: true,
    data: {
      kind: 'output',
      label: 'Ergebnis',
      runtime: { status: 'idle' },
      config: {
        result: '',
        saveToFile: true,
        filePath: 'pdf_zusammenfassung.md',
      },
    },
  };

  const nodes = [inputNode, readPdfAgent, formatTemplate, analyzeAgent, outputNode];

  const edges: FlowEdge[] = [
    { id: `${inputNode.id}-${readPdfAgent.id}`, source: inputNode.id, target: readPdfAgent.id, type: 'smoothstep' },
    { id: `${readPdfAgent.id}-${formatTemplate.id}`, source: readPdfAgent.id, target: formatTemplate.id, type: 'smoothstep' },
    { id: `${formatTemplate.id}-${analyzeAgent.id}`, source: formatTemplate.id, target: analyzeAgent.id, type: 'smoothstep' },
    { id: `${analyzeAgent.id}-${outputNode.id}`, source: analyzeAgent.id, target: outputNode.id, type: 'smoothstep' },
  ].map((edge) => decorateFlowEdge(edge, nodes));

  return {
    metadata: {
      name: 'PDF Verarbeitung',
      description: 'PDF lesen → Inhalt formatieren → Analyse erstellen → Ergebnis speichern',
    },
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 0.85 },
  };
}

export type FlowTemplateId = 'default' | 'pdf-processing';

export interface FlowTemplate {
  id: FlowTemplateId;
  name: string;
  description: string;
  create: () => VisualWorkflow;
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'default',
    name: 'Neuer Flow',
    description: 'Input → Agent → Output',
    create: () => createDefaultVisualWorkflow(),
  },
  {
    id: 'pdf-processing',
    name: 'PDF Verarbeitung',
    description: 'PDF lesen → Formatieren → Analysieren → Ergebnis',
    create: () => createPdfProcessingWorkflow(),
  },
];

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

export function createStoredWorkflowFromTemplate(templateId: FlowTemplateId): StoredWorkflow {
  const template = FLOW_TEMPLATES.find((t) => t.id === templateId);
  const graph = template ? template.create() : createDefaultVisualWorkflow();
  const now = new Date().toISOString();

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

export function createDefaultStoredWorkflow(): StoredWorkflow {
  return createStoredWorkflowFromTemplate('default');
}
