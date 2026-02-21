# M3 - LocAI Flow MVP

> Date: 2026-02-19  
> Source of truth: `docs/adr/ADR-003-locai-flow-mvp.md`

## Build Scope

1. Add `/flow` route with a node-based editor.
2. Add four node types: Input, Agent, Template, Output.
3. Compile visual graph to `WorkflowPlan`.
4. Run compiled plan via existing workflow endpoint using `initialPlan`.
5. Visualize runtime status per node.
6. Persist current workflow to IndexedDB.

## Out of Scope

1. If/Else, Loop, Parallel runtime semantics.
2. Compound nodes and template marketplace.
3. Chat-to-Flow automatic conversion.
4. Ghost nodes and dynamic planning UI.

## Next Execution Pack

- `docs/task-briefs/M3-T1-flow-next-execution-pack.md`
- Status: completed on 2026-02-19

## Implementation Checklist

- [x] Install dependencies: `@xyflow/react`, `zustand`, `idb`
- [x] Add `lib/flow` (types, compiler, serialization, registry)
- [x] Add `stores/flowStore.ts`
- [x] Add UI components in `components/flow/*`
- [x] Add route `src/app/(app)/flow/page.tsx`
- [x] Extend workflow API request with `initialPlan`
- [x] Wire execution stream -> node runtime updates
- [x] Add sidebar navigation item for `/flow`
- [x] Update `CONTEXT-HANDOFF.md`
