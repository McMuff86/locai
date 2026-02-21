import { describe, expect, it } from 'vitest';
import { FlowCompileError, compileVisualWorkflowToPlan } from '@/lib/flow/engine';
import { createFlowNode } from '@/lib/flow/registry';
import type { FlowEdge, FlowNode, VisualWorkflow } from '@/lib/flow/types';

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
