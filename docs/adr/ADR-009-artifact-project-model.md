# ADR-009: Artifact Project Model

**Status:** Proposed  
**Date:** 2026-06-17  
**Context:** Genspark-class AI work produces reusable artifacts, not only chat messages. LocAI needs a first-class project/artifact layer before building Docs, Sheets, Slides, Deep Research, or scheduled automation.

---

## Context

Today, LocAI stores and displays several outputs in different places:

- Conversations in chat.
- Documents/RAG sources in document storage.
- Notes in notes storage.
- Workflow templates and history in workflow storage.
- Files through the file browser.
- Images/audio in gallery/audio paths.

This is functional, but not enough for a workspace product. A user should be able to start a task, generate an artifact, edit it, link sources, version it, export it, and reuse it in another flow.

---

## Decision

Introduce a first-class **Project and Artifact model**.

### Storage

Default filesystem layout:

```text
~/.locai/projects/
  index.json
  [projectId]/
    project.json
    artifacts/
      [artifactId]/
        artifact.json
        content.md
        content.json
        preview.png
        exports/
    savepoints/
      [savepointId].json
    sources/
      [sourceId].json
    runs/
      [runId].json
```

The exact content file depends on artifact type. Markdown remains preferred for text-heavy artifacts because it is readable, diffable, and agent-friendly.

### Project

```typescript
interface WorkspaceProject {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  tags: string[];
  artifactIds: string[];
  runIds: string[];
}
```

### Artifact

```typescript
type ArtifactType =
  | 'research_brief'
  | 'document'
  | 'sheet'
  | 'deck'
  | 'report'
  | 'code_app'
  | 'image'
  | 'audio'
  | 'workflow_result'
  | 'file_batch';

interface WorkspaceArtifact {
  id: string;
  projectId: string;
  type: ArtifactType;
  title: string;
  status: 'draft' | 'review' | 'final' | 'archived';
  createdAt: string;
  updatedAt: string;
  contentPath: string;
  sourceRefs: SourceRef[];
  savepointIds: string[];
  runIds: string[];
  exportPaths: string[];
  modelProvenance?: ModelProvenance[];
}
```

### SourceRef

```typescript
interface SourceRef {
  id: string;
  kind: 'web' | 'document' | 'note' | 'memory' | 'file' | 'conversation' | 'workflow_run';
  title: string;
  uri?: string;
  localPath?: string;
  excerpt?: string;
  capturedAt: string;
  reliability?: 'unknown' | 'low' | 'medium' | 'high';
}
```

### Savepoint

Savepoints capture a full artifact state and change reason:

```typescript
interface ArtifactSavepoint {
  id: string;
  artifactId: string;
  createdAt: string;
  createdBy: 'user' | 'agent' | 'workflow';
  reason: string;
  contentHash: string;
  contentSnapshotPath: string;
  sourceRefs: SourceRef[];
}
```

---

## UX Direction

Add a `/workspace` route:

- Project list.
- Artifact list.
- Artifact detail/editor.
- Source/provenance panel.
- Savepoint timeline.
- Export menu.
- Related runs and conversations.

Chat and Flow Builder should be able to:

- Create artifact.
- Append to artifact.
- Edit selected artifact section.
- Convert artifact to another type.
- Use artifact as input for a workflow.

---

## First Artifact Type

The first implementation should be `research_brief`.

Why:

- It exercises source references, provenance, savepoints, model usage, and export.
- It maps directly to Genspark's deep research/productivity use cases.
- It reuses existing web search, RAG, memory, workflow, and provider systems.

Minimum `research_brief` sections:

- Goal
- Plan
- Sources
- Findings
- Analysis
- Risks / assumptions
- Open questions
- Next actions

---

## Consequences

### Positive

- LocAI gains a clear output layer beyond chat.
- Docs, Sheets, Slides, Reports, and Pods can reuse the same lifecycle.
- Provenance and citations become a core platform feature.
- Backup/restore can include meaningful workspace units.

### Negative

- Requires a new domain layer and UI.
- Existing storage areas need linking/migration over time.
- Artifact editing/export will introduce format-specific complexity.

### Follow-Up

- Add `WorkspaceProjectStore` and `WorkspaceArtifactStore`.
- Add API routes under `/api/workspace/projects` and `/api/workspace/artifacts`.
- Add export adapters per artifact type.
- Connect flow history and run ledger to artifacts.

---

## Related

- `docs/adr/ADR-007-local-first-ai-workspace-platform.md`
- `docs/adr/ADR-008-permissioned-tool-connector-gateway.md`
- `docs/goals/2026-06-genspark-class-local-ai-workspace-roadmap.md`
