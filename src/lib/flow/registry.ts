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
            model: 'qwen3:30b-a3b',
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
            model: 'qwen3:30b-a3b',
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
            model: 'qwen3:30b-a3b',
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
        text: 'Lies die Datei sample_explain.pdf und erstelle eine strukturierte Zusammenfassung.',
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
        model: 'qwen3:30b-a3b',
        prompt: 'Lies die angegebene PDF-Datei mit dem read_pdf Tool. Rufe das Tool auf und bestaetige kurz was du gelesen hast (Seitenanzahl, Dokumenttyp). Gib NICHT den gesamten Inhalt nochmal aus.',
        systemPrompt: 'Du bist ein Dokumenten-Assistent. WICHTIG: Rufe read_pdf auf um die Datei zu lesen. Antworte danach NUR mit einer kurzen Bestaetigung (z.B. "PDF gelesen: 12 Seiten, Verzeichnis der SIA-Publikationen"). Gib den Inhalt NICHT nochmal aus - er wird automatisch an den naechsten Schritt weitergegeben.',
        tools: ['read_pdf'],
        successCriteria: 'PDF-Inhalt wurde erfolgreich mit read_pdf extrahiert',
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
        model: 'qwen3:30b-a3b',
        prompt: 'Fuehre die Analyse gemaess den Anweisungen durch. Strukturiere die Ausgabe klar und uebersichtlich auf Deutsch.',
        systemPrompt: 'Du bist ein Experte fuer Dokumentenanalyse. Erstelle praezise, gut strukturierte Zusammenfassungen auf Deutsch. Antworte direkt mit dem Ergebnis ohne Einleitung.',
        tools: ['write_file'],
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

export function createExcelProcessingWorkflow(): VisualWorkflow {
  const inputNode: FlowNode = {
    id: makeId('input'),
    position: { x: 80, y: 220 },
    type: 'inputNode',
    draggable: true,
    data: {
      kind: 'input',
      label: 'Excel Aufgabe',
      runtime: { status: 'idle' },
      config: {
        text: 'Lies die Excel-Datei und erstelle eine strukturierte Analyse der Daten.',
        successCriteria: 'Dateipfad und Aufgabe wurden bereitgestellt',
      },
    },
  };

  const readExcelAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 360, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Excel lesen',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Lies die angegebene Excel-Datei mit dem read_excel Tool. Bestaetige kurz was du gelesen hast (Sheets, Zeilenanzahl). Gib NICHT den gesamten Inhalt nochmal aus.',
        systemPrompt: 'Du bist ein Daten-Assistent. Rufe read_excel auf. Antworte danach NUR mit einer kurzen Bestaetigung (z.B. "Excel gelesen: 3 Sheets, 150 Zeilen"). Der Inhalt wird automatisch an den naechsten Schritt weitergegeben.',
        tools: ['read_excel'],
        successCriteria: 'Excel-Inhalt wurde erfolgreich extrahiert',
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
          'Analysiere die folgenden Excel-Daten und erstelle eine strukturierte Auswertung:\n\n---\n{{result}}\n---\n\nBitte erstelle:\n1. Eine Uebersicht der enthaltenen Daten (Sheets, Spalten, Zeilenanzahl)\n2. Statistische Zusammenfassung (Summen, Durchschnitte, Trends falls erkennbar)\n3. Auffaelligkeiten oder bemerkenswerte Muster\n4. Eine kurze Gesamtbewertung',
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
      label: 'Daten analysieren',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Fuehre die Datenanalyse gemaess den Anweisungen durch. Strukturiere die Ausgabe klar und uebersichtlich mit Tabellen wo sinnvoll.',
        systemPrompt: 'Du bist ein Experte fuer Datenanalyse und Tabellenkalkulationen. Erstelle praezise, gut strukturierte Auswertungen mit statistischen Kennzahlen.',
        tools: [],
        successCriteria: 'Strukturierte Datenanalyse wurde erstellt',
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
        filePath: 'excel_analyse.md',
      },
    },
  };

  const nodes = [inputNode, readExcelAgent, formatTemplate, analyzeAgent, outputNode];

  const edges: FlowEdge[] = [
    { id: `${inputNode.id}-${readExcelAgent.id}`, source: inputNode.id, target: readExcelAgent.id, type: 'smoothstep' },
    { id: `${readExcelAgent.id}-${formatTemplate.id}`, source: readExcelAgent.id, target: formatTemplate.id, type: 'smoothstep' },
    { id: `${formatTemplate.id}-${analyzeAgent.id}`, source: formatTemplate.id, target: analyzeAgent.id, type: 'smoothstep' },
    { id: `${analyzeAgent.id}-${outputNode.id}`, source: analyzeAgent.id, target: outputNode.id, type: 'smoothstep' },
  ].map((edge) => decorateFlowEdge(edge, nodes));

  return {
    metadata: {
      name: 'Excel Verarbeitung',
      description: 'Excel lesen → Inhalt formatieren → Datenanalyse → Ergebnis speichern',
    },
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 0.85 },
  };
}

// ---------------------------------------------------------------------------
// Web Research Flow
// ---------------------------------------------------------------------------
export function createWebResearchWorkflow(): VisualWorkflow {
  const inputNode: FlowNode = {
    id: makeId('input'),
    position: { x: 80, y: 220 },
    type: 'inputNode',
    draggable: true,
    data: {
      kind: 'input',
      label: 'Recherche-Thema',
      runtime: { status: 'idle' },
      config: {
        text: 'Recherchiere zum Thema: Aktuelle Entwicklungen in der KI-Regulierung in Europa',
        successCriteria: 'Suchbegriff wurde bereitgestellt',
      },
    },
  };

  const searchAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 360, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Web-Suche',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Fuehre eine umfassende Web-Suche zum angegebenen Thema durch. Nutze verschiedene Suchbegriffe um breite Ergebnisse zu erhalten.',
        systemPrompt: 'Du bist ein Research-Assistent. Nutze das web_search Tool um relevante und aktuelle Quellen zu finden. Gib die Ergebnisse strukturiert mit Titel, URL und Zusammenfassung zurueck.',
        tools: ['web_search'],
        successCriteria: 'Relevante Suchergebnisse wurden gefunden',
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
      label: 'Ergebnisse formatieren',
      runtime: { status: 'idle' },
      config: {
        template:
          'Analysiere und bewerte die folgenden Recherche-Ergebnisse:\n\n---\n{{result}}\n---\n\nBitte erstelle:\n1. Eine Zusammenfassung der wichtigsten Erkenntnisse\n2. Bewertung der Quellen nach Zuverlaessigkeit\n3. Widersprueche oder unterschiedliche Perspektiven\n4. Fazit und offene Fragen',
        successCriteria: 'Analyse-Prompt wurde zusammengesetzt',
      },
    },
  };

  const analysisAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 920, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Analyse',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Analysiere die Recherche-Ergebnisse gemaess den Anweisungen. Bewerte Quellen kritisch und identifiziere die wichtigsten Erkenntnisse.',
        systemPrompt: 'Du bist ein Analyst mit Expertise in Quellenbewertung. Erstelle fundierte, ausgewogene Analysen und kennzeichne unsichere Informationen.',
        tools: [],
        successCriteria: 'Analyse mit Quellenbewertung wurde erstellt',
      },
    },
  };

  const outputNode: FlowNode = {
    id: makeId('output'),
    position: { x: 1200, y: 220 },
    type: 'outputNode',
    draggable: true,
    data: {
      kind: 'output',
      label: 'Ergebnis',
      runtime: { status: 'idle' },
      config: {
        result: '',
        saveToFile: true,
        filePath: 'recherche_ergebnis.md',
      },
    },
  };

  const nodes = [inputNode, searchAgent, formatTemplate, analysisAgent, outputNode];

  const edges: FlowEdge[] = [
    { id: `${inputNode.id}-${searchAgent.id}`, source: inputNode.id, target: searchAgent.id, type: 'smoothstep' },
    { id: `${searchAgent.id}-${formatTemplate.id}`, source: searchAgent.id, target: formatTemplate.id, type: 'smoothstep' },
    { id: `${formatTemplate.id}-${analysisAgent.id}`, source: formatTemplate.id, target: analysisAgent.id, type: 'smoothstep' },
    { id: `${analysisAgent.id}-${outputNode.id}`, source: analysisAgent.id, target: outputNode.id, type: 'smoothstep' },
  ].map((edge) => decorateFlowEdge(edge, nodes));

  return {
    metadata: {
      name: 'Web Research',
      description: 'Web-Suche → Ergebnisse formatieren → Analyse mit Quellenbewertung → Ergebnis',
    },
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 0.85 },
  };
}

// ---------------------------------------------------------------------------
// Code Review Flow
// ---------------------------------------------------------------------------
export function createCodeReviewWorkflow(): VisualWorkflow {
  const inputNode: FlowNode = {
    id: makeId('input'),
    position: { x: 80, y: 220 },
    type: 'inputNode',
    draggable: true,
    data: {
      kind: 'input',
      label: 'Code / Dateipfad',
      runtime: { status: 'idle' },
      config: {
        text: 'Review die Datei src/index.ts auf Code-Qualitaet, Bugs und Verbesserungsmoeglichkeiten.',
        successCriteria: 'Dateipfad und Review-Auftrag wurden bereitgestellt',
      },
    },
  };

  const readAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 360, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Datei lesen',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Lies die angegebene Datei mit read_file und gib den vollstaendigen Inhalt zurueck.',
        systemPrompt: 'Du bist ein Code-Assistent. Lies Dateien praezise und gib den Inhalt zurueck.',
        tools: ['read_file'],
        successCriteria: 'Datei-Inhalt wurde gelesen',
      },
    },
  };

  const reviewTemplate: FlowNode = {
    id: makeId('template'),
    position: { x: 640, y: 220 },
    type: 'templateNode',
    draggable: true,
    data: {
      kind: 'template',
      label: 'Review-Prompt',
      runtime: { status: 'idle' },
      config: {
        template:
          'Fuehre ein Code-Review fuer folgenden Code durch:\n\n```\n{{result}}\n```\n\nPruefe auf:\n1. Bugs und Fehler\n2. Security-Probleme\n3. Performance-Issues\n4. Code-Style und Best Practices\n5. Verbesserungsvorschlaege\n\nGib am Ende an ob Issues gefunden wurden (JA/NEIN).',
        successCriteria: 'Review-Prompt wurde erstellt',
      },
    },
  };

  const reviewAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 920, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Code Review',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Fuehre das Code-Review durch. Sei gruendlich und konstruktiv. Beende mit JA wenn Issues gefunden, NEIN wenn alles in Ordnung.',
        systemPrompt: 'Du bist ein erfahrener Senior-Entwickler der Code-Reviews durchfuehrt. Sei praezise, konstruktiv und begruende deine Findings.',
        tools: [],
        successCriteria: 'Code-Review wurde durchgefuehrt',
      },
    },
  };

  const conditionNode: FlowNode = {
    id: makeId('condition'),
    position: { x: 1200, y: 220 },
    type: 'conditionNode',
    draggable: true,
    data: {
      kind: 'condition',
      label: 'Issues gefunden?',
      runtime: { status: 'idle' },
      config: {
        mode: 'llm',
        prompt: 'Wurden im Code-Review Issues oder Probleme gefunden die behoben werden sollten? Antworte nur mit true oder false.',
        expression: '',
        model: 'qwen3:30b-a3b',
        successCriteria: 'Bedingung wurde ausgewertet',
      } satisfies ConditionNodeConfig,
    },
  };

  const fixAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 1480, y: 160 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Fixes vorschlagen',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Erstelle konkrete Fix-Vorschlaege fuer die gefundenen Issues. Zeige den korrigierten Code.',
        systemPrompt: 'Du bist ein Senior-Entwickler. Erstelle konkrete, anwendbare Code-Fixes mit Erklaerung.',
        tools: [],
        successCriteria: 'Fix-Vorschlaege wurden erstellt',
      },
    },
  };

  const outputTrue: FlowNode = {
    id: makeId('output'),
    position: { x: 1760, y: 160 },
    type: 'outputNode',
    draggable: true,
    data: {
      kind: 'output',
      label: 'Review + Fixes',
      runtime: { status: 'idle' },
      config: {
        result: '',
        saveToFile: true,
        filePath: 'code_review_fixes.md',
      },
    },
  };

  const outputFalse: FlowNode = {
    id: makeId('output'),
    position: { x: 1480, y: 280 },
    type: 'outputNode',
    draggable: true,
    data: {
      kind: 'output',
      label: 'Review OK',
      runtime: { status: 'idle' },
      config: {
        result: '',
        saveToFile: true,
        filePath: 'code_review_ok.md',
      },
    },
  };

  const nodes = [inputNode, readAgent, reviewTemplate, reviewAgent, conditionNode, fixAgent, outputTrue, outputFalse];

  const edges: FlowEdge[] = [
    { id: `${inputNode.id}-${readAgent.id}`, source: inputNode.id, target: readAgent.id, type: 'smoothstep' },
    { id: `${readAgent.id}-${reviewTemplate.id}`, source: readAgent.id, target: reviewTemplate.id, type: 'smoothstep' },
    { id: `${reviewTemplate.id}-${reviewAgent.id}`, source: reviewTemplate.id, target: reviewAgent.id, type: 'smoothstep' },
    { id: `${reviewAgent.id}-${conditionNode.id}`, source: reviewAgent.id, target: conditionNode.id, type: 'smoothstep' },
    { id: `${conditionNode.id}-true-${fixAgent.id}`, source: conditionNode.id, target: fixAgent.id, sourceHandle: 'true', type: 'smoothstep' },
    { id: `${conditionNode.id}-false-${outputFalse.id}`, source: conditionNode.id, target: outputFalse.id, sourceHandle: 'false', type: 'smoothstep' },
    { id: `${fixAgent.id}-${outputTrue.id}`, source: fixAgent.id, target: outputTrue.id, type: 'smoothstep' },
  ].map((edge) => decorateFlowEdge(edge, nodes));

  return {
    metadata: {
      name: 'Code Review',
      description: 'Datei lesen → Review → Condition (Issues?) → Fixes vorschlagen oder OK',
    },
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 0.75 },
  };
}

// ---------------------------------------------------------------------------
// Content Creation Flow
// ---------------------------------------------------------------------------
export function createContentCreationWorkflow(): VisualWorkflow {
  const inputNode: FlowNode = {
    id: makeId('input'),
    position: { x: 80, y: 220 },
    type: 'inputNode',
    draggable: true,
    data: {
      kind: 'input',
      label: 'Thema',
      runtime: { status: 'idle' },
      config: {
        text: 'Schreibe einen Blog-Artikel ueber: Die Zukunft von Open-Source KI-Modellen',
        successCriteria: 'Thema wurde bereitgestellt',
      },
    },
  };

  const researchAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 360, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Recherche',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Recherchiere aktuelle Informationen zum Thema. Sammle Fakten, Statistiken und verschiedene Perspektiven.',
        systemPrompt: 'Du bist ein Content-Researcher. Nutze web_search um aktuelle, relevante Quellen zu finden. Strukturiere die Ergebnisse nach Relevanz.',
        tools: ['web_search'],
        successCriteria: 'Recherche-Material wurde gesammelt',
      },
    },
  };

  const outlineTemplate: FlowNode = {
    id: makeId('template'),
    position: { x: 640, y: 220 },
    type: 'templateNode',
    draggable: true,
    data: {
      kind: 'template',
      label: 'Outline erstellen',
      runtime: { status: 'idle' },
      config: {
        template:
          'Erstelle basierend auf der Recherche einen vollstaendigen Blog-Artikel:\n\nRecherche:\n{{result}}\n\nAnforderungen:\n- Fesselnde Einleitung\n- 3-5 Hauptabschnitte mit Unterueberschriften\n- Fakten und Beispiele einbauen\n- Starkes Fazit mit Call-to-Action\n- Laenge: 1000-1500 Woerter',
        successCriteria: 'Outline wurde erstellt',
      },
    },
  };

  const writingAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 920, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Artikel schreiben',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Schreibe den Blog-Artikel gemaess den Anforderungen. Achte auf einen engagierenden, professionellen Schreibstil.',
        systemPrompt: 'Du bist ein erfahrener Content-Writer. Schreibe ansprechende, gut strukturierte Artikel mit klarer Sprache und SEO-freundlichen Ueberschriften.',
        tools: [],
        successCriteria: 'Artikel wurde geschrieben',
      },
    },
  };

  const seoTemplate: FlowNode = {
    id: makeId('template'),
    position: { x: 1200, y: 220 },
    type: 'templateNode',
    draggable: true,
    data: {
      kind: 'template',
      label: 'SEO-Check',
      runtime: { status: 'idle' },
      config: {
        template:
          'Pruefe den folgenden Artikel auf SEO und Qualitaet:\n\n{{result}}\n\nPruefe:\n1. Keyword-Dichte und -Platzierung\n2. Meta-Description Vorschlag\n3. Ueberschriften-Struktur (H1, H2, H3)\n4. Lesbarkeit und Textfluss\n5. Verbesserungsvorschlaege\n\nGib den finalen, optimierten Artikel zurueck.',
        successCriteria: 'SEO-Check Prompt wurde erstellt',
      },
    },
  };

  const reviewAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 1480, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'SEO-Review',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Fuehre den SEO-Check durch und optimiere den Artikel. Gib den finalen Artikel mit Meta-Description zurueck.',
        systemPrompt: 'Du bist ein SEO-Experte und Lektor. Optimiere Texte fuer Suchmaschinen ohne die Lesbarkeit zu beeintraechtigen.',
        tools: [],
        successCriteria: 'SEO-optimierter Artikel liegt vor',
      },
    },
  };

  const outputNode: FlowNode = {
    id: makeId('output'),
    position: { x: 1760, y: 220 },
    type: 'outputNode',
    draggable: true,
    data: {
      kind: 'output',
      label: 'Fertiger Artikel',
      runtime: { status: 'idle' },
      config: {
        result: '',
        saveToFile: true,
        filePath: 'blog_artikel.md',
      },
    },
  };

  const nodes = [inputNode, researchAgent, outlineTemplate, writingAgent, seoTemplate, reviewAgent, outputNode];

  const edges: FlowEdge[] = [
    { id: `${inputNode.id}-${researchAgent.id}`, source: inputNode.id, target: researchAgent.id, type: 'smoothstep' },
    { id: `${researchAgent.id}-${outlineTemplate.id}`, source: researchAgent.id, target: outlineTemplate.id, type: 'smoothstep' },
    { id: `${outlineTemplate.id}-${writingAgent.id}`, source: outlineTemplate.id, target: writingAgent.id, type: 'smoothstep' },
    { id: `${writingAgent.id}-${seoTemplate.id}`, source: writingAgent.id, target: seoTemplate.id, type: 'smoothstep' },
    { id: `${seoTemplate.id}-${reviewAgent.id}`, source: seoTemplate.id, target: reviewAgent.id, type: 'smoothstep' },
    { id: `${reviewAgent.id}-${outputNode.id}`, source: reviewAgent.id, target: outputNode.id, type: 'smoothstep' },
  ].map((edge) => decorateFlowEdge(edge, nodes));

  return {
    metadata: {
      name: 'Content Creation',
      description: 'Recherche → Outline → Artikel schreiben → SEO-Check → Fertiger Artikel',
    },
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 0.7 },
  };
}

// ---------------------------------------------------------------------------
// Music Generation Flow
// ---------------------------------------------------------------------------
export function createMusicGenerationWorkflow(): VisualWorkflow {
  const inputNode: FlowNode = {
    id: makeId('input'),
    position: { x: 80, y: 220 },
    type: 'inputNode',
    draggable: true,
    data: {
      kind: 'input',
      label: 'Musik-Beschreibung',
      runtime: { status: 'idle' },
      config: {
        text: 'Erstelle einen entspannten Lo-Fi Hip-Hop Beat, 90 BPM, mit sanftem Piano und Vinyl-Crackle.',
        successCriteria: 'Musik-Beschreibung wurde bereitgestellt',
      },
    },
  };

  const promptTemplate: FlowNode = {
    id: makeId('template'),
    position: { x: 360, y: 220 },
    type: 'templateNode',
    draggable: true,
    data: {
      kind: 'template',
      label: 'ACE-Step Prompt',
      runtime: { status: 'idle' },
      config: {
        template:
          'Generiere Musik basierend auf folgender Beschreibung. Erstelle einen detaillierten Prompt fuer die Musikgenerierung:\n\n{{result}}\n\nNutze das generate_music Tool mit einem praezisen, englischen Prompt der Genre, Tempo, Instrumente und Stimmung beschreibt.',
        successCriteria: 'Musik-Prompt wurde formatiert',
      },
    },
  };

  const musicAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 640, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Musik generieren',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Generiere die Musik mit dem generate_music Tool basierend auf dem Prompt. Gib den Dateipfad der generierten Audiodatei zurueck.',
        systemPrompt: 'Du bist ein Musik-Produzent. Nutze das generate_music Tool um Musik zu erstellen. Uebersetze die Beschreibung in einen praezisen englischen Prompt fuer die Generierung.',
        tools: ['generate_music'],
        successCriteria: 'Musik wurde generiert',
      },
    },
  };

  const outputNode: FlowNode = {
    id: makeId('output'),
    position: { x: 920, y: 220 },
    type: 'outputNode',
    draggable: true,
    data: {
      kind: 'output',
      label: 'Generierte Musik',
      runtime: { status: 'idle' },
      config: {
        result: '',
        saveToFile: false,
        filePath: '',
      },
    },
  };

  const nodes = [inputNode, promptTemplate, musicAgent, outputNode];

  const edges: FlowEdge[] = [
    { id: `${inputNode.id}-${promptTemplate.id}`, source: inputNode.id, target: promptTemplate.id, type: 'smoothstep' },
    { id: `${promptTemplate.id}-${musicAgent.id}`, source: promptTemplate.id, target: musicAgent.id, type: 'smoothstep' },
    { id: `${musicAgent.id}-${outputNode.id}`, source: musicAgent.id, target: outputNode.id, type: 'smoothstep' },
  ].map((edge) => decorateFlowEdge(edge, nodes));

  return {
    metadata: {
      name: 'Musik generieren',
      description: 'Beschreibung → ACE-Step Prompt → Musik generieren → Ergebnis',
    },
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 0.85 },
  };
}

// ---------------------------------------------------------------------------
// Data Pipeline Flow
// ---------------------------------------------------------------------------
export function createDataPipelineWorkflow(): VisualWorkflow {
  const inputNode: FlowNode = {
    id: makeId('input'),
    position: { x: 80, y: 220 },
    type: 'inputNode',
    draggable: true,
    data: {
      kind: 'input',
      label: 'Daten-Aufgabe',
      runtime: { status: 'idle' },
      config: {
        text: 'Lies die Datei data/input.csv, bereinige die Daten und speichere das Ergebnis als data/output.json.',
        successCriteria: 'Dateipfad und Transformationsauftrag wurden bereitgestellt',
      },
    },
  };

  const readAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 360, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Datei lesen',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Lies die angegebene Datei mit read_file und gib den Inhalt zurueck.',
        systemPrompt: 'Du bist ein Daten-Ingenieur. Lies Dateien praezise und gib den Inhalt vollstaendig zurueck.',
        tools: ['read_file'],
        successCriteria: 'Datei wurde gelesen',
      },
    },
  };

  const transformTemplate: FlowNode = {
    id: makeId('template'),
    position: { x: 640, y: 220 },
    type: 'templateNode',
    draggable: true,
    data: {
      kind: 'template',
      label: 'Transform-Prompt',
      runtime: { status: 'idle' },
      config: {
        template:
          'Transformiere die folgenden Daten gemaess der Aufgabe. Schreibe ein Python-Script das die Transformation durchfuehrt:\n\n---\n{{result}}\n---\n\nDas Script soll:\n1. Die Daten parsen\n2. Bereinigen (fehlende Werte, Duplikate, Formatierung)\n3. Transformieren (gemaess Aufgabe)\n4. Das Ergebnis als String ausgeben (print)',
        successCriteria: 'Transform-Prompt wurde erstellt',
      },
    },
  };

  const transformAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 920, y: 220 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Daten transformieren',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Schreibe und fuehre ein Python-Script aus das die Daten transformiert. Nutze run_code um das Script auszufuehren.',
        systemPrompt: 'Du bist ein Daten-Ingenieur und Python-Experte. Schreibe sauberen, effizienten Code fuer Datentransformationen.',
        tools: ['run_code'],
        successCriteria: 'Daten wurden transformiert',
      },
    },
  };

  const conditionNode: FlowNode = {
    id: makeId('condition'),
    position: { x: 1200, y: 220 },
    type: 'conditionNode',
    draggable: true,
    data: {
      kind: 'condition',
      label: 'Validierung OK?',
      runtime: { status: 'idle' },
      config: {
        mode: 'llm',
        prompt: 'Wurden die Daten erfolgreich transformiert ohne Fehler? Ist das Ergebnis valide und vollstaendig? Antworte mit true oder false.',
        expression: '',
        model: 'qwen3:30b-a3b',
        successCriteria: 'Validierung wurde durchgefuehrt',
      } satisfies ConditionNodeConfig,
    },
  };

  const writeAgent: FlowNode = {
    id: makeId('agent'),
    position: { x: 1480, y: 160 },
    type: 'agentNode',
    draggable: true,
    data: {
      kind: 'agent',
      label: 'Datei speichern',
      runtime: { status: 'idle' },
      config: {
        model: 'qwen3:30b-a3b',
        prompt: 'Speichere die transformierten Daten in die Zieldatei mit write_file.',
        systemPrompt: 'Du bist ein Daten-Ingenieur. Speichere Daten praezise im gewuenschten Format.',
        tools: ['write_file'],
        successCriteria: 'Datei wurde gespeichert',
      },
    },
  };

  const outputTrue: FlowNode = {
    id: makeId('output'),
    position: { x: 1760, y: 160 },
    type: 'outputNode',
    draggable: true,
    data: {
      kind: 'output',
      label: 'Pipeline OK',
      runtime: { status: 'idle' },
      config: {
        result: '',
        saveToFile: false,
        filePath: '',
      },
    },
  };

  const outputFalse: FlowNode = {
    id: makeId('output'),
    position: { x: 1480, y: 280 },
    type: 'outputNode',
    draggable: true,
    data: {
      kind: 'output',
      label: 'Fehler',
      runtime: { status: 'idle' },
      config: {
        result: '',
        saveToFile: true,
        filePath: 'pipeline_fehler.md',
      },
    },
  };

  const nodes = [inputNode, readAgent, transformTemplate, transformAgent, conditionNode, writeAgent, outputTrue, outputFalse];

  const edges: FlowEdge[] = [
    { id: `${inputNode.id}-${readAgent.id}`, source: inputNode.id, target: readAgent.id, type: 'smoothstep' },
    { id: `${readAgent.id}-${transformTemplate.id}`, source: readAgent.id, target: transformTemplate.id, type: 'smoothstep' },
    { id: `${transformTemplate.id}-${transformAgent.id}`, source: transformTemplate.id, target: transformAgent.id, type: 'smoothstep' },
    { id: `${transformAgent.id}-${conditionNode.id}`, source: transformAgent.id, target: conditionNode.id, type: 'smoothstep' },
    { id: `${conditionNode.id}-true-${writeAgent.id}`, source: conditionNode.id, target: writeAgent.id, sourceHandle: 'true', type: 'smoothstep' },
    { id: `${conditionNode.id}-false-${outputFalse.id}`, source: conditionNode.id, target: outputFalse.id, sourceHandle: 'false', type: 'smoothstep' },
    { id: `${writeAgent.id}-${outputTrue.id}`, source: writeAgent.id, target: outputTrue.id, type: 'smoothstep' },
  ].map((edge) => decorateFlowEdge(edge, nodes));

  return {
    metadata: {
      name: 'Data Pipeline',
      description: 'Datei lesen → Transformieren → Validierung → Speichern oder Fehler',
    },
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 0.75 },
  };
}

export type FlowTemplateId = 'default' | 'pdf-processing' | 'excel-processing' | 'web-research' | 'code-review' | 'content-creation' | 'music-generation' | 'data-pipeline';

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
  {
    id: 'excel-processing',
    name: 'Excel Verarbeitung',
    description: 'Excel lesen → Formatieren → Datenanalyse → Ergebnis',
    create: () => createExcelProcessingWorkflow(),
  },
  {
    id: 'web-research',
    name: 'Web Research',
    description: 'Web-Suche → Analyse mit Quellenbewertung → Ergebnis',
    create: () => createWebResearchWorkflow(),
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Datei lesen → Review → Condition → Fixes oder OK',
    create: () => createCodeReviewWorkflow(),
  },
  {
    id: 'content-creation',
    name: 'Content Creation',
    description: 'Recherche → Outline → Schreiben → SEO-Check → Artikel',
    create: () => createContentCreationWorkflow(),
  },
  {
    id: 'music-generation',
    name: 'Musik generieren',
    description: 'Beschreibung → Prompt → Musik generieren → Ergebnis',
    create: () => createMusicGenerationWorkflow(),
  },
  {
    id: 'data-pipeline',
    name: 'Data Pipeline',
    description: 'Datei lesen → Transformieren → Validieren → Speichern',
    create: () => createDataPipelineWorkflow(),
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
