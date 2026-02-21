import type { WorkflowPlan, WorkflowPlanStep } from '@/lib/agents/workflowTypes';
import type { FlowCompileResult, FlowEdge, FlowNode, FlowNodeKind, VisualWorkflow } from '@/lib/flow/types';

export class FlowCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowCompileError';
  }
}

function incomingEdges(edges: FlowEdge[], nodeId: string): FlowEdge[] {
  return edges.filter((edge) => edge.target === nodeId);
}

function topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue;
    }

    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of indegree.entries()) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sorted: FlowNode[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    const node = nodes.find((candidate) => candidate.id === current);
    if (node) {
      sorted.push(node);
    }

    for (const target of adjacency.get(current) ?? []) {
      const nextDegree = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, nextDegree);
      if (nextDegree === 0) {
        queue.push(target);
      }
    }
  }

  if (sorted.length !== nodes.length) {
    throw new FlowCompileError('Der Workflow enthält einen Zyklus. Bitte entferne die Loop-Verbindung.');
  }

  return sorted;
}

function stepDescriptionForNode(node: FlowNode): string {
  switch (node.data.kind) {
    case 'input': {
      const text = node.data.config.text.trim();
      return text ? `Nutzereingabe: ${text}` : 'Nutzereingabe bereitstellen';
    }
    case 'agent': {
      const prompt = node.data.config.prompt.trim();
      return prompt || node.data.label || 'Agent-Schritt ausführen';
    }
    case 'template': {
      const template = node.data.config.template.trim();
      return template ? `Template anwenden: ${template}` : 'Template anwenden';
    }
    case 'output':
      return 'Ergebnis bereitstellen';
  }
}

function successCriteriaForNode(node: FlowNode): string {
  switch (node.data.kind) {
    case 'input':
      return node.data.config.successCriteria?.trim() || 'Eingabe liegt vor';
    case 'agent':
      return node.data.config.successCriteria?.trim() || 'Agent hat den Schritt erfolgreich ausgeführt';
    case 'template':
      return node.data.config.successCriteria?.trim() || 'Template wurde korrekt angewendet';
    case 'output':
      return 'Finales Ergebnis ist vorhanden';
  }
}

function expectedToolsForNode(node: FlowNode): string[] {
  if (node.data.kind !== 'agent') {
    return [];
  }

  return [...new Set(node.data.config.tools.map((tool) => tool.trim()).filter(Boolean))];
}

function isRunnableNode(kind: FlowNodeKind): boolean {
  return kind === 'agent' || kind === 'template';
}

function findFirstNodeByKind(nodes: FlowNode[], kind: FlowNodeKind): FlowNode | undefined {
  return nodes.find((node) => node.data.kind === kind);
}

export function compileVisualWorkflowToPlan(workflow: VisualWorkflow): FlowCompileResult {
  if (workflow.nodes.length === 0) {
    throw new FlowCompileError('Der Flow ist leer. Bitte füge mindestens einen Input- und Agent-Node hinzu.');
  }

  const sortedNodes = topologicalSort(workflow.nodes, workflow.edges);
  const nodeIds = new Set(sortedNodes.map((node) => node.id));
  const runnableNodeIds = new Set(
    sortedNodes.filter((node) => isRunnableNode(node.data.kind)).map((node) => node.id),
  );
  const warnings: string[] = [];

  const inputNode = findFirstNodeByKind(sortedNodes, 'input');
  const outputNode = findFirstNodeByKind(sortedNodes, 'output');
  const firstAgentNode = findFirstNodeByKind(sortedNodes, 'agent');

  if (!inputNode) {
    warnings.push('Kein Input-Node gefunden. Es wird eine generische Startnachricht verwendet.');
  }

  if (!firstAgentNode) {
    throw new FlowCompileError('Kein Agent-Node gefunden. Mindestens ein Agent-Node ist für die Ausführung nötig.');
  }

  if (!outputNode) {
    warnings.push('Kein Output-Node gefunden. Das Ergebnis wird nur im Run-Status angezeigt.');
  }

  const steps: WorkflowPlanStep[] = sortedNodes
    .filter((node) => isRunnableNode(node.data.kind))
    .map((node) => {
      const dependsOn = incomingEdges(workflow.edges, node.id)
        .map((edge) => edge.source)
        .filter((sourceId) => nodeIds.has(sourceId) && runnableNodeIds.has(sourceId));

      return {
        id: node.id,
        description: stepDescriptionForNode(node),
        expectedTools: expectedToolsForNode(node),
        dependsOn: [...new Set(dependsOn)],
        successCriteria: successCriteriaForNode(node),
      };
    });

  if (steps.length === 0) {
    throw new FlowCompileError('Es konnte kein ausführbarer Schritt aus dem Graphen erzeugt werden.');
  }

  const goal =
    workflow.metadata.description?.trim() ||
    outputNode?.data.label ||
    'Flow erfolgreich ausführen';

  const plan: WorkflowPlan = {
    goal,
    steps,
    maxSteps: steps.length,
    createdAt: new Date().toISOString(),
    version: 1,
  };

  const entryMessage =
    inputNode && inputNode.data.kind === 'input'
      ? inputNode.data.config.text.trim() || goal
      : goal;
  const provider =
    firstAgentNode && firstAgentNode.data.kind === 'agent'
      ? firstAgentNode.data.config.provider ?? 'ollama'
      : 'ollama' as const;
  const rawModel =
    firstAgentNode && firstAgentNode.data.kind === 'agent'
      ? firstAgentNode.data.config.model.trim()
      : '';
  const providerDefault: Record<string, string> = {
    ollama: 'llama3',
    anthropic: 'claude-sonnet-4-20250514',
    openai: 'gpt-4o',
    openrouter: 'anthropic/claude-sonnet-4-20250514',
  };
  const model = rawModel || providerDefault[provider] || 'llama3';
  const systemPrompt =
    firstAgentNode && firstAgentNode.data.kind === 'agent'
      ? firstAgentNode.data.config.systemPrompt?.trim() || undefined
      : undefined;
  const enabledTools = [
    ...new Set(
      sortedNodes.reduce<string[]>((acc, node) => {
        if (node.data.kind === 'agent') {
          acc.push(...node.data.config.tools);
        }
        return acc;
      }, []).map((tool) => tool.trim()).filter(Boolean),
    ),
  ];

  return {
    plan,
    entryMessage,
    model,
    provider,
    systemPrompt,
    enabledTools,
    outputNodeId: outputNode?.id ?? null,
    warnings,
  };
}
