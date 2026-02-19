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
import { createDefaultStoredWorkflow, createFlowEdgeFromConnection, createFlowNode } from '@/lib/flow/registry';
import type {
  FlowEdge,
  FlowNode,
  FlowNodeKind,
  NodeRuntimeState,
  StoredWorkflow,
  WorkflowRunSummary,
} from '@/lib/flow/types';

interface FlowStoreState {
  workflow: StoredWorkflow;
  selectedNodeId: string | null;
  selectedRunId: string | null;
  isHydrated: boolean;
  isRunning: boolean;
  runError: string | null;
  setHydrated: (hydrated: boolean) => void;
  loadWorkflow: (workflow: StoredWorkflow) => void;
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: FlowEdge[]) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  setViewport: (viewport: Viewport) => void;
  selectNode: (nodeId: string | null) => void;
  addNode: (kind: FlowNodeKind, position?: XYPosition) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
  resetNodeRuntime: () => void;
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

  setHydrated: (hydrated) => set({ isHydrated: hydrated }),

  loadWorkflow: (workflow) =>
    set({
      workflow,
      selectedNodeId: null,
      selectedRunId: null,
      runError: null,
    }),

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
    set((state) => ({
      workflow: withUpdatedTimestamp({
        ...state.workflow,
        graph: {
          ...state.workflow.graph,
          nodes: applyNodeChanges(changes, state.workflow.graph.nodes) as FlowNode[],
        },
      }),
    })),

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
            nodes: [...state.workflow.graph.nodes, node],
          },
        }),
      };
    }),

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
                      status: 'success',
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
