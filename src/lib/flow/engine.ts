import type { WorkflowPlan, WorkflowPlanStep } from '@/lib/agents/workflowTypes';
import type {
  ConditionNodeData,
  FlowCompileResult,
  FlowEdge,
  FlowNode,
  FlowNodeKind,
  LoopNodeData,
  VisualWorkflow,
} from '@/lib/flow/types';

export class FlowCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowCompileError';
  }
}

function incomingEdges(edges: FlowEdge[], nodeId: string): FlowEdge[] {
  return edges.filter((edge) => edge.target === nodeId);
}

/** Identify back-edges: edges targeting a loop node's 'loop-back' handle */
function findBackEdges(edges: FlowEdge[], nodes: FlowNode[]): Set<string> {
  const loopNodeIds = new Set(nodes.filter((n) => n.data.kind === 'loop').map((n) => n.id));
  const backEdgeIds = new Set<string>();
  for (const edge of edges) {
    if (loopNodeIds.has(edge.target) && edge.targetHandle === 'loop-back') {
      backEdgeIds.add(edge.id);
    }
  }
  return backEdgeIds;
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
    case 'condition': {
      const cfg = (node.data as ConditionNodeData).config;
      return cfg.mode === 'llm'
        ? `Bedingung prüfen (LLM): ${cfg.prompt.trim().slice(0, 80) || 'Prompt'}`
        : `Bedingung prüfen: ${cfg.expression.trim() || 'Ausdruck'}`;
    }
    case 'loop': {
      const cfg = (node.data as LoopNodeData).config;
      if (cfg.mode === 'count') return `Schleife (${cfg.count}x)`;
      if (cfg.mode === 'condition') return `Schleife (Bedingung): ${cfg.conditionExpression.trim().slice(0, 60)}`;
      return `Schleife (LLM): ${cfg.prompt.trim().slice(0, 60) || 'Prompt'}`;
    }
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
    case 'condition':
      return (node.data as ConditionNodeData).config.successCriteria?.trim() || 'Bedingung wurde ausgewertet';
    case 'loop':
      return (node.data as LoopNodeData).config.successCriteria?.trim() || 'Schleife wurde ausgefuehrt';
  }
}

function expectedToolsForNode(node: FlowNode): string[] {
  if (node.data.kind !== 'agent') {
    return [];
  }

  return [...new Set(node.data.config.tools.map((tool) => tool.trim()).filter(Boolean))];
}

function isRunnableNode(kind: FlowNodeKind): boolean {
  return kind === 'agent' || kind === 'template' || kind === 'condition' || kind === 'loop';
}

function findFirstNodeByKind(nodes: FlowNode[], kind: FlowNodeKind): FlowNode | undefined {
  return nodes.find((node) => node.data.kind === kind);
}

export function compileVisualWorkflowToPlan(workflow: VisualWorkflow): FlowCompileResult {
  if (workflow.nodes.length === 0) {
    throw new FlowCompileError('Der Flow ist leer. Bitte füge mindestens einen Input- und Agent-Node hinzu.');
  }

  // Remove back-edges before topological sort to avoid false cycle detection
  const backEdgeIds = findBackEdges(workflow.edges, workflow.nodes);
  const forwardEdges = workflow.edges.filter((e) => !backEdgeIds.has(e.id));

  const sortedNodes = topologicalSort(workflow.nodes, forwardEdges);
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

  if (!firstAgentNode && !sortedNodes.some((n) => n.data.kind === 'condition' || n.data.kind === 'loop')) {
    throw new FlowCompileError('Kein Agent-Node gefunden. Mindestens ein Agent-Node ist für die Ausführung nötig.');
  }

  if (!outputNode) {
    warnings.push('Kein Output-Node gefunden. Das Ergebnis wird nur im Run-Status angezeigt.');
  }

  // Build branch tagging: map node IDs to their branch condition
  const branchMap = new Map<string, { conditionStepId: string; branch: 'true' | 'false' }>();
  const conditionNodes = sortedNodes.filter((n) => n.data.kind === 'condition');

  for (const condNode of conditionNodes) {
    // Find edges from this condition node
    const trueEdges = forwardEdges.filter((e) => e.source === condNode.id && e.sourceHandle === 'true');
    const falseEdges = forwardEdges.filter((e) => e.source === condNode.id && e.sourceHandle === 'false');

    // BFS to tag downstream nodes for each branch
    const tagDownstream = (startEdges: FlowEdge[], branch: 'true' | 'false') => {
      const queue = startEdges.map((e) => e.target);
      const visited = new Set<string>();
      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        // Don't overwrite if already tagged (closest condition wins)
        if (!branchMap.has(nodeId)) {
          branchMap.set(nodeId, { conditionStepId: condNode.id, branch });
        }
        // Continue downstream
        for (const edge of forwardEdges) {
          if (edge.source === nodeId && !visited.has(edge.target)) {
            queue.push(edge.target);
          }
        }
      }
    };

    tagDownstream(trueEdges, 'true');
    tagDownstream(falseEdges, 'false');
  }

  // Build loop body mapping: for each loop node, find body step IDs
  const loopBodyMap = new Map<string, string[]>();
  const loopNodes = sortedNodes.filter((n) => n.data.kind === 'loop');

  for (const loopNode of loopNodes) {
    // Body nodes: reachable from loop's "body" output handle
    // Back to the loop-back handle (via back-edges)
    const bodyEdges = forwardEdges.filter((e) => e.source === loopNode.id && e.sourceHandle === 'body');
    const bodyNodeIds: string[] = [];
    const queue = bodyEdges.map((e) => e.target);
    const visited = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId) || nodeId === loopNode.id) continue;
      visited.add(nodeId);
      if (runnableNodeIds.has(nodeId)) {
        bodyNodeIds.push(nodeId);
      }
      // Check if any back-edge from this node goes to the loop
      const hasBackEdge = workflow.edges.some(
        (e) => backEdgeIds.has(e.id) && e.source === nodeId && e.target === loopNode.id,
      );
      if (!hasBackEdge) {
        // Continue downstream only if not looping back
        for (const edge of forwardEdges) {
          if (edge.source === nodeId && !visited.has(edge.target)) {
            queue.push(edge.target);
          }
        }
      }
    }

    loopBodyMap.set(loopNode.id, bodyNodeIds);
  }

  const steps: WorkflowPlanStep[] = sortedNodes
    .filter((node) => isRunnableNode(node.data.kind))
    .map((node) => {
      const dependsOn = incomingEdges(forwardEdges, node.id)
        .map((edge) => edge.source)
        .filter((sourceId) => nodeIds.has(sourceId) && runnableNodeIds.has(sourceId));

      const step: WorkflowPlanStep = {
        id: node.id,
        description: stepDescriptionForNode(node),
        expectedTools: expectedToolsForNode(node),
        dependsOn: [...new Set(dependsOn)],
        successCriteria: successCriteriaForNode(node),
      };

      // Add step type
      if (node.data.kind === 'condition') {
        step.stepType = 'condition';
        const cfg = (node.data as ConditionNodeData).config;
        step.conditionConfig = {
          mode: cfg.mode,
          prompt: cfg.mode === 'llm' ? cfg.prompt : undefined,
          expression: cfg.mode === 'expression' ? cfg.expression : undefined,
        };
      } else if (node.data.kind === 'loop') {
        step.stepType = 'loop';
        const cfg = (node.data as LoopNodeData).config;
        step.loopConfig = {
          mode: cfg.mode,
          maxIterations: cfg.maxIterations,
          count: cfg.mode === 'count' ? cfg.count : undefined,
          expression: cfg.mode === 'condition' ? cfg.conditionExpression : undefined,
          prompt: cfg.mode === 'llm' ? cfg.prompt : undefined,
          bodyStepIds: loopBodyMap.get(node.id) ?? [],
        };
      }

      // Add branch condition if this node is in a condition branch
      const branch = branchMap.get(node.id);
      if (branch) {
        step.branchCondition = branch;
      }

      return step;
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
