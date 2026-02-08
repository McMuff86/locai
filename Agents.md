# LocAI - Project Documentation

> Last Updated: 2026-02-08
> Branch: main
> Status: Active Development

---

## Project Overview

**LocAI** is a modern local AI application that runs AI models directly on local hardware using Ollama. The project emphasizes privacy, data control, and cloud-independence. All data is stored locally under `~/.locai/`.

### Key Features
- 💬 **Chat** — Local chat with multiple AI models (streaming, markdown, code highlighting)
- 🤖 **Agent Mode** — Tool-calling agent with 11 built-in tools, presets, and planning
- 📄 **RAG Documents** — Upload, embed, and search documents for context-aware chat
- 📁 **File Browser** — Browse workspace, .locai, and Documents directories
- 🖼️ **Image Gallery** — ComfyUI integration with metadata, favorites, lightbox
- 📝 **Notes System** — Markdown notes with tags, wiki-links, AI completion
- 🔮 **3D Knowledge Graph** — Interactive visualization of note connections
- 🌐 **Web Search** — SearXNG integration with context optimization
- 🖥️ **GPU Monitor** — Real-time NVIDIA GPU stats, VRAM, temperature
- 🎨 **ComfyUI Integration** — Launch, monitor, and image generation
- 🧠 **Agent Memory** — Persistent key-value memory across conversations
- ⚙️ **Settings** — Configurable workspace paths, Ollama host, ComfyUI port

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 15 | App Router, API routes, SSR |
| React 19 | UI framework |
| TypeScript 5 | Type safety |
| Tailwind CSS 4 | Styling |
| Shadcn/UI + Radix | UI components |
| Framer Motion | Animations |
| react-markdown + remark-gfm | Markdown rendering |
| react-syntax-highlighter | Code highlighting |
| Ollama API | Local LLM inference + embeddings |
| date-fns | Date formatting |

---

## Architecture

```
src/
├── app/                              # Next.js App Router
│   ├── (app)/                        # Route group with shared layout
│   │   ├── layout.tsx                # Shared nav sidebar
│   │   ├── chat/page.tsx             # Chat + Agent Mode
│   │   ├── documents/page.tsx        # File Browser + RAG Documents (Tabs)
│   │   ├── gallery/page.tsx          # Image Gallery
│   │   ├── notes/                    # Notes System
│   │   │   ├── page.tsx              # Notes editor
│   │   │   └── graph/page.tsx        # 3D Knowledge Graph
│   │   ├── search/page.tsx           # Web Search
│   │   └── settings/page.tsx         # Application settings
│   ├── api/
│   │   ├── _utils/security.ts        # Path validation, local-only guards
│   │   ├── chat/agent/route.ts       # Agent Mode streaming endpoint
│   │   ├── documents/                # RAG document CRUD + search
│   │   │   ├── route.ts              # GET list, DELETE remove
│   │   │   ├── upload/route.ts       # POST upload + index
│   │   │   ├── search/route.ts       # POST semantic search
│   │   │   └── [id]/route.ts         # GET document details
│   │   ├── filebrowser/              # File Browser API
│   │   │   ├── route.ts              # GET browseable roots
│   │   │   ├── list/route.ts         # GET directory listing
│   │   │   ├── read/route.ts         # GET file content (preview)
│   │   │   ├── download/route.ts     # GET file download
│   │   │   └── delete/route.ts       # DELETE file (workspace only)
│   │   ├── conversations/            # Chat conversation CRUD
│   │   │   ├── route.ts              # GET list, POST create
│   │   │   ├── [id]/route.ts         # GET/PUT/DELETE
│   │   │   └── search/route.ts       # GET full-text search
│   │   ├── memory/                   # Agent persistent memory
│   │   │   ├── route.ts              # GET/POST/DELETE
│   │   │   └── relevant/route.ts     # POST semantic recall
│   │   ├── notes/                    # Notes CRUD + AI + search
│   │   │   ├── route.ts              # CRUD
│   │   │   ├── search/route.ts       # Lexical + semantic search
│   │   │   ├── embed/route.ts        # Build embeddings
│   │   │   ├── ai/route.ts           # AI completion/summarization
│   │   │   └── semantic-links/       # Cosine similarity links
│   │   ├── comfyui/                  # ComfyUI integration
│   │   │   ├── launch/route.ts       # Start ComfyUI
│   │   │   ├── status/route.ts       # Check if running
│   │   │   └── gallery/              # Image management
│   │   ├── ollama/pull/route.ts      # Model download (streaming)
│   │   ├── search/                   # Web search
│   │   │   ├── route.ts              # SearXNG proxy
│   │   │   └── optimize/route.ts     # LLM context optimization
│   │   ├── settings/route.ts         # App settings CRUD
│   │   ├── system-stats/route.ts     # CPU/RAM/VRAM monitoring
│   │   ├── gpu/kill-process/route.ts # Terminate GPU processes
│   │   ├── folder-picker/route.ts    # Native OS folder dialog
│   │   └── migrate/route.ts          # LocalStorage → filesystem migration
│   ├── page.tsx                      # Landing page
│   └── globals.css                   # Theme styles
├── components/
│   ├── chat/                         # Chat components
│   │   ├── ChatContainer.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── ChatSearch.tsx
│   │   ├── ConversationSidebar.tsx
│   │   ├── ConversationStats.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── SetupCard.tsx             # Model selection + templates
│   │   ├── ThinkingProcess.tsx       # DeepSeek <think> rendering
│   │   ├── TokenCounter.tsx
│   │   ├── AgentMessage.tsx          # Agent turn/tool-call rendering
│   │   ├── AgentModeToggle.tsx       # Agent mode UI toggle + presets
│   │   └── ToolCallBlock.tsx         # Individual tool call display
│   ├── documents/                    # RAG document management
│   │   ├── DocumentManager.tsx
│   │   ├── DocumentCard.tsx
│   │   └── DocumentUpload.tsx
│   ├── filebrowser/                  # File Browser
│   │   ├── FileBrowser.tsx           # Main container with root selector
│   │   ├── FileEntryRow.tsx          # File/folder row component
│   │   └── FilePreviewDialog.tsx     # File preview modal
│   ├── gallery/                      # Image Gallery (refactored)
│   │   ├── ImageGallery.tsx
│   │   ├── ImageCard.tsx
│   │   ├── Lightbox.tsx
│   │   ├── MetadataPanel.tsx
│   │   ├── GalleryHeader.tsx
│   │   ├── DeleteConfirmDialog.tsx
│   │   ├── EmptyState.tsx
│   │   └── hooks/                    # Gallery-specific hooks
│   ├── notes/                        # Notes System (refactored)
│   │   ├── NotesList.tsx
│   │   ├── NoteEditor.tsx
│   │   ├── NoteSearch.tsx
│   │   ├── NoteAIActions.tsx
│   │   ├── KnowledgeGraph.tsx        # 3D ForceGraph
│   │   ├── GraphControls.tsx
│   │   ├── GraphTextView.tsx
│   │   └── hooks/                    # Notes-specific hooks
│   ├── ui/                           # Shadcn UI primitives
│   └── ...                           # SystemMonitor, ThemeProvider, etc.
├── hooks/
│   ├── useChat.ts                    # Chat state management
│   ├── useAgentChat.ts               # Agent mode execution
│   ├── useConversations.ts           # Conversation CRUD
│   ├── useDocuments.ts               # RAG document management
│   ├── useFileBrowser.ts             # File browser state
│   ├── useModels.ts                  # Ollama model listing
│   ├── useOllamaStatus.ts            # Connection monitoring
│   ├── useSettings.ts                # App settings
│   ├── useWebSearch.ts               # Web search
│   ├── useKeyboardShortcuts.ts       # Keyboard shortcuts
│   └── useMigration.ts               # LocalStorage migration
├── lib/
│   ├── agents/                       # Agent Mode infrastructure
│   │   ├── executor.ts               # Agent loop: messages → LLM → tools → repeat
│   │   ├── types.ts                  # ToolDefinition, ToolCall, AgentTurn, etc.
│   │   ├── registry.ts               # ToolRegistry: register/execute tools
│   │   ├── presets.ts                # 4 agent presets
│   │   ├── modelCapabilities.ts      # Model compatibility tiers
│   │   ├── textToolParser.ts         # Fallback: extract tool calls from plain text
│   │   ├── paramNormalizer.ts        # Fix common LLM parameter mistakes
│   │   └── tools/                    # 11 built-in tools
│   │       ├── index.ts              # Tool registration
│   │       ├── readFile.ts
│   │       ├── writeFile.ts
│   │       ├── editFile.ts
│   │       ├── webSearch.ts
│   │       ├── searchDocuments.ts
│   │       ├── createNote.ts
│   │       ├── saveMemory.ts
│   │       ├── recallMemory.ts
│   │       ├── runCommand.ts
│   │       ├── runCode.ts
│   │       └── generateImage.ts
│   ├── documents/                    # RAG pipeline
│   │   ├── types.ts                  # Document, IndexStatus
│   │   ├── constants.ts              # Chunk sizes, limits
│   │   ├── store.ts                  # Document CRUD
│   │   ├── chunker.ts                # Text chunking
│   │   ├── embeddings.ts             # Ollama embeddings
│   │   └── search.ts                 # Semantic search
│   ├── filebrowser/                  # File browser utilities
│   │   ├── types.ts                  # FileEntry, BrowseableRoot
│   │   └── scanner.ts               # Directory listing, file read/delete
│   ├── settings/store.ts             # Server-side settings reader
│   ├── memory/                       # Agent persistent memory
│   ├── notes/                        # Notes domain logic
│   ├── webSearch/                    # Web search utilities
│   ├── templates/                    # Model prompt templates
│   ├── ollama.ts                     # Ollama API client
│   ├── storage.ts                    # Conversation storage
│   └── prompt-templates.ts           # 12 prompt templates
└── types/
    ├── chat.ts                       # Chat message types
    └── index.ts
```

---

## Agent Mode

### Overview

Agent Mode enables the LLM to use tools autonomously in a loop: the model receives a message, decides which tool(s) to call, receives results, and repeats until it has a final answer. This runs entirely locally via Ollama's tool-calling API.

**Endpoint:** `POST /api/chat/agent` (streaming)

### Agent Loop

```
User Message → LLM → Tool Calls? → Execute Tools → Results → LLM → ... → Final Answer
```

- Max 8 iterations per message (configurable)
- 2 minute timeout
- Optional planning step before execution
- Temperature 0.3 for deterministic tool calling

### Built-in Tools (11)

| Tool | Category | Description |
|------|----------|-------------|
| `read_file` | files | Read file content (max 50KB, path validation) |
| `write_file` | files | Write/create files in workspace |
| `edit_file` | files | Find-and-replace editing in existing files |
| `web_search` | web | Search via SearXNG/DuckDuckGo |
| `search_documents` | search | Semantic search in RAG documents |
| `create_note` | notes | Create markdown notes |
| `save_memory` | notes | Save key-value to persistent memory |
| `recall_memory` | notes | Retrieve from persistent memory |
| `run_command` | code | Execute shell commands (sandboxed) |
| `run_code` | code | Execute Python/JavaScript (sandboxed) |
| `generate_image` | media | Queue image generation via ComfyUI |

### Agent Presets

| Preset | Icon | Tools | Use Case |
|--------|------|-------|----------|
| Recherche Agent | 🔍 | web_search, search_documents, read_file, save_memory | Web & document research |
| Coding Agent | 💻 | read_file, write_file, run_code, search_documents | Programming assistance |
| Schreib-Agent | ✍️ | web_search, create_note, search_documents, recall_memory | Writing & content creation |
| Wissens-Agent | 🧠 | save_memory, recall_memory, create_note, search_documents, read_file | Knowledge management |

### Model Compatibility

Not all Ollama models support tool-calling. LocAI detects model capabilities automatically:

| Tier | Models | Agent Support |
|------|--------|---------------|
| Excellent | Qwen2.5, Qwen3, Llama3.1+, Command-R, Hermes, Mistral-Large, Nemotron | Full, recommended |
| Good | Mistral, Mixtral, Llama3 | Solid, works well |
| Basic | Gemma, DeepSeek, CodeLlama, Yi | Limited, may hallucinate tool calls |
| None | Phi, TinyLlama, Falcon, Vicuna | Not supported |

### Reliability Features

- **Text Tool Parser** — Fallback parser extracts tool calls from plain text/JSON when model doesn't use structured tool calling
- **Parameter Normalizer** — Automatically maps common LLM parameter mistakes (e.g. `title` → `path` for write_file)
- **Enhanced Error Messages** — Provides schema + actual args on errors so the model can self-correct
- **Few-shot Examples** — System prompt includes examples of correct tool call format

### Workspace

Agent file operations use `~/.locai/workspace/` as the default working directory. This is configurable in Settings.

- Relative paths resolve to workspace
- Absolute paths allowed if within permitted directories
- Path traversal (`..`, `\0`) is rejected
- All file operations validate paths with `validatePath()`

---

## RAG Documents

Upload documents to make them searchable as context in chat.

### Pipeline
1. **Upload** — Supports PDF, TXT, MD, code files (max 20MB)
2. **Chunking** — Splits into chunks (500 chars, 80 overlap)
3. **Embedding** — Local embeddings via `nomic-embed-text` (768 dimensions)
4. **Search** — Cosine similarity with configurable threshold (default 0.3)

### API Routes
| Route | Method | Description |
|-------|--------|-------------|
| `/api/documents` | GET | List all documents |
| `/api/documents` | DELETE | Delete document by `?id=` |
| `/api/documents/upload` | POST | Upload + index (multipart) |
| `/api/documents/search` | POST | Semantic search |
| `/api/documents/[id]` | GET | Document details + chunks |

---

## File Browser

Browse files on disk from the Documents page (tab "Dateibrowser").

### Browseable Roots
| Root | Path | Description |
|------|------|-------------|
| Agent Workspace | `~/.locai/workspace/` | Files created by the agent |
| LocAI Daten | `~/.locai/` | Configuration & data |
| Dokumente | `~/Documents/` | Personal documents |

### Features
- Directory navigation with breadcrumbs
- File preview (Markdown rendered, code highlighted, JSON formatted)
- File download
- File delete (workspace only)

### Security
- Path validation via `validatePath()` on all routes
- `..` and `\0` traversal rejected
- Delete restricted to workspace root
- `assertLocalRequest()` on mutation endpoints

### API Routes
| Route | Method | Description |
|-------|--------|-------------|
| `/api/filebrowser` | GET | List available roots |
| `/api/filebrowser/list` | GET | Directory listing (`?rootId=&path=`) |
| `/api/filebrowser/read` | GET | File content for preview |
| `/api/filebrowser/download` | GET | Download file |
| `/api/filebrowser/delete` | DELETE | Delete file (workspace only) |

---

## Data Storage

All data is stored under `~/.locai/`:

```
~/.locai/
├── settings.json           # Application settings
├── workspace/              # Agent workspace (file operations)
├── conversations/          # Chat conversation files
├── memory/                 # Agent persistent memory
├── notes/                  # Markdown notes
├── documents/              # RAG document metadata
│   ├── metadata/           # Document metadata JSON
│   ├── uploads/            # Original uploaded files
│   └── embeddings/         # Embedding vectors
└── preferences/            # UI preferences (favorites, graph settings)
```

---

## API Routes (Complete)

### Chat & Agent
| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat/agent` | POST | Agent mode streaming endpoint |

### Conversations
| Route | Method | Description |
|-------|--------|-------------|
| `/api/conversations` | GET/POST | List / create conversations |
| `/api/conversations/[id]` | GET/PUT/DELETE | Read / update / delete |
| `/api/conversations/search` | GET | Full-text search |

### Documents (RAG)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/documents` | GET/DELETE | List / delete documents |
| `/api/documents/upload` | POST | Upload + index |
| `/api/documents/search` | POST | Semantic search |
| `/api/documents/[id]` | GET | Document details |

### File Browser
| Route | Method | Description |
|-------|--------|-------------|
| `/api/filebrowser` | GET | Browseable roots |
| `/api/filebrowser/list` | GET | Directory listing |
| `/api/filebrowser/read` | GET | File content preview |
| `/api/filebrowser/download` | GET | File download |
| `/api/filebrowser/delete` | DELETE | Delete (workspace only) |

### Memory
| Route | Method | Description |
|-------|--------|-------------|
| `/api/memory` | GET/POST/DELETE | Agent memory CRUD |
| `/api/memory/relevant` | POST | Semantic memory recall |

### Notes
| Route | Method | Description |
|-------|--------|-------------|
| `/api/notes` | GET/POST/PUT/DELETE | Notes CRUD |
| `/api/notes/search` | GET | Lexical + semantic search |
| `/api/notes/embed` | POST | Build note embeddings |
| `/api/notes/ai` | POST | AI completion/summarization |
| `/api/notes/semantic-links` | GET | Cosine similarity links |

### Search
| Route | Method | Description |
|-------|--------|-------------|
| `/api/search` | GET/POST/PUT | Web search via SearXNG |
| `/api/search/optimize` | POST | LLM context optimization (streaming) |

### System
| Route | Method | Description |
|-------|--------|-------------|
| `/api/system-stats` | GET | CPU/RAM/VRAM stats |
| `/api/gpu/kill-process` | POST | Terminate GPU process |
| `/api/settings` | GET/POST | App settings |
| `/api/folder-picker` | GET | Native folder dialog |
| `/api/migrate` | POST | LocalStorage migration |
| `/api/ollama/pull` | GET/POST | Model list / download (streaming) |

### ComfyUI
| Route | Method | Description |
|-------|--------|-------------|
| `/api/comfyui/status` | GET | ComfyUI running check |
| `/api/comfyui/launch` | POST | Start ComfyUI |
| `/api/comfyui/gallery` | GET | List images |
| `/api/comfyui/gallery/[id]` | GET | Serve image |
| `/api/comfyui/gallery/metadata` | GET | PNG metadata |
| `/api/comfyui/gallery/delete` | DELETE | Delete image |
| `/api/comfyui/gallery/copy-to-input` | POST | Copy to ComfyUI input |

---

## Security

### Path Traversal Protection
- `validatePath(userPath, allowedPrefix)` — ensures resolved path stays within allowed directory
- `sanitizeBasePath(path)` — rejects paths containing `..`
- All file operations (agent tools, file browser, documents) use these checks

### Local-Only Mutations
- `assertLocalRequest(request)` — checks origin/host headers for localhost
- Applied to: file delete, GPU process kill, settings mutations
- Configurable: `LOCAI_API_TOKEN` for token auth, `LOCAI_ALLOW_REMOTE` to bypass

### Agent Sandboxing
- `run_command` — restricted to workspace directory, timeout-limited
- `run_code` — sandboxed Python/JS execution
- `write_file` / `edit_file` — workspace-only with path validation
- `read_file` — 50KB limit, path traversal protection

---

## Model Templates

| Model | Template File | Special Features |
|-------|---------------|------------------|
| Llama 3.x | `llama3.ts` | General purpose |
| Llama 3.2 Vision | `llama3-vision.ts` | Image analysis |
| Mistral | `mistral.ts` | Instruction format |
| Gemma 2 | `gemma.ts` | Google style |
| DeepSeek R1 | `deepseek.ts` | `<think>` reasoning tags |
| Granite Vision | `granite-vision.ts` | IBM format, image analysis |
| Qwen3 Coder | `qwen-coder.ts` | ChatML, code-focused |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New conversation |
| `Ctrl+S` | Save conversation |
| `Ctrl+B` | Toggle sidebar |
| `/` | Focus chat input |
| `Escape` | Stop generation / Close |
| `←` `→` | Navigate lightbox |
| `F` | Toggle favorite (lightbox) |
| `I` | Toggle metadata (lightbox) |
| `Delete` | Delete image (lightbox) |

---

## Changelog

### 2026-02-08
- ✅ **File Browser** — Browse workspace, .locai, and Documents from Documents page
- ✅ **File Preview** — Markdown rendering, syntax highlighting, JSON formatting
- ✅ **File Download/Delete** — Download any file, delete workspace files
- ✅ **Documents Page Tabs** — "Dateibrowser" and "RAG Dokumente" tabs
- ✅ **Agent Tool Reliability** — Text tool parser fallback, parameter normalizer
- ✅ **Agent System Prompt** — Default German system prompt with tool examples
- ✅ **Agent Workspace Path** — Configurable workspace with path validation
- ✅ **write_file & edit_file** — Added to default enabled tools

### 2026-02-07
- ✅ **Agent System Expansion** — Presets, model capability warnings, new tools
- ✅ **run_code Tool** — Sandboxed Python/JavaScript execution
- ✅ **generate_image Tool** — ComfyUI image generation from agent
- ✅ **edit_file Tool** — Find-and-replace file editing
- ✅ **Model Capability Tiers** — Automatic model compatibility detection
- ✅ **Agent Presets** — 4 pre-configured agent profiles
- ✅ **Planning Step** — Optional planning before tool execution

### 2026-02-06
- ✅ **Security Hardening** — Path traversal validation on all API routes
- ✅ **Test Suites** — Agent tools, gallery cache, security utils tests
- ✅ **Gallery File Cache** — Chokidar-based file watcher for gallery
- ✅ **write_file & edit_file Tools** — File creation and editing agent tools
- ✅ **run_command Tool** — Sandboxed shell command execution

### 2026-02-05
- ✅ **Agent Mode** — Full tool-calling infrastructure with executor, registry, and 8 tools
- ✅ **RAG Pipeline** — Document upload, chunking, embedding, and semantic search
- ✅ **RAG Chat Integration** — Document context in chat messages

### 2026-02-04
- ✅ **Persistent Storage** — Migration from LocalStorage to `~/.locai/` filesystem
- ✅ **Settings Auto-Load** — Server-side settings from `~/.locai/settings.json`
- ✅ **Agent Memory** — Persistent key-value memory for agent
- ✅ **Conversation Search** — Full-text search across conversations restored

### 2026-02-03
- ✅ **Landing Page Upgrade** — Animated particle background, logo glow effects

### 2025-12-08
- ✅ Web Search Multi-Select, Context Optimizer, Notes + Web Search
- ✅ Custom AI prompts, Context Window Slider

### 2025-12-07
- ✅ Real routing (Chat/Gallery/Notes), Notes refactoring, Tab navigation
- ✅ Conversation tags, Unified navigation

### 2025-12-06
- ✅ Initial development: Chat, Gallery, Notes, GPU Monitor, Model Pull UI
- ✅ ComfyUI integration, Prompt Templates, Knowledge Graph

### 2025-03-08
- ✅ Initial project structure

---

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build
npm run build

# Lint
npm run lint
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `LOCAI_API_TOKEN` | — | API token for authentication |
| `LOCAI_ALLOW_REMOTE` | `false` | Allow non-localhost requests |
| `LOCAL_NOTES_PATH` | `~/.locai/notes/` | Override notes directory |
| `SEARXNG_URL` | — | SearXNG instance URL for web search |
