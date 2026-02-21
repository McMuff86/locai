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
import { ConditionNode } from '@/components/flow/nodes/ConditionNode';
import { InputNode } from '@/components/flow/nodes/InputNode';
import { LoopNode } from '@/components/flow/nodes/LoopNode';
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
const FLOW_NODE_KINDS: FlowNodeKind[] = ['input', 'agent', 'template', 'output', 'condition', 'loop'];

function hasFlowNodePayload(event: React.DragEvent<HTMLDivElement>): boolean {
  return Array.from(event.dataTransfer.types).includes(FLOW_NODE_DRAG_MIME);
}

function isFlowNodeKind(value: string): value is FlowNodeKind {
  return FLOW_NODE_KINDS.includes(value as FlowNodeKind);
}

function DraggableMiniMap({ parentRef }: { parentRef: React.RefObject<HTMLDivElement | null> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState<{ right: number; bottom: number } | { left: number; top: number }>({
    right: 12,
    bottom: 12,
  });

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('[data-minimap-grip]')) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isDragging.current) return;
      const parent = parentRef.current;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const elWidth = containerRef.current?.offsetWidth ?? 200;
      const elHeight = containerRef.current?.offsetHeight ?? 150;
      const newLeft = moveEvent.clientX - parentRect.left - dragOffset.current.x;
      const newTop = moveEvent.clientY - parentRect.top - dragOffset.current.y;
      setPos({
        left: Math.max(0, Math.min(parentRect.width - elWidth, newLeft)),
        top: Math.max(0, Math.min(parentRect.height - elHeight, newTop)),
      });
    };

    const onPointerUp = () => {
      isDragging.current = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, [parentRef]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      className="absolute z-[5] rounded-lg border border-border/60 bg-zinc-900/90 shadow-lg"
      style={pos}
    >
      <div
        data-minimap-grip
        className="flex cursor-grab items-center justify-center border-b border-border/40 px-2 py-1 active:cursor-grabbing"
      >
        <div className="h-0.5 w-8 rounded-full bg-muted-foreground/40" />
      </div>
      <MiniMap
        pannable
        zoomable
        className="!static !m-0 !rounded-b-lg !rounded-t-none !border-0 !shadow-none"
        style={{ width: 192, height: 128 }}
      />
    </div>
  );
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
      conditionNode: ConditionNode,
      loopNode: LoopNode,
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
        <Controls className="flow-controls" />
        <DraggableMiniMap parentRef={canvasRef} />
      </ReactFlow>

      {isDraggingOver && (
        <div className="pointer-events-none absolute inset-0 z-10 border-2 border-dashed border-emerald-400/60 bg-emerald-400/10" />
      )}
    </div>
  );
}

export default FlowCanvas;
