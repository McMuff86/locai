"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type IsValidConnection,
  MiniMap,
  ReactFlow,
  type NodeTypes,
  type OnConnectEnd,
  type OnInit,
  type OnMove,
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode } from '@/components/flow/nodes/AgentNode';
import { InputNode } from '@/components/flow/nodes/InputNode';
import { OutputNode } from '@/components/flow/nodes/OutputNode';
import { TemplateNode } from '@/components/flow/nodes/TemplateNode';
import { useToast } from '@/components/ui/use-toast';
import {
  FLOW_WIRE_COLORS,
  decorateFlowEdge,
  getFlowConnectionErrorMessage,
  validateFlowConnection,
} from '@/lib/flow/registry';
import type { FlowEdge, FlowNode, FlowNodeKind } from '@/lib/flow/types';
import { useFlowStore } from '@/stores/flowStore';

const FLOW_NODE_DRAG_MIME = 'application/locai-flow-node';
const FLOW_NODE_KINDS: FlowNodeKind[] = ['input', 'agent', 'template', 'output'];

function hasFlowNodePayload(event: React.DragEvent<HTMLDivElement>): boolean {
  return Array.from(event.dataTransfer.types).includes(FLOW_NODE_DRAG_MIME);
}

function isFlowNodeKind(value: string): value is FlowNodeKind {
  return FLOW_NODE_KINDS.includes(value as FlowNodeKind);
}

interface FlowCanvasProps {
  insertNodeKind?: FlowNodeKind | null;
  onInsertNodeHandled?: () => void;
}

export function FlowCanvas({ insertNodeKind = null, onInsertNodeHandled }: FlowCanvasProps) {
  const { toast } = useToast();
  const nodes = useFlowStore((state) => state.workflow.graph.nodes);
  const edges = useFlowStore((state) => state.workflow.graph.edges);
  const viewport = useFlowStore((state) => state.workflow.graph.viewport);
  const isRunning = useFlowStore((state) => state.isRunning);
  const onNodesChange = useFlowStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange);
  const onConnect = useFlowStore((state) => state.onConnect);
  const selectNode = useFlowStore((state) => state.selectNode);
  const setViewport = useFlowStore((state) => state.setViewport);
  const addNode = useFlowStore((state) => state.addNode);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepthRef = useRef(0);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const reactFlowRef = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const nodeStatusById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.data.runtime?.status ?? 'idle'])),
    [nodes],
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const decoratedEdge = decorateFlowEdge(edge, nodes);
        const sourceStatus = nodeStatusById.get(edge.source) ?? 'idle';
        const targetStatus = nodeStatusById.get(edge.target) ?? 'idle';
        const wireType = decoratedEdge.data?.wireType ?? 'any';
        const baseColor = FLOW_WIRE_COLORS[wireType];
        const hasError = sourceStatus === 'error' || targetStatus === 'error';
        const isActiveFlow =
          isRunning &&
          (sourceStatus === 'running' ||
            targetStatus === 'running' ||
            decoratedEdge.data?.wireType === 'stream');
        const isCompletedFlow =
          sourceStatus === 'success' && (targetStatus === 'success' || targetStatus === 'running');

        return {
          ...decoratedEdge,
          animated: isActiveFlow || decoratedEdge.animated === true,
          style: {
            ...decoratedEdge.style,
            stroke: hasError ? '#f87171' : isActiveFlow ? '#22d3ee' : isCompletedFlow ? '#34d399' : baseColor,
            strokeWidth: isActiveFlow ? 3 : hasError ? 2.6 : decoratedEdge.style?.strokeWidth ?? 2.2,
            strokeDasharray: isActiveFlow ? '8 6' : decoratedEdge.style?.strokeDasharray,
            filter: isActiveFlow ? 'drop-shadow(0 0 6px rgba(34,211,238,0.65))' : undefined,
            opacity: isActiveFlow ? 1 : isCompletedFlow ? 0.9 : 0.65,
          },
        };
      }),
    [edges, isRunning, nodeStatusById, nodes],
  );

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      inputNode: InputNode,
      agentNode: AgentNode,
      templateNode: TemplateNode,
      outputNode: OutputNode,
    }),
    [],
  );

  const handleSelectionChange: OnSelectionChangeFunc = ({ nodes: selectedNodes }) => {
    selectNode(selectedNodes[0]?.id ?? null);
  };

  const handleInit: OnInit<FlowNode, FlowEdge> = useCallback((instance) => {
    reactFlowRef.current = instance;
  }, []);

  const handleMoveEnd: OnMove = (_, currentViewport) => {
    setViewport(currentViewport);
  };

  const isValidConnection: IsValidConnection<FlowEdge> = useCallback(
    (candidate) => {
      const connection = candidate as Connection;
      if (!connection.source || !connection.target) {
        return false;
      }

      return validateFlowConnection(
        {
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? null,
          targetHandle: connection.targetHandle ?? null,
        },
        nodes,
      ).isValid;
    },
    [nodes],
  );

  const handleConnectEnd: OnConnectEnd = useCallback(
    (_event, state) => {
      if (state.isValid !== false || !state.fromNode || !state.toNode) {
        return;
      }

      const validation = validateFlowConnection(
        {
          source: state.fromNode.id,
          target: state.toNode.id,
          sourceHandle: state.fromHandle?.id ?? null,
          targetHandle: state.toHandle?.id ?? null,
        },
        nodes,
      );

      if (!validation.isValid) {
        toast({
          title: 'Inkompatible Verbindung',
          description: getFlowConnectionErrorMessage(validation),
          variant: 'destructive',
        });
      }
    },
    [nodes, toast],
  );

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFlowNodePayload(event)) {
      return;
    }

    dragDepthRef.current += 1;
    setIsDraggingOver(true);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFlowNodePayload(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const addNodeAtViewportCenter = useCallback(
    (kind: FlowNodeKind) => {
      const instance = reactFlowRef.current;
      const bounds = canvasRef.current?.getBoundingClientRect();

      if (!instance || !bounds) {
        addNode(kind);
        return;
      }

      const position = instance.screenToFlowPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      });

      addNode(kind, position);
    },
    [addNode],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      dragDepthRef.current = 0;
      setIsDraggingOver(false);

      if (!hasFlowNodePayload(event)) {
        return;
      }

      event.preventDefault();

      const kind = event.dataTransfer.getData(FLOW_NODE_DRAG_MIME);
      if (!isFlowNodeKind(kind)) {
        return;
      }

      const instance = reactFlowRef.current;
      if (!instance) {
        return;
      }

      const position = instance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(kind, position);
    },
    [addNode],
  );

  useEffect(() => {
    if (!insertNodeKind) {
      return;
    }

    addNodeAtViewportCenter(insertNodeKind);
    onInsertNodeHandled?.();
  }, [addNodeAtViewportCenter, insertNodeKind, onInsertNodeHandled]);

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={handleConnectEnd}
        onInit={handleInit}
        onPaneClick={() => selectNode(null)}
        onSelectionChange={handleSelectionChange}
        onMoveEnd={handleMoveEnd}
        isValidConnection={isValidConnection}
        deleteKeyCode={['Backspace', 'Delete']}
        defaultViewport={viewport}
        className="bg-zinc-950"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#334155" />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>

      {isDraggingOver && (
        <div className="pointer-events-none absolute inset-0 z-10 border-2 border-dashed border-emerald-400/60 bg-emerald-400/10" />
      )}
    </div>
  );
}

export default FlowCanvas;
