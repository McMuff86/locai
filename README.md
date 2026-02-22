# LocAI

Local-first AI workspace built with Next.js and Ollama.

LocAI runs chat, agent workflows, documents (RAG), notes with knowledge graphs, a visual flow builder, an image editor, a gallery, and a web terminal — fully local on your machine.

## Features

| Area | Route | Description |
|---|---|---|
| Chat | `/chat` | Streaming chat with agent mode, tool execution, web search, RAG |
| Flow Builder | `/flow` | Visual drag-and-drop workflow editor with node types, wire typing, run history |
| Documents | `/documents` | File browser + desktop-like file canvas with windowed viewers/editors |
| Notes | `/notes` | Markdown notes with AI actions and semantic search |
| Knowledge Graph | `/notes/graph` | 2D/3D force-directed graph of note connections |
| Gallery | `/gallery` | ComfyUI image gallery with metadata, favorites, lightbox |
| Image Editor | — | Built into file canvas: crop, resize, rotate, draw, shapes, text, filters, AI describe/edit |
| SVG Viewer/Editor | — | Built into file canvas: preview and edit SVG files with syntax highlighting |
| Audio | `/chat` | Generate music (ACE-Step) and text-to-speech (Qwen3-TTS) via agent tools |
| Web Terminal | `/terminal` | xterm.js terminal with full PTY (PowerShell / Bash) |
| Search | `/search` | Global search across documents and notes |
| Settings | `/settings` | Model selection, provider config, preferences |

## LLM Providers

| Provider | Models | Key Required |
|---|---|---|
| **Ollama** (default) | Local models (Llama 3, Mistral, etc.) | No |
| **Anthropic** | Claude Opus, Sonnet, Haiku | Yes |
| **OpenAI** | GPT-4o, GPT-4o-mini, etc. | Yes |
| **OpenRouter** | 100+ models | Yes |

Set API keys in `.env.local`. Ollama is the default — no configuration needed for local-only usage.

## Tech Stack

- **Next.js 15** / React 19 / TypeScript 5
- **Tailwind CSS 4** / Radix UI / Shadcn/UI / Framer Motion
- **Ollama** (local LLM) + Anthropic, OpenAI, OpenRouter
- **@xyflow/react** (flow builder)
- **react-force-graph** + Three.js (knowledge graph)
- **xterm.js** + node-pty (web terminal)
- **Zustand** + IndexedDB (state & persistence)
- **Vitest** (testing)

## Prerequisites

- Node.js 22+
- Ollama installed and running
- At least one chat model:

```bash
ollama pull llama3
ollama pull nomic-embed-text   # for embeddings / RAG
```

- Optional: [ACE-Step 1.5](https://github.com/ace-step/ace-step) for music generation
- Optional: [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) for text-to-speech / voice cloning

## Setup

```bash
git clone https://github.com/McMuff86/locai.git
cd locai
npm install
npm run dev
```

Open: `http://localhost:3000`

## Dev Commands

```bash
npm run dev          # Start dev server
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run test         # Run tests (Vitest)
npm run build        # Production build
npm run preflight    # All checks: lint + typecheck + test + build
```

## Documentation

- Agent instructions: [`AGENTS.md`](AGENTS.md)
- Contributing guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Provider integration: [`docs/PROVIDER-INTEGRATION.md`](docs/PROVIDER-INTEGRATION.md)
- Architecture decisions: [`docs/adr/`](docs/adr/)

## License

MIT. See [`LICENSE`](LICENSE).
