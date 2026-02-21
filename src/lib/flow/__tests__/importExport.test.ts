import { describe, expect, it } from 'vitest';
import {
  exportWorkflowAsJson,
  exportWorkflowAsYaml,
  importWorkflowFromJson,
  importWorkflowFromYaml,
} from '@/lib/flow/importExport';
import { createDefaultVisualWorkflow } from '@/lib/flow/registry';
import type { VisualWorkflow } from '@/lib/flow/types';

function makeMinimalWorkflow(): VisualWorkflow {
  return createDefaultVisualWorkflow();
}

describe('importExport', () => {
  describe('JSON export', () => {
    it('produces valid JSON', () => {
      const workflow = makeMinimalWorkflow();
      const json = exportWorkflowAsJson(workflow);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('roundtrips without data loss', () => {
      const workflow = makeMinimalWorkflow();
      const json = exportWorkflowAsJson(workflow);
      const result = importWorkflowFromJson(json);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.workflow).toBeDefined();
      expect(result.workflow!.nodes.length).toBe(workflow.nodes.length);
      expect(result.workflow!.edges.length).toBe(workflow.edges.length);
      expect(result.workflow!.metadata.name).toBe(workflow.metadata.name);
    });
  });

  describe('YAML export', () => {
    it('produces valid YAML', () => {
      const workflow = makeMinimalWorkflow();
      const yamlStr = exportWorkflowAsYaml(workflow);
      expect(typeof yamlStr).toBe('string');
      expect(yamlStr.length).toBeGreaterThan(0);
    });

    it('roundtrips without data loss', () => {
      const workflow = makeMinimalWorkflow();
      const yamlStr = exportWorkflowAsYaml(workflow);
      const result = importWorkflowFromYaml(yamlStr);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.workflow).toBeDefined();
      expect(result.workflow!.nodes.length).toBe(workflow.nodes.length);
      expect(result.workflow!.edges.length).toBe(workflow.edges.length);
    });
  });

  describe('import validation', () => {
    it('validates required fields', () => {
      const result = importWorkflowFromJson('{}');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects missing nodes array', () => {
      const result = importWorkflowFromJson(
        JSON.stringify({ edges: [], metadata: { name: 'test' } }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('nodes'))).toBe(true);
    });

    it('handles malformed JSON gracefully', () => {
      const result = importWorkflowFromJson('not valid json {{{');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('JSON');
    });

    it('handles malformed YAML gracefully', () => {
      const result = importWorkflowFromYaml(':\n  :\n    : [invalid');
      expect(result.valid).toBe(false);
    });

    it('warns on unknown node kinds', () => {
      const data = {
        nodes: [
          {
            id: 'n1',
            position: { x: 0, y: 0 },
            data: { kind: 'unknown_kind', label: 'Test', config: {} },
          },
        ],
        edges: [],
        metadata: { name: 'test' },
      };
      const result = importWorkflowFromJson(JSON.stringify(data));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('unknown_kind'))).toBe(true);
    });

    it('warns on invalid edge references', () => {
      const data = {
        nodes: [
          {
            id: 'n1',
            position: { x: 0, y: 0 },
            data: { kind: 'input', label: 'Test', config: { text: '' } },
          },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'nonexistent' },
        ],
        metadata: { name: 'test' },
      };
      const result = importWorkflowFromJson(JSON.stringify(data));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('nonexistent'))).toBe(true);
    });
  });
});
