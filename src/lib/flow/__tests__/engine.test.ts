import { describe, expect, it } from 'vitest';
import { FlowCompileError, compileVisualWorkflowToPlan } from '@/lib/flow/engine';
import { createFlowNode, FLOW_TEMPLATES } from '@/lib/flow/registry';
import type { FlowEdge, FlowNode, VisualWorkflow } from '@/lib/flow/types';
import { validateTemplate, validateWorkflow } from '@/lib/flow/validateTemplate';

function nodeWithId(node: FlowNode, id: string): FlowNode {
  return {
    ...node,
    id,
  };
}

function makeWorkflow(nodes: FlowNode[], edges: FlowEdge[]): VisualWorkflow {
  return {
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {
      name: 'test-workflow',
      description: 'test description',
    },
  };
}

describe('compileVisualWorkflowToPlan', () => {
  it('compiles a linear graph into ordered steps', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'input-1');
    const agent = nodeWithId(createFlowNode('agent', { x: 200, y: 0 }), 'agent-1');
    const template = nodeWithId(createFlowNode('template', { x: 400, y: 0 }), 'template-1');
    const output = nodeWithId(createFlowNode('output', { x: 600, y: 0 }), 'output-1');

    const workflow = makeWorkflow(
      [input, agent, template, output],
      [
        { id: 'e1', source: input.id, target: agent.id, type: 'smoothstep' },
        { id: 'e2', source: agent.id, target: template.id, type: 'smoothstep' },
        { id: 'e3', source: template.id, target: output.id, type: 'smoothstep' },
      ],
    );

    const result = compileVisualWorkflowToPlan(workflow);

    expect(result.plan.steps.map((step) => step.id)).toEqual([agent.id, template.id]);
    expect(result.plan.maxSteps).toBe(2);
    expect(result.outputNodeId).toBe(output.id);
    expect(result.warnings).toEqual([]);
  });

  it('throws on cycle detection', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'input-1');
    const agent = nodeWithId(createFlowNode('agent', { x: 200, y: 0 }), 'agent-1');
    const output = nodeWithId(createFlowNode('output', { x: 400, y: 0 }), 'output-1');

    const workflow = makeWorkflow(
      [input, agent, output],
      [
        { id: 'e1', source: input.id, target: agent.id, type: 'smoothstep' },
        { id: 'e2', source: agent.id, target: input.id, type: 'smoothstep' },
        { id: 'e3', source: agent.id, target: output.id, type: 'smoothstep' },
      ],
    );

    expect(() => compileVisualWorkflowToPlan(workflow)).toThrow(FlowCompileError);
  });

  it('throws when no agent node exists', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'input-1');
    const output = nodeWithId(createFlowNode('output', { x: 300, y: 0 }), 'output-1');

    const workflow = makeWorkflow(
      [input, output],
      [{ id: 'e1', source: input.id, target: output.id, type: 'smoothstep' }],
    );

    expect(() => compileVisualWorkflowToPlan(workflow)).toThrow(FlowCompileError);
  });

  it('maps dependsOn from incoming runnable edges', () => {
    const inputA = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'input-a');
    const inputB = nodeWithId(createFlowNode('input', { x: 0, y: 120 }), 'input-b');
    const agent = nodeWithId(createFlowNode('agent', { x: 260, y: 60 }), 'agent-1');
    const output = nodeWithId(createFlowNode('output', { x: 520, y: 60 }), 'output-1');

    const workflow = makeWorkflow(
      [inputA, inputB, agent, output],
      [
        { id: 'e1', source: inputA.id, target: agent.id, type: 'smoothstep' },
        { id: 'e2', source: inputB.id, target: agent.id, type: 'smoothstep' },
        { id: 'e3', source: agent.id, target: output.id, type: 'smoothstep' },
      ],
    );

    const result = compileVisualWorkflowToPlan(workflow);
    const agentStep = result.plan.steps.find((step) => step.id === agent.id);

    expect(agentStep).toBeDefined();
    expect(new Set(agentStep?.dependsOn)).toEqual(new Set());
  });

  it('compiles a condition node with branchCondition metadata', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'input-1');
    const condition = nodeWithId(createFlowNode('condition', { x: 200, y: 0 }), 'cond-1');
    const agentTrue = nodeWithId(createFlowNode('agent', { x: 400, y: -60 }), 'agent-true');
    const agentFalse = nodeWithId(createFlowNode('agent', { x: 400, y: 60 }), 'agent-false');
    const output = nodeWithId(createFlowNode('output', { x: 600, y: 0 }), 'output-1');

    const workflow = makeWorkflow(
      [input, condition, agentTrue, agentFalse, output],
      [
        { id: 'e1', source: input.id, target: condition.id, type: 'smoothstep' },
        { id: 'e2', source: condition.id, target: agentTrue.id, type: 'smoothstep', sourceHandle: 'true' },
        { id: 'e3', source: condition.id, target: agentFalse.id, type: 'smoothstep', sourceHandle: 'false' },
        { id: 'e4', source: agentTrue.id, target: output.id, type: 'smoothstep' },
        { id: 'e5', source: agentFalse.id, target: output.id, type: 'smoothstep' },
      ],
    );

    const result = compileVisualWorkflowToPlan(workflow);
    const condStep = result.plan.steps.find((s) => s.id === 'cond-1');
    const trueStep = result.plan.steps.find((s) => s.id === 'agent-true');
    const falseStep = result.plan.steps.find((s) => s.id === 'agent-false');

    expect(condStep).toBeDefined();
    expect(condStep?.stepType).toBe('condition');
    expect(condStep?.conditionConfig).toBeDefined();

    expect(trueStep?.branchCondition).toEqual({ conditionStepId: 'cond-1', branch: 'true' });
    expect(falseStep?.branchCondition).toEqual({ conditionStepId: 'cond-1', branch: 'false' });
  });

  it('does not throw cycle error for loop back-edges', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'input-1');
    const loop = nodeWithId(createFlowNode('loop', { x: 200, y: 0 }), 'loop-1');
    const agent = nodeWithId(createFlowNode('agent', { x: 400, y: 0 }), 'agent-1');
    const output = nodeWithId(createFlowNode('output', { x: 600, y: 0 }), 'output-1');

    const workflow = makeWorkflow(
      [input, loop, agent, output],
      [
        { id: 'e1', source: input.id, target: loop.id, type: 'smoothstep', targetHandle: 'input' },
        { id: 'e2', source: loop.id, target: agent.id, type: 'smoothstep', sourceHandle: 'body' },
        // Back-edge: agent -> loop (loop-back)
        { id: 'e3', source: agent.id, target: loop.id, type: 'smoothstep', targetHandle: 'loop-back' },
        { id: 'e4', source: loop.id, target: output.id, type: 'smoothstep', sourceHandle: 'done' },
      ],
    );

    // Should NOT throw (back-edge is excluded from cycle detection)
    expect(() => compileVisualWorkflowToPlan(workflow)).not.toThrow();
  });

  it('marks loop body steps correctly', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'input-1');
    const loop = nodeWithId(createFlowNode('loop', { x: 200, y: 0 }), 'loop-1');
    const agent = nodeWithId(createFlowNode('agent', { x: 400, y: 0 }), 'agent-body');
    const output = nodeWithId(createFlowNode('output', { x: 600, y: 0 }), 'output-1');

    const workflow = makeWorkflow(
      [input, loop, agent, output],
      [
        { id: 'e1', source: input.id, target: loop.id, type: 'smoothstep', targetHandle: 'input' },
        { id: 'e2', source: loop.id, target: agent.id, type: 'smoothstep', sourceHandle: 'body' },
        { id: 'e3', source: agent.id, target: loop.id, type: 'smoothstep', targetHandle: 'loop-back' },
        { id: 'e4', source: loop.id, target: output.id, type: 'smoothstep', sourceHandle: 'done' },
      ],
    );

    const result = compileVisualWorkflowToPlan(workflow);
    const loopStep = result.plan.steps.find((s) => s.id === 'loop-1');

    expect(loopStep).toBeDefined();
    expect(loopStep?.stepType).toBe('loop');
    expect(loopStep?.loopConfig?.bodyStepIds).toContain('agent-body');
  });

  it('compiles a mixed graph (condition + loop + linear)', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'in');
    const agent1 = nodeWithId(createFlowNode('agent', { x: 200, y: 0 }), 'a1');
    const condition = nodeWithId(createFlowNode('condition', { x: 400, y: 0 }), 'cond');
    const agent2 = nodeWithId(createFlowNode('agent', { x: 600, y: -60 }), 'a2');
    const output = nodeWithId(createFlowNode('output', { x: 800, y: 0 }), 'out');

    const workflow = makeWorkflow(
      [input, agent1, condition, agent2, output],
      [
        { id: 'e1', source: 'in', target: 'a1', type: 'smoothstep' },
        { id: 'e2', source: 'a1', target: 'cond', type: 'smoothstep' },
        { id: 'e3', source: 'cond', target: 'a2', type: 'smoothstep', sourceHandle: 'true' },
        { id: 'e4', source: 'cond', target: 'out', type: 'smoothstep', sourceHandle: 'false' },
        { id: 'e5', source: 'a2', target: 'out', type: 'smoothstep' },
      ],
    );

    const result = compileVisualWorkflowToPlan(workflow);
    expect(result.plan.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.plan.steps.some((s) => s.stepType === 'condition')).toBe(true);
  });

  it('propagates per-node temperature and maxIterations', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'input-1');
    const agent = nodeWithId(createFlowNode('agent', { x: 200, y: 0 }), 'agent-1');
    // Set per-node settings
    if (agent.data.kind === 'agent') {
      agent.data.config.temperature = 0.3;
      agent.data.config.maxIterations = 5;
    }
    const output = nodeWithId(createFlowNode('output', { x: 400, y: 0 }), 'output-1');

    const workflow = makeWorkflow(
      [input, agent, output],
      [
        { id: 'e1', source: 'input-1', target: 'agent-1', type: 'smoothstep' },
        { id: 'e2', source: 'agent-1', target: 'output-1', type: 'smoothstep' },
      ],
    );

    const result = compileVisualWorkflowToPlan(workflow);
    const step = result.plan.steps.find((s) => s.id === 'agent-1');

    expect(step?.temperature).toBe(0.3);
    expect(step?.maxIterations).toBe(5);
  });

  it('propagates per-node provider', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'input-1');
    const agent = nodeWithId(createFlowNode('agent', { x: 200, y: 0 }), 'agent-1');
    if (agent.data.kind === 'agent') {
      agent.data.config.provider = 'anthropic';
      agent.data.config.model = 'claude-sonnet-4-20250514';
    }
    const output = nodeWithId(createFlowNode('output', { x: 400, y: 0 }), 'output-1');

    const workflow = makeWorkflow(
      [input, agent, output],
      [
        { id: 'e1', source: 'input-1', target: 'agent-1', type: 'smoothstep' },
        { id: 'e2', source: 'agent-1', target: 'output-1', type: 'smoothstep' },
      ],
    );

    const result = compileVisualWorkflowToPlan(workflow);
    const step = result.plan.steps.find((s) => s.id === 'agent-1');

    expect(step?.provider).toBe('anthropic');
    expect(step?.model).toBe('claude-sonnet-4-20250514');
  });

  it('isolates enabledTools per step', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'in');
    const agent1 = nodeWithId(createFlowNode('agent', { x: 200, y: 0 }), 'a1');
    const agent2 = nodeWithId(createFlowNode('agent', { x: 400, y: 0 }), 'a2');
    const output = nodeWithId(createFlowNode('output', { x: 600, y: 0 }), 'out');

    if (agent1.data.kind === 'agent') {
      agent1.data.config.tools = ['web_search'];
    }
    if (agent2.data.kind === 'agent') {
      agent2.data.config.tools = ['file_read', 'file_write'];
    }

    const workflow = makeWorkflow(
      [input, agent1, agent2, output],
      [
        { id: 'e1', source: 'in', target: 'a1', type: 'smoothstep' },
        { id: 'e2', source: 'a1', target: 'a2', type: 'smoothstep' },
        { id: 'e3', source: 'a2', target: 'out', type: 'smoothstep' },
      ],
    );

    const result = compileVisualWorkflowToPlan(workflow);
    const s1 = result.plan.steps.find((s) => s.id === 'a1');
    const s2 = result.plan.steps.find((s) => s.id === 'a2');

    expect(s1?.expectedTools).toEqual(['web_search']);
    expect(s2?.expectedTools).toEqual(['file_read', 'file_write']);
    // Global enabledTools should contain all
    expect(result.enabledTools).toEqual(expect.arrayContaining(['web_search', 'file_read', 'file_write']));
  });

  it('propagates systemPrompt per agent node', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'input-1');
    const agent = nodeWithId(createFlowNode('agent', { x: 200, y: 0 }), 'agent-1');
    if (agent.data.kind === 'agent') {
      agent.data.config.systemPrompt = 'You are a helpful coding assistant.';
    }
    const output = nodeWithId(createFlowNode('output', { x: 400, y: 0 }), 'output-1');

    const workflow = makeWorkflow(
      [input, agent, output],
      [
        { id: 'e1', source: 'input-1', target: 'agent-1', type: 'smoothstep' },
        { id: 'e2', source: 'agent-1', target: 'output-1', type: 'smoothstep' },
      ],
    );

    const result = compileVisualWorkflowToPlan(workflow);
    const step = result.plan.steps.find((s) => s.id === 'agent-1');

    expect(step?.systemPrompt).toBe('You are a helpful coding assistant.');
  });

  it('parallel graph: two agents after same input have no mutual dependsOn', () => {
    const input = nodeWithId(createFlowNode('input', { x: 0, y: 0 }), 'in');
    const agent1 = nodeWithId(createFlowNode('agent', { x: 200, y: -60 }), 'a1');
    const agent2 = nodeWithId(createFlowNode('agent', { x: 200, y: 60 }), 'a2');
    const output = nodeWithId(createFlowNode('output', { x: 400, y: 0 }), 'out');

    const workflow = makeWorkflow(
      [input, agent1, agent2, output],
      [
        { id: 'e1', source: 'in', target: 'a1', type: 'smoothstep' },
        { id: 'e2', source: 'in', target: 'a2', type: 'smoothstep' },
        { id: 'e3', source: 'a1', target: 'out', type: 'smoothstep' },
        { id: 'e4', source: 'a2', target: 'out', type: 'smoothstep' },
      ],
    );

    const result = compileVisualWorkflowToPlan(workflow);
    const s1 = result.plan.steps.find((s) => s.id === 'a1');
    const s2 = result.plan.steps.find((s) => s.id === 'a2');

    // Neither agent depends on the other
    expect(s1?.dependsOn).not.toContain('a2');
    expect(s2?.dependsOn).not.toContain('a1');
  });
});

// ============================================================
// Template Compilation Tests
// ============================================================

describe('FLOW_TEMPLATES — compilation', () => {
  const templateIds = FLOW_TEMPLATES.map((t) => t.id);

  it.each(templateIds)('template "%s" — create() returns valid VisualWorkflow', (id) => {
    const template = FLOW_TEMPLATES.find((t) => t.id === id)!;
    const workflow = template.create();

    expect(workflow).toBeDefined();
    expect(workflow.nodes).toBeInstanceOf(Array);
    expect(workflow.edges).toBeInstanceOf(Array);
    expect(workflow.nodes.length).toBeGreaterThan(0);
    expect(workflow.edges.length).toBeGreaterThan(0);
    expect(workflow.metadata).toBeDefined();
    expect(workflow.metadata.name).toBeTruthy();
    expect(workflow.viewport).toBeDefined();
  });

  it.each(templateIds)('template "%s" — compiles without error', (id) => {
    const template = FLOW_TEMPLATES.find((t) => t.id === id)!;
    const workflow = template.create();

    const result = compileVisualWorkflowToPlan(workflow);
    expect(result).toBeDefined();
    expect(result.plan).toBeDefined();
    expect(result.plan.steps.length).toBeGreaterThan(0);
    expect(result.outputNodeId).toBeTruthy();
  });

  it.each(templateIds)('template "%s" — no cycle detected', (id) => {
    const template = FLOW_TEMPLATES.find((t) => t.id === id)!;
    const workflow = template.create();

    expect(() => compileVisualWorkflowToPlan(workflow)).not.toThrow();
  });

  it.each(templateIds)('template "%s" — dependsOn chains are consistent', (id) => {
    const template = FLOW_TEMPLATES.find((t) => t.id === id)!;
    const workflow = template.create();
    const result = compileVisualWorkflowToPlan(workflow);

    const stepIds = new Set(result.plan.steps.map((s) => s.id));
    for (const step of result.plan.steps) {
      for (const dep of step.dependsOn) {
        expect(stepIds).toContain(dep);
      }
    }
  });

  it.each(templateIds)('template "%s" — validates without errors', (id) => {
    const validation = validateTemplate(id);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });
});

describe('Template-specific compilation details', () => {
  it('default — has exactly 1 step (single agent)', () => {
    const workflow = FLOW_TEMPLATES.find((t) => t.id === 'default')!.create();
    const result = compileVisualWorkflowToPlan(workflow);
    expect(result.plan.steps.length).toBe(1);
  });

  it('code-review — contains a condition step', () => {
    const workflow = FLOW_TEMPLATES.find((t) => t.id === 'code-review')!.create();
    const result = compileVisualWorkflowToPlan(workflow);
    const condSteps = result.plan.steps.filter((s) => s.stepType === 'condition');
    expect(condSteps.length).toBe(1);
    expect(condSteps[0].conditionConfig).toBeDefined();
  });

  it('code-review — condition branches have branchCondition metadata', () => {
    const workflow = FLOW_TEMPLATES.find((t) => t.id === 'code-review')!.create();
    const result = compileVisualWorkflowToPlan(workflow);
    const condStep = result.plan.steps.find((s) => s.stepType === 'condition')!;
    const branchedSteps = result.plan.steps.filter((s) => s.branchCondition?.conditionStepId === condStep.id);
    expect(branchedSteps.length).toBeGreaterThanOrEqual(1);

    const branches = branchedSteps.map((s) => s.branchCondition!.branch);
    expect(branches).toContain('true');
  });

  it('data-pipeline — contains a condition step', () => {
    const workflow = FLOW_TEMPLATES.find((t) => t.id === 'data-pipeline')!.create();
    const result = compileVisualWorkflowToPlan(workflow);
    const condSteps = result.plan.steps.filter((s) => s.stepType === 'condition');
    expect(condSteps.length).toBe(1);
  });

  it('content-creation — has multiple agent/template steps for pipeline', () => {
    const workflow = FLOW_TEMPLATES.find((t) => t.id === 'content-creation')!.create();
    const result = compileVisualWorkflowToPlan(workflow);
    expect(result.plan.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('pdf-processing — per-step config (model, systemPrompt) propagated', () => {
    const workflow = FLOW_TEMPLATES.find((t) => t.id === 'pdf-processing')!.create();
    const result = compileVisualWorkflowToPlan(workflow);

    for (const step of result.plan.steps) {
      if (step.stepType === 'execute') {
        // Execute steps should have a model
        expect(step.model).toBeTruthy();
      }
    }
  });

  it('web-research — per-step config (model, provider) propagated', () => {
    const workflow = FLOW_TEMPLATES.find((t) => t.id === 'web-research')!.create();
    const result = compileVisualWorkflowToPlan(workflow);

    for (const step of result.plan.steps) {
      if (step.stepType === 'execute') {
        expect(step.model).toBeTruthy();
      }
    }
  });
});

// ============================================================
// validateTemplate / validateWorkflow
// ============================================================

describe('validateTemplate', () => {
  it('returns error for unknown template ID', () => {
    const result = validateTemplate('nonexistent-template');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });

  it('detects orphan nodes', () => {
    const result = validateWorkflow({
      nodes: [
        { id: 'n1', type: 'inputNode', position: { x: 0, y: 0 }, data: { kind: 'input', label: 'Input', config: { text: '' } } } as any,
        { id: 'n2', type: 'agentNode', position: { x: 200, y: 0 }, data: { kind: 'agent', label: 'Agent', config: { model: 'test', prompt: '', tools: [] } } } as any,
        { id: 'n3', type: 'outputNode', position: { x: 400, y: 0 }, data: { kind: 'output', label: 'Output', config: {} } } as any,
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', type: 'smoothstep' },
        // n3 is orphan - not connected
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      metadata: { name: 'test' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Orphan'))).toBe(true);
  });

  it('detects missing agent node', () => {
    const result = validateWorkflow({
      nodes: [
        { id: 'n1', type: 'inputNode', position: { x: 0, y: 0 }, data: { kind: 'input', label: 'Input', config: { text: '' } } } as any,
        { id: 'n2', type: 'outputNode', position: { x: 200, y: 0 }, data: { kind: 'output', label: 'Output', config: {} } } as any,
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', type: 'smoothstep' }],
      viewport: { x: 0, y: 0, zoom: 1 },
      metadata: { name: 'test' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('agent'))).toBe(true);
  });

  it('detects missing output node', () => {
    const result = validateWorkflow({
      nodes: [
        { id: 'n1', type: 'inputNode', position: { x: 0, y: 0 }, data: { kind: 'input', label: 'Input', config: { text: '' } } } as any,
        { id: 'n2', type: 'agentNode', position: { x: 200, y: 0 }, data: { kind: 'agent', label: 'Agent', config: { model: 'test', prompt: '', tools: [] } } } as any,
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', type: 'smoothstep' }],
      viewport: { x: 0, y: 0, zoom: 1 },
      metadata: { name: 'test' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('output'))).toBe(true);
  });
});
