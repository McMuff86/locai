import yaml from 'js-yaml';
import { FLOW_NODE_DEFINITIONS } from './registry';
import type { FlowEdge, FlowNode, FlowNodeKind, VisualWorkflow } from './types';

export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  workflow?: VisualWorkflow;
}

const KNOWN_KINDS = new Set<string>(FLOW_NODE_DEFINITIONS.map((d) => d.kind));

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportWorkflowAsJson(workflow: VisualWorkflow): string {
  return JSON.stringify(workflow, null, 2);
}

export function exportWorkflowAsYaml(workflow: VisualWorkflow): string {
  return yaml.dump(workflow, { indent: 2, lineWidth: 120, noRefs: true });
}

export function downloadAsFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export function importWorkflowFromJson(jsonString: string): ImportValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { valid: false, errors: ['Ungültiges JSON-Format.'], warnings: [] };
  }
  return validateWorkflow(parsed);
}

export function importWorkflowFromYaml(yamlString: string): ImportValidationResult {
  let parsed: unknown;
  try {
    parsed = yaml.load(yamlString);
  } catch {
    return { valid: false, errors: ['Ungültiges YAML-Format.'], warnings: [] };
  }
  return validateWorkflow(parsed);
}

function validateWorkflow(data: unknown): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Datei enthält kein gültiges Workflow-Objekt.'], warnings: [] };
  }

  const obj = data as Record<string, unknown>;

  // Check required fields
  if (!Array.isArray(obj.nodes)) {
    errors.push('Pflichtfeld "nodes" fehlt oder ist kein Array.');
  }

  if (!Array.isArray(obj.edges)) {
    errors.push('Pflichtfeld "edges" fehlt oder ist kein Array.');
  }

  if (!obj.metadata || typeof obj.metadata !== 'object') {
    errors.push('Pflichtfeld "metadata" fehlt oder ist kein Objekt.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const nodes = obj.nodes as FlowNode[];
  const edges = obj.edges as FlowEdge[];

  // Validate node kinds
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!node.id) {
      errors.push('Ein Node hat keine ID.');
      continue;
    }
    nodeIds.add(node.id);

    const kind = (node.data as { kind?: string })?.kind;
    if (!kind) {
      errors.push(`Node "${node.id}" hat kein "kind"-Feld.`);
    } else if (!KNOWN_KINDS.has(kind)) {
      warnings.push(`Node "${node.id}" hat unbekannten Typ: "${kind}".`);
    }
  }

  // Validate edge references
  for (const edge of edges) {
    if (!edge.source || !edge.target) {
      errors.push(`Eine Edge hat keine source/target Referenz.`);
      continue;
    }
    if (!nodeIds.has(edge.source)) {
      warnings.push(`Edge "${edge.id}" referenziert unbekannten Source-Node: "${edge.source}".`);
    }
    if (!nodeIds.has(edge.target)) {
      warnings.push(`Edge "${edge.id}" referenziert unbekannten Target-Node: "${edge.target}".`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Build the workflow
  const metadata = obj.metadata as { name?: string; description?: string };
  const viewport = (obj.viewport as { x?: number; y?: number; zoom?: number }) ?? {
    x: 0,
    y: 0,
    zoom: 1,
  };

  const workflow: VisualWorkflow = {
    nodes,
    edges,
    viewport: {
      x: viewport.x ?? 0,
      y: viewport.y ?? 0,
      zoom: viewport.zoom ?? 1,
    },
    metadata: {
      name: metadata.name ?? 'Importierter Flow',
      description: metadata.description,
    },
  };

  return { valid: true, errors: [], warnings, workflow };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsText(file);
  });
}

export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}
