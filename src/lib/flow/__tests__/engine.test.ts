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
});
