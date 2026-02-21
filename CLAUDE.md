# AGENTS.md — LocAI

> Primary instruction file for AI coding agents (Claude Code, Copilot, etc.).
> `CLAUDE.md` is a symlink to this file.

---

## Project Overview

**LocAI** is a local-first AI workspace built with Next.js 15 and Ollama. It runs chat, agent workflows, documents (RAG), notes with knowledge graphs, a visual flow builder, an image gallery, a file canvas, an image editor, and a web terminal — all fully local on your machine.

Repository: `https://github.com/McMuff86/locai.git`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15, React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, Radix UI, Shadcn/UI, Framer Motion |
| State | Zustand (flowStore), React hooks, IndexedDB (`idb`) |
| LLM (local) | Ollama |
| LLM (cloud) | Anthropic, OpenAI, OpenRouter |
| Flow Builder | @xyflow/react |
| Knowledge Graph | react-force-graph-2d / 3d, Three.js |
| Terminal | xterm.js + node-pty (WebSocket) |
| Documents | pdf-parse, custom RAG pipeline |
| Testing | Vitest |
| Dev Server | Custom `server.ts` (HTTP + WebSocket) via `tsx watch` |

---

## App Routes

| Route | Purpose |
|---|---|
| `/chat` | Main chat with agent mode, workflows, RAG, web search |
| `/flow` | Visual flow builder — drag-and-drop node editor |
| `/documents` | File browser + file canvas (desktop-like windows) + RAG |
| `/notes` | Notes editor with AI actions |
| `/notes/graph` | 2D/3D knowledge graph visualization |
| `/gallery` | ComfyUI image gallery |
| `/search` | Global search across documents and notes |
| `/settings` | Application settings |
| `/terminal` | Web terminal (xterm.js + node-pty) |

---

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── (app)/            # Main app routes (chat, flow, documents, notes, gallery, etc.)
│   └── api/              # API routes (~60 endpoints)
│       ├── chat/agent/   # Agent execution + workflow engine
│       ├── documents/    # Document CRUD + RAG search
│       ├── filebrowser/  # File system operations
│       ├── notes/        # Notes CRUD + embeddings + semantic links
│       ├── comfyui/      # ComfyUI gallery integration
│       ├── image-editor/ # AI describe + AI edit
│       ├── models/       # Model listing across providers
│       ├── search/       # Global search
│       ├── memory/       # Conversation memory
│       └── ...
├── components/           # React components (feature-grouped)
│   ├── chat/             # Chat UI, messages, agent mode, tool calls
│   ├── flow/             # Flow builder canvas, nodes, config panel
│   ├── filebrowser/      # File browser, file canvas, image editor
│   ├── notes/            # Notes editor, knowledge graph, graph controls
│   ├── gallery/          # Image gallery, lightbox, metadata
│   ├── terminal/         # Terminal instance (xterm.js)
│   ├── documents/        # Document manager, upload, search
│   └── ui/               # Shadcn/Radix base components
├── hooks/                # Custom React hooks (useChat, useAgentChat, useFileBrowser, etc.)
├── stores/               # Zustand stores (flowStore.ts)
├── lib/                  # Business logic
│   ├── agents/           # Agent executor, workflow engine, tool registry
│   │   └── tools/        # Agent tools (readFile, writeFile, runCode, webSearch, etc.)
│   ├── providers/        # LLM provider factory (Ollama, Anthropic, OpenAI, OpenRouter)
│   ├── documents/        # RAG pipeline (chunker, parser, store, search)
│   ├── notes/            # Note embeddings, semantic search
│   ├── flow/             # Flow compiler, engine, types
│   ├── filebrowser/      # File system scanner
│   ├── webSearch/        # DuckDuckGo + SearXNG integration
│   ├── memory/           # Conversation memory store
│   ├── templates/        # Model-specific prompt templates
│   └── ...
└── types/                # Shared TypeScript types
```

---

## Key Architecture Decisions

- **Custom server** (`server.ts`): HTTP server wrapping Next.js + WebSocket server for terminal PTY on `/ws/terminal`. Graceful shutdown on SIGINT/SIGTERM/SIGHUP.
- **Provider-agnostic LLM**: All chat/agent/workflow code uses a `ChatProvider` interface. Provider is selected per-request. Ollama is the default.
- **IndexedDB for persistence**: Conversations, documents, notes, flow templates stored client-side via `idb`.
- **Flow compiler**: Visual graph → `WorkflowPlan` → executed by existing workflow engine. Linear execution for now.
- **File canvas**: Desktop-like windowed file viewer with drag, resize, zoom-to-cursor. Pure CSS transforms (no library).
- **Server Components by default**: Only `"use client"` where browser APIs or state are needed.

---

## Conventions

### Branches

```
<type>/<short-description>
```

Types: `feat/`, `fix/`, `refactor/`, `test/`, `docs/`, `ui/`, `chore/`

### Commits

```
<type>(<scope>): <short description>
```

Examples: `feat(flow): add cycle detection`, `fix(chat): prevent duplicate messages`

### Code Style

- TypeScript strict mode — no `@ts-ignore` without explanation
- Tailwind utility classes — no custom CSS unless necessary
- `interface` for object shapes, `type` for unions
- Components < 300 lines — split if larger
- Security: `validatePath()` for all file ops, `assertLocalRequest()` for mutations

### Dev Commands

```bash
npm run dev          # Start dev server (tsx watch server.ts)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
npm run build        # Production build
npm run preflight    # lint + typecheck + test + build (all must pass)
```

---

## LLM Providers

| Provider | Env Variable | Default |
|---|---|---|
| Ollama | — (local, no key needed) | Yes |
| Anthropic | `ANTHROPIC_API_KEY` | No |
| OpenAI | `OPENAI_API_KEY` | No |
| OpenRouter | `OPENROUTER_API_KEY` | No |

Provider is selected per-request via `"provider": "anthropic"` etc. in API calls. Keys are read server-side only (`src/lib/providers/server.ts`).

---

## Important Files

| File | Purpose |
|---|---|
| `server.ts` | Custom HTTP + WebSocket server |
| `src/lib/agents/executor.ts` | Agent execution pipeline |
| `src/lib/agents/workflow.ts` | Workflow engine |
| `src/lib/providers/server.ts` | Server-side provider factory |
| `src/stores/flowStore.ts` | Zustand store for flow builder |
| `src/lib/documents/rag.ts` | RAG query and retrieval |
| `src/lib/notes/embeddings.ts` | Note embedding generation |
| `src/lib/flow/engine.ts` | Flow graph compiler |
| `src/server/terminal-handler.ts` | Terminal PTY attachment |

---

## Do's and Don'ts

**Do:**
- Read existing code before modifying
- Run `npm run preflight` before committing
- Use existing Shadcn/UI components from `src/components/ui/`
- Keep API keys server-side only
- Use `validatePath()` for file operations

**Don't:**
- Don't use `any` without justification
- Don't add `"use client"` to Server Components unnecessarily
- Don't hardcode API keys or secrets
- Don't skip TypeScript strict checks
- Don't force-push to `main`
