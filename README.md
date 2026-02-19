# LocAI

Local AI workspace built with Next.js and Ollama.

LocAI runs chat, agent workflows, documents (RAG), notes, gallery, and file operations fully local on your machine.

## Current Product Areas

| Area | Route | Status |
| --- | --- | --- |
| Chat | `/chat` | Stable |
| Visual Flow Builder | `/flow` | MVP implemented (Phase 1) |
| Documents + File Canvas | `/documents` | Stable |
| Gallery | `/gallery` | Stable |
| Notes + Graph | `/notes` | Stable |

## Flow MVP (Phase 1)

Implemented:

- Node editor route: `/flow`
- Node types: Input, Agent, Template, Output
- Graph compile: Visual graph -> `WorkflowPlan`
- Run integration: existing `POST /api/chat/agent/workflow`
- Local persistence: IndexedDB (`idb`)
- Runtime status: node-level `idle/running/success/error`

Current runtime constraint:

- Execution is linear for MVP (no true control-flow runtime yet).

Specs:

- `docs/adr/ADR-003-locai-flow-mvp.md`
- `docs/task-briefs/M3-flow-mvp.md`

## Tech Stack

- Next.js 15
- React 19
- TypeScript 5
- Tailwind CSS 4
- Ollama
- React Flow (`@xyflow/react`)
- Zustand
- IndexedDB (`idb`)

## Prerequisites

- Node.js 22+
- Ollama installed and running
- At least one chat model, for example:

```bash
ollama pull llama3
ollama pull nomic-embed-text
```

## Local Setup

```bash
git clone https://github.com/McMuff86/locai.git
cd locai
npm install
npm run dev
```

Open: `http://localhost:3000`

## Dev Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run preflight
```

## Documentation Index

- Project handoff state: `CONTEXT-HANDOFF.md`
- Contributing guide: `CONTRIBUTING.md`
- Workflow engine ADR: `docs/adr/ADR-001-workflow-engine.md`
- Flow MVP ADR: `docs/adr/ADR-003-locai-flow-mvp.md`
- Flow MVP task brief: `docs/task-briefs/M3-flow-mvp.md`

## Known Note (tests on Windows)

Some existing `run_command` tests use Unix commands (`ls`, `cat`, `sleep`) and can fail on Windows shells. This is a pre-existing issue outside the Flow MVP changes.

## License

MIT. See `LICENSE`.

