import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
  type XYPosition,
} from '@xyflow/react';
import { create } from 'zustand';
import { createDefaultStoredWorkflow, createFlowEdgeFromConnection, createFlowNode, createStoredWorkflowFromTemplate, FLOW_TEMPLATES, type FlowTemplateId } from '@/lib/flow/registry';
import type {
  FlowEdge,
  FlowNode,
  FlowNodeKind,
  NodeRuntimeState,
  SavedFlowTemplate,
  StoredWorkflow,
  VisualWorkflow,
  WorkflowRunSummary,
} from '@/lib/flow/types';

interface FlowStoreState {
  workflow: StoredWorkflow;
  selectedNodeId: string | null;
  selectedRunId: string | null;
  isHydrated: boolean;
  isRunning: boolean;
  runError: string | null;
  savedTemplates: SavedFlowTemplate[];
  activeTemplateId: string | null;
  activeTemplateName: string | null;
  setHydrated: (hydrated: boolean) => void;
  loadWorkflow: (workflow: StoredWorkflow) => void;
  loadTemplate: (templateId: FlowTemplateId) => void;
  setSavedTemplates: (templates: SavedFlowTemplate[]) => void;
  setActiveTemplate: (id: string | null, name: string | null) => void;
  loadSavedTemplate: (template: SavedFlowTemplate) => void;
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: FlowEdge[]) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  setViewport: (viewport: Viewport) => void;
  selectNode: (nodeId: string | null) => void;
  addNode: (kind: FlowNodeKind, position?: XYPosition) => void;
  removeNode: (nodeId: string) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
  resetNodeRuntime: () => void;
  clearRunningNodeRuntime: () => void;
  setNodeRuntime: (nodeId: string, patch: Partial<NodeRuntimeState>) => void;
  setOutputResult: (content: string) => void;
  setRunning: (running: boolean) => void;
  setRunError: (error: string | null) => void;
  addRunSummary: (summary: WorkflowRunSummary) => void;
  applyRunSummary: (summary: WorkflowRunSummary) => void;
}

function withUpdatedTimestamp(workflow: StoredWorkflow): StoredWorkflow {
  return {
    ...workflow,
    updatedAt: new Date().toISOString(),
  };
}

export const useFlowStore = create<FlowStoreState>((set) => ({
  workflow: createDefaultStoredWorkflow(),
  selectedNodeId: null,
  selectedRunId: null,
  isHydrated: false,
  isRunning: false,
  runError: null,
  savedTemplates: [],
  activeTemplateId: null,
  activeTemplateName: null,

  setHydrated: (hydrated) => set({ isHydrated: hydrated }),

  loadWorkflow: (workflow) =>
    set({
      workflow,
      selectedNodeId: null,
      selectedRunId: null,
      runError: null,
    }),

  loadTemplate: (templateId) => {
    const template = FLOW_TEMPLATES.find((t) => t.id === templateId);
    return set({
      workflow: createStoredWorkflowFromTemplate(templateId),
      selectedNodeId: null,
      selectedRunId: null,
      runError: null,
      activeTemplateId: null,
      activeTemplateName: template?.name ?? null,
    });
  },

  setSavedTemplates: (templates) => set({ savedTemplates: templates }),

  setActiveTemplate: (id, name) => set({ activeTemplateId: id, activeTemplateName: name }),

  loadSavedTemplate: (template) => {
    const now = new Date().toISOString();
    return set({
      workflow: {
        id: 'current',
        name: template.name,
        description: template.description,
        graph: template.graph,
        runs: [],
        createdAt: now,
        updatedAt: now,
        tags: [],
        isFavorite: false,
      },
      selectedNodeId: null,
      selectedRunId: null,
      runError: null,
      activeTemplateId: template.id,
      activeTemplateName: template.name,
    });
  },

  setNodes: (nodes) =>
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          nodes,
        },
      }),
    })),

  setEdges: (edges) =>
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          edges,
        },
      }),
    })),

  onNodesChange: (changes) =>
    set((state) => {
      const nextNodes = applyNodeChanges(changes, state.workflow.graph.nodes) as FlowNode[];
      const selectedFromGraph = nextNodes.find((node) => node.selected)?.id ?? null;
      const selectedNodeStillExists =
        state.selectedNodeId != null && nextNodes.some((node) => node.id === state.selectedNodeId);

      return {
        selectedNodeId: selectedFromGraph ?? (selectedNodeStillExists ? state.selectedNodeId : null),
        workflow: withUpdatedTimestamp({
          ...state.workflow,
          graph: {
            ...state.workflow.graph,
            nodes: nextNodes,
          },
        }),
      };
    }),

  onEdgesChange: (changes) =>
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          edges: applyEdgeChanges(changes, state.workflow.graph.edges) as FlowEdge[],
        },
      }),
    })),

  onConnect: (connection) =>
    set((state) => {
      const edge = createFlowEdgeFromConnection(connection, state.workflow.graph.nodes);
      if (!edge) {
        return state;
      }

      return {
        workflow: withUpdatedTimestamp({
          ...state.workflow,
          graph: {
            ...state.workflow.graph,
            edges: addEdge(edge, state.workflow.graph.edges) as FlowEdge[],
          },
        }),
      };
    }),

  setViewport: (viewport) =>
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          viewport,
        },
      }),
    })),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  addNode: (kind, position) =>
    set((state) => {
      const offset = state.workflow.graph.nodes.length * 40;
      const node = createFlowNode(kind, position ?? { x: 120 + offset, y: 120 + offset });
      return {
        selectedNodeId: node.id,
        workflow: withUpdatedTimestamp({
          ...state.workflow,
          graph: {
            ...state.workflow.graph,
            nodes: [
              ...state.workflow.graph.nodes.map((existingNode) => ({
                ...existingNode,
                selected: false,
              })),
              {
                ...node,
                selected: true,
              },
            ] as FlowNode[],
          },
        }),
      };
    }),

  removeNode: (nodeId) =>
    set((state) => ({
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          nodes: state.workflow.graph.nodes.filter((node) => node.id !== nodeId),
          edges: state.workflow.graph.edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId,
          ),
        },
      }),
    })),

  updateNodeLabel: (nodeId, label) =>
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          nodes: state.workflow.graph.nodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    label,
                  },
                }
              : node,
          ) as FlowNode[],
        },
      }),
    })),

  updateNodeConfig: (nodeId, patch) =>
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          nodes: state.workflow.graph.nodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    config: {
                      ...node.data.config,
                      ...patch,
                    } as typeof node.data.config,
                  },
                }
              : node,
          ) as FlowNode[],
        },
      }),
    })),

  resetNodeRuntime: () =>
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          nodes: state.workflow.graph.nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              runtime: {
                status: 'idle',
                updatedAt: new Date().toISOString(),
              },
              config:
                node.data.kind === 'output'
                  ? {
                      ...node.data.config,
                      result: '',
                    }
                  : node.data.config,
            },
          })) as FlowNode[],
        },
      }),
      runError: null,
      selectedRunId: null,
    })),

  clearRunningNodeRuntime: () =>
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          nodes: state.workflow.graph.nodes.map((node) => {
            const status = node.data.runtime?.status;
            if (status !== 'running') {
              return node;
            }

            return {
              ...node,
              data: {
                ...node.data,
                runtime: {
                  ...node.data.runtime,
                  status: 'idle',
                  updatedAt: new Date().toISOString(),
                },
              },
            };
          }),
        },
      }),
    })),

  setNodeRuntime: (nodeId, patch) =>
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          nodes: state.workflow.graph.nodes.map((node) => {
            if (node.id !== nodeId) {
              return node;
            }

            const existing = node.data.runtime ?? { status: 'idle' as const };
            return {
              ...node,
              data: {
                ...node.data,
                runtime: {
                  ...existing,
                  ...patch,
                  updatedAt: new Date().toISOString(),
                },
              },
            };
          }),
        },
      }),
    })),

  setOutputResult: (content) =>
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          nodes: state.workflow.graph.nodes.map((node) =>
            node.data.kind === 'output'
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    runtime: {
                      status: 'running',
                      updatedAt: new Date().toISOString(),
                    },
                    config: {
                      ...node.data.config,
                      result: content,
                    },
                  },
                }
              : node,
          ),
        },
      }),
    })),

  setRunning: (running) => set({ isRunning: running }),
  setRunError: (error) => set({ runError: error }),

  addRunSummary: (summary) =>
    set((state) => ({
      selectedRunId: summary.id,
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        runs: [summary, ...state.workflow.runs].slice(0, 30),
      }),
    })),

  applyRunSummary: (summary) =>
    set((state) => ({
      selectedRunId: summary.id,
      runError: summary.error ?? null,
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          nodes: state.workflow.graph.nodes.map((node) => {
            const status = summary.nodeStatuses?.[node.id] ?? 'idle';
            return {
              ...node,
              data: {
                ...node.data,
                runtime: {
                  status,
                  message: status === 'error' ? summary.error : undefined,
                  updatedAt: new Date().toISOString(),
                },
              },
            };
          }) as FlowNode[],
        },
      }),
    })),
}));
