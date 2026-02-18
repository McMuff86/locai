<![CDATA[<div align="center">

# 🤖 LocAI

**A privacy-first AI chat app that runs entirely on your machine.**

No cloud. No subscriptions. No data leaving your computer.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://typescriptlang.org)
[![Ollama](https://img.shields.io/badge/Powered%20by-Ollama-white)](https://ollama.ai)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

> **LocAI** is a feature-rich local AI application built on top of [Ollama](https://ollama.ai). Chat with any model you have installed, let an agent autonomously use tools, search the web, manage your notes, generate images — all without a single API key or cloud dependency.

---

## 📸 Screenshots

> **TODO:** Screenshots coming soon. PRs welcome!

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **Chat** | Streaming chat with any Ollama model. Markdown, code highlighting, conversation history. |
| 🤖 **Agent Mode** | Autonomous tool-calling agent with 11 built-in tools. Plans, executes, reflects. |
| 📄 **RAG Documents** | Upload PDFs and text files, embed them locally, get context-aware answers. |
| 📁 **File Browser** | Browse your workspace, LocAI data, and Documents directory right in the UI. |
| 🖼️ **Image Gallery** | ComfyUI-backed image generation with metadata, favorites, and lightbox viewer. |
| 📝 **Notes** | Markdown notes with tags, `[[wiki-links]]`, and AI-assisted completion. |
| 🔮 **Knowledge Graph** | 3D interactive visualization of your note network. |
| 🌐 **Web Search** | Privacy-respecting search via your local SearXNG instance. |
| 🖥️ **GPU Monitor** | Real-time NVIDIA GPU stats: VRAM usage, temperature, running processes. |
| 🧠 **Agent Memory** | The agent remembers things across conversations using persistent key-value storage. |
| ⚙️ **Settings** | Configure Ollama host, workspace path, ComfyUI port — all saved locally. |

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 22+ | Required |
| **Ollama** | latest | [Install Ollama](https://ollama.ai) |
| **SearXNG** | any | Optional — for web search |
| **ComfyUI** | any | Optional — for image generation |

You also need at least one Ollama model. For the best Agent Mode experience:

```bash
ollama pull qwen2.5:7b          # Recommended for agent/tool-calling
ollama pull nomic-embed-text    # Required for RAG document search
```

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/McMuff86/locai.git
cd locai

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — that's it. 🎉

No `.env` file needed. All configuration lives in the app's Settings page.

---

## 🛠️ Dev Setup

```bash
npm run dev          # Start dev server (with Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (no emit)
npm run test         # Vitest unit tests
npm run preflight    # lint + typecheck + test + build (run before PR!)
```

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SEARXNG_URL` | — | Your SearXNG instance URL |
| `LOCAI_API_TOKEN` | — | Token-based API auth (for remote access) |
| `LOCAI_ALLOW_REMOTE` | `false` | Allow non-localhost API requests |
| `LOCAL_NOTES_PATH` | `~/.locai/notes/` | Override notes directory |

---

## 🤖 Agent Mode

The agent works like this:

```
Your message → LLM decides what to do → calls tools → sees results → thinks → calls more tools → final answer
```

It runs 100% locally via Ollama's tool-calling API. No external services required.

### Available Tools

| Tool | What it does |
|------|-------------|
| `read_file` | Read files from your workspace |
| `write_file` | Create new files |
| `edit_file` | Find-and-replace in existing files |
| `web_search` | Search via SearXNG or DuckDuckGo |
| `search_documents` | Semantic search in your RAG documents |
| `create_note` | Create a markdown note |
| `save_memory` | Save a key-value pair to persistent memory |
| `recall_memory` | Retrieve from memory |
| `run_command` | Execute shell commands (sandboxed to workspace) |
| `run_code` | Run Python or JavaScript |
| `generate_image` | Queue image generation via ComfyUI |

### Recommended Models for Agent Mode

Models with native tool-calling support work best:
- **Excellent:** `qwen2.5`, `llama3.1`, `command-r`, `mistral-large`
- **Good:** `mistral`, `mixtral`, `llama3`
- **Limited:** `gemma`, `deepseek`, `codellama`

LocAI auto-detects model capabilities and warns you if a model has limited tool support.

---

## 🗂️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [Next.js](https://nextjs.org) | 15 | App Router, API routes, SSR |
| [React](https://react.dev) | 19 | UI framework |
| [TypeScript](https://typescriptlang.org) | 5 | Type safety |
| [Tailwind CSS](https://tailwindcss.com) | 4 | Utility-first styling |
| [Shadcn/UI](https://ui.shadcn.com) + Radix | — | Accessible UI components |
| [Framer Motion](https://framer.com/motion) | 12 | Animations |
| [Ollama](https://ollama.ai) | — | Local LLM inference + embeddings |
| [react-three-fiber](https://docs.pmnd.rs/react-three-fiber) | 9 | 3D Knowledge Graph |
| [Vitest](https://vitest.dev) | 2 | Unit testing |
| react-force-graph-3d | — | Force-directed graph |
| react-markdown + remark-gfm | — | Markdown rendering |
| react-syntax-highlighter | — | Code highlighting |
| pdf-parse | — | PDF document parsing |
| chokidar | — | File watching for gallery |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New conversation |
| `Ctrl+S` | Save conversation |
| `Ctrl+B` | Toggle sidebar |
| `/` | Focus chat input |
| `Escape` | Stop generation / Close dialog |
| `←` `→` | Navigate images in lightbox |
| `F` | Toggle favorite (lightbox) |
| `I` | Toggle image metadata (lightbox) |
| `Delete` | Delete image (lightbox) |

---

## 📂 Data Storage

Everything is stored locally under `~/.locai/`:

```
~/.locai/
├── settings.json       # App settings
├── workspace/          # Agent file workspace
├── conversations/      # Chat history
├── memory/             # Agent persistent memory
├── notes/              # Your markdown notes
└── documents/          # RAG documents + embeddings
```

No database server. No cloud sync. Just files on your disk.

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch conventions, commit format, and the agent workflow system.

---

## 📜 License

MIT — do whatever you want, just keep the notice. See [LICENSE](LICENSE).

---

<div align="center">
  Made with ☕ and too many GPU hours · Built on <a href="https://ollama.ai">Ollama</a>
</div>
]]>