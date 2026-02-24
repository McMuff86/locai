import { FLOW_TEMPLATES } from '@/lib/flow/registry';
import type { FlowNode, FlowEdge, VisualWorkflow } from '@/lib/flow/types';

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a flow template by its ID.
 * Checks: all nodes connected, no orphan nodes, at least 1 agent, output present.
 */
export function validateTemplate(templateId: string): TemplateValidationResult {
  const template = FLOW_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return { valid: false, errors: [`Template "${templateId}" not found`], warnings: [] };
  }

  const workflow = template.create();
  return validateWorkflow(workflow);
}

/**
 * Validate a VisualWorkflow directly.
 */
export function validateWorkflow(workflow: VisualWorkflow): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { nodes, edges } = workflow;

  // Check: at least 1 agent or template node
  const hasAgent = nodes.some(
    (n) => n.data.kind === 'agent' || n.data.kind === 'template',
  );
  if (!hasAgent) {
    errors.push('Workflow must contain at least one agent or template node');
  }

  // Check: output node present
  const hasOutput = nodes.some((n) => n.data.kind === 'output');
  if (!hasOutput) {
    errors.push('Workflow must contain at least one output node');
  }

  // Check: input node present
  const hasInput = nodes.some((n) => n.data.kind === 'input');
  if (!hasInput) {
    errors.push('Workflow must contain at least one input node');
  }

  // Check: no orphan nodes (every node must have at least one edge)
  const connectedNodeIds = new Set<string>();
  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  for (const node of nodes) {
    if (!connectedNodeIds.has(node.id)) {
      errors.push(`Orphan node detected: "${node.data.label}" (${node.id})`);
    }
  }

  // Check: no duplicate node IDs
  const nodeIds = nodes.map((n) => n.id);
  const uniqueIds = new Set(nodeIds);
  if (uniqueIds.size !== nodeIds.length) {
    errors.push('Duplicate node IDs detected');
  }

  // Check: edges reference existing nodes
  const nodeIdSet = new Set(nodeIds);
  for (const edge of edges) {
    if (!nodeIdSet.has(edge.source)) {
      errors.push(`Edge "${edge.id}" references non-existent source node "${edge.source}"`);
    }
    if (!nodeIdSet.has(edge.target)) {
      errors.push(`Edge "${edge.id}" references non-existent target node "${edge.target}"`);
    }
  }

  // Warnings
  if (!workflow.metadata.name) {
    warnings.push('Workflow has no name');
  }

  // Check for agent nodes without model set
  for (const node of nodes) {
    if (node.data.kind === 'agent' && !node.data.config.model) {
      warnings.push(`Agent node "${node.data.label}" (${node.id}) has no model configured`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
