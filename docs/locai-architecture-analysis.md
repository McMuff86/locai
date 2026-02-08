# LocAI — Umfassende Architektur-Analyse & Automatisierungsplan

> **Erstellt:** 2026-02-08  
> **Analysierte Codebase:** `~/projects/locai` (Commit `4b294e7`)  
> **Gesamt-LOC:** ~31.910 (181 Source-Dateien)  
> **Analyst:** Research-Subagent (OpenClaw/Sentinel)

---

## Inhaltsverzeichnis

1. [Projekt-Übersicht](#1-projekt-übersicht)
2. [Architektur-Analyse](#2-architektur-analyse)
3. [Feature-Inventar & Status](#3-feature-inventar--status)
4. [Tech Stack Details](#4-tech-stack-details)
5. [API Routes](#5-api-routes)
6. [Hooks & State Management](#6-hooks--state-management)
7. [Datenspeicherung](#7-datenspeicherung)
8. [Agent Mode — Deep Dive](#8-agent-mode--deep-dive)
9. [OpenClaw-Vergleich & Multi-Agent Konzept](#9-openclaw-vergleich--multi-agent-konzept)
10. [Technische Schulden & Schwächen](#10-technische-schulden--schwächen)
11. [Feature-Roadmap (Priorisiert)](#11-feature-roadmap-priorisiert)
12. [Automatisierungs-Möglichkeiten](#12-automatisierungs-möglichkeiten)
13. [Lines of Code — Detailliert](#13-lines-of-code--detailliert)
14. [Appendix: Schlüssel-Dateien Referenz](#14-appendix-schlüssel-dateien-referenz)

---

## 1. Projekt-Übersicht

**LocAI** ist eine lokale KI-Chat-Anwendung, die AI-Modelle direkt auf eigener Hardware via Ollama betreibt. Kein Cloud-Dienst, volle Datenkontrolle.

### Kernphilosophie
- **Privacy First** — Keine Telemetrie, kein Cloud-Upload
- **Local First** — Ollama als LLM-Backend, lokale Embeddings, Filesystem-Storage
- **Modular** — Clean Component-Architektur, gut refactored (Gallery: 992→11 Files, Notes: 2278→12 Files)

### Quick Facts

| Metrik | Wert |
|--------|------|
| Gesamte Source-Dateien | 181 (.ts/.tsx) |
| Lines of Code | ~31.910 |
| API Routes | 22+ Endpoints |
| Custom Hooks | 12 |
| UI Components | ~60+ |
| Test-Dateien | 3 (sehr wenig) |
| CI/CD | ✅ GitHub Actions |
| Models unterstützt | 60+ (via Ollama) |

---

## 2. Architektur-Analyse

### 2.1 Projekt-Struktur

```
locai/
├── .github/workflows/ci.yml    # CI Pipeline
├── docs/                       # Feature-Pläne, Architektur-Docs
├── searxng/config/             # SearXNG Docker-Config
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/              # Route Group (shared Layout)
│   │   │   ├── chat/           # Chat-Seite (726 LOC)
│   │   │   ├── gallery/        # ComfyUI Gallery
│   │   │   ├── notes/          # Notes + Graph
│   │   │   │   └── graph/      # 3D Knowledge Graph
│   │   │   ├── search/         # Web Search (513 LOC)
│   │   │   ├── settings/       # Einstellungen (984 LOC!)
│   │   │   └── documents/      # Document Manager (RAG)
│   │   ├── api/                # 22+ API Routes
│   │   │   ├── chat/agent/     # Agent Mode API
│   │   │   ├── comfyui/        # ComfyUI Integration (6 Routes)
│   │   │   ├── documents/      # RAG CRUD (4 Routes)
│   │   │   ├── notes/          # Notes CRUD (5 Routes)
│   │   │   ├── search/         # Web Search (2 Routes)
│   │   │   ├── gpu/            # GPU Kill Process
│   │   │   ├── ollama/         # Model Pull
│   │   │   ├── system-stats/   # System Monitoring
│   │   │   ├── settings/       # App Settings
│   │   │   └── _utils/         # Shared Security Utils
│   │   ├── page.tsx            # Landing Page
│   │   └── globals.css         # Grok-Style Dark Theme
│   ├── components/
│   │   ├── chat/               # Chat Components (14 Dateien)
│   │   │   └── sidebar/        # Conversation Sidebar (4 Dateien)
│   │   ├── documents/          # RAG Document Manager (4 Dateien)
│   │   ├── gallery/            # Image Gallery (refactored, 9 Dateien)
│   │   │   └── hooks/          # Gallery-spezifische Hooks
│   │   ├── notes/              # Notes System (refactored, 12 Dateien)
│   │   │   └── hooks/          # Notes-spezifische Hooks
│   │   ├── ui/                 # Shadcn UI Base Components
│   │   ├── shared/             # Cross-Feature Components (TagInput)
│   │   └── *.tsx               # Standalone Widgets (GPU, ComfyUI, etc.)
│   ├── hooks/                  # Global Custom Hooks (12 Dateien)
│   ├── lib/
│   │   ├── agents/             # Agent Mode Infrastructure
│   │   │   └── tools/          # Built-in Tools (4 Tools)
│   │   ├── documents/          # RAG Pipeline (6 Dateien, 1479 LOC)
│   │   ├── notes/              # Notes Domain (8 Dateien, 726 LOC)
│   │   ├── templates/          # Model-spezifische Prompts (7 Dateien)
│   │   ├── webSearch/          # Web Search Engine (7 Dateien, 1165 LOC)
│   │   ├── ollama.ts           # Ollama API Client (757 LOC)
│   │   ├── storage.ts          # localStorage Persistence (524 LOC)
│   │   ├── prompt-templates.ts # 12 Prompt Templates (390 LOC)
│   │   └── utils.ts            # Utility Functions
│   └── types/                  # TypeScript Type Definitions
├── docker-compose.yml          # SearXNG Container
├── package.json                # Dependencies & Scripts
├── vitest.config.ts            # Test Configuration
└── tsconfig.json               # TypeScript Configuration
```

### 2.2 Architektur-Pattern

| Pattern | Verwendung | Bewertung |
|---------|-----------|-----------|
| **Next.js App Router** | Routing, SSR, API Routes | ✅ Modern, korrekt eingesetzt |
| **Route Groups** | `(app)/` für shared Layout | ✅ Clean Separation |
| **Custom Hooks** | State Management pro Feature | ✅ Gut strukturiert |
| **Domain-Driven Folders** | `lib/documents/`, `lib/notes/`, `lib/agents/` | ✅ Klare Boundaries |
| **Component Colocation** | Gallery/Notes haben eigene hooks/ | ✅ Gut |
| **Barrel Exports** | `index.ts` in den meisten Modulen | ✅ Konsistent |
| **NDJSON Streaming** | Agent API → Client | ✅ Guter Pattern für Progress |
| **AsyncGenerator** | Agent Executor Loop | ✅ Elegant, streambar |

### 2.3 Architektur-Diagramm (Vereinfacht)

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  ┌──────┐  ┌────────┐  ┌───────┐  ┌────────┐  ┌─────┐ │
│  │ Chat │  │ Notes  │  │Gallery│  │ Search │  │Docs │ │
│  └──┬───┘  └───┬────┘  └───┬───┘  └───┬────┘  └──┬──┘ │
│     │          │            │          │           │     │
│  ┌──▼──────────▼────────────▼──────────▼───────────▼──┐ │
│  │              Custom React Hooks                     │ │
│  │  useChat  useAgentChat  useNotes  useDocuments     │ │
│  │  useModels  useSettings  useWebSearch  ...          │ │
│  └──┬──────────┬────────────┬──────────┬───────────┬──┘ │
└─────┼──────────┼────────────┼──────────┼───────────┼────┘
      │          │            │          │           │
┌─────▼──────────▼────────────▼──────────▼───────────▼────┐
│                  Next.js API Routes                      │
│  /api/chat/agent  /api/notes/*  /api/documents/*        │
│  /api/search/*    /api/comfyui/*  /api/system-stats     │
└─────┬──────────┬────────────┬──────────┬────────────────┘
      │          │            │          │
      ▼          ▼            ▼          ▼
┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
│ Ollama   │ │Filesys.│ │ SearXNG/ │ │ComfyUI   │
│ (LLM +   │ │(Notes, │ │ DuckDuck │ │(Images)  │
│ Embeddings│ │ Docs)  │ │ Go      │ │          │
└──────────┘ └────────┘ └──────────┘ └──────────┘
```

---

## 3. Feature-Inventar & Status

### 3.1 Vollständig implementierte Features

| # | Feature | Komponenten | LOC (ca.) | Qualität |
|---|---------|-------------|-----------|----------|
| 1 | **Chat mit Ollama** | ChatContainer, ChatInput, ChatMessage, useChat | ~1500 | ✅ Solid |
| 2 | **Streaming Responses** | sendStreamingChatMessage, StreamChunk | ~200 | ✅ Gut |
| 3 | **Vision Models** | Image Processing, auto-detect | ~300 | ✅ Gut |
| 4 | **Conversation Management** | useConversations, ConversationSidebar | ~800 | ✅ Gut |
| 5 | **Chat Search** | ChatSearch, Full-text | ~226 | ✅ Gut |
| 6 | **Token Counter** | TokenCounter, Context Window | ~107 | ✅ Gut |
| 7 | **Dark/Light Theme** | ThemeProvider, globals.css | ~150 | ✅ Gut |
| 8 | **Model Pull UI** | ModelPullDialog (60+ Models) | ~635 | ✅ Umfangreich |
| 9 | **Prompt Templates** | 12 Templates in 5 Kategorien | ~390 | ✅ Gut |
| 10 | **ComfyUI Integration** | Launch, Status, Gallery | ~1200 | ✅ Gut |
| 11 | **Image Gallery** | Refactored (Grid, Lightbox, Metadata, Favorites) | ~900 | ✅ Gut refactored |
| 12 | **Notes System** | Editor, Tags, Wiki-Links, AI Completion | ~1600 | ✅ Gut refactored |
| 13 | **3D Knowledge Graph** | Force-directed, Three.js, Themes | ~1500 | ✅ Beeindruckend |
| 14 | **Semantic Embeddings** | nomic-embed-text via Ollama | ~400 | ✅ Funktional |
| 15 | **Web Search** | SearXNG + DuckDuckGo Fallback | ~1165 | ✅ Robust |
| 16 | **GPU Monitor** | nvidia-smi, VRAM, Temp, Process Kill | ~850 | ✅ Gut |
| 17 | **System Monitor** | CPU, RAM, VRAM, Active Models | ~740 | ✅ Gut |
| 18 | **RAG Document Chat** | Upload, Parse, Chunk, Embed, Search | ~1600 | ✅ Vollständig |
| 19 | **Agent Mode** | Tool-Calling, Registry, Executor, 4 Tools | ~1300 | ✅ Funktional |
| 20 | **Settings Page** | Ollama Host, SearXNG, ComfyUI, Paths | ~984 | ✅ Umfangreich |
| 21 | **Keyboard Shortcuts** | Ctrl+N/S/B, /, Escape | ~70 | ✅ Standard |
| 22 | **Error Boundaries** | Global + Client Error Catching | ~150 | ✅ Gut |
| 23 | **Security Middleware** | Local-only, Token Auth, Path Traversal | ~200 | ✅ Grundlegend |
| 24 | **Conversation Tags** | Tagging, Filtering, Color-Coding | ~300 | ✅ Gut |

### 3.2 Teilweise implementiert / WIP

| Feature | Status | Details |
|---------|--------|---------|
| DOCX Upload | ⚠️ Stub | Wirft "kommt bald" Error |
| Supabase Integration | ⚠️ Config vorhanden | Nur `supabase/config.toml`, keine Nutzung |
| Unified Search | 🟡 Geplant | Cross-Chat + Notes Search |
| Chat Export | 🟡 Geplant | Markdown/JSON/PDF Format |

### 3.3 Nicht implementiert (dokumentiert als geplant)

- Multi-Model Chat (verschiedene Modelle in einem Chat)
- Voice Input (Whisper)
- ComfyUI Workflow Editor
- Docker Support für LocAI selbst
- PWA / Offline Support
- i18n

---

## 4. Tech Stack Details

### 4.1 Kern-Frameworks

| Technologie | Version | Zweck |
|-------------|---------|-------|
| **Next.js** | ^15.5.7 | Full-Stack Framework (App Router) |
| **React** | ^19.0.0 | UI Library |
| **TypeScript** | ^5 | Type Safety |
| **Tailwind CSS** | ^4 | Styling (PostCSS Plugin) |
| **Ollama** | External | LLM + Embeddings Backend |

### 4.2 UI Libraries

| Library | Version | Zweck |
|---------|---------|-------|
| Shadcn/UI | (Radix-based) | Basis-Komponenten (Dialog, Dropdown, Tabs, etc.) |
| @radix-ui/* | Diverse | Primitives für Shadcn |
| lucide-react | ^0.479.0 | Icons |
| framer-motion | ^12.4.10 | Animationen |
| react-markdown | ^10.1.0 | Markdown Rendering |
| react-syntax-highlighter | ^16.1.0 | Code Highlighting |
| remark-gfm | ^4.0.1 | GitHub Flavored Markdown |
| rehype-raw | ^7.0.0 | Raw HTML in Markdown |

### 4.3 Data / Visualization

| Library | Version | Zweck |
|---------|---------|-------|
| react-force-graph-2d | ^1.29.1 | 2D Knowledge Graph |
| react-force-graph-3d | ^1.29.0 | 3D Knowledge Graph |
| three | ^0.164.1 | 3D Rendering (für Graph) |
| date-fns | ^4.1.0 | Date Formatting |

### 4.4 Backend / Processing

| Library | Version | Zweck |
|---------|---------|-------|
| pdf-parse | ^2.4.5 | PDF Text Extraction |
| uuid | ^11.1.0 | Unique IDs |

### 4.5 Dev Dependencies

| Library | Version | Zweck |
|---------|---------|-------|
| vitest | ^2.1.9 | Test Runner |
| eslint | ^9.17.0 | Linting |
| eslint-config-next | ^15.5.7 | Next.js ESLint Rules |
| supabase | ^2.15.8 | Supabase CLI (unused) |
| @tailwindcss/postcss | ^4 | PostCSS Plugin |

### 4.6 Build & Dev Scripts

```json
{
  "dev": "next dev --turbopack",        // Dev mit Turbopack
  "build": "next build",                // Prod Build
  "lint": "next lint",                   // ESLint
  "typecheck": "tsc --noEmit",          // TypeScript Check
  "test": "vitest run",                  // Unit Tests
  "preflight": "npm run lint && npm run typecheck && npm run test && npm run build"
}
```

---

## 5. API Routes

### 5.1 Vollständige Route-Tabelle

| Route | Method | Beschreibung | Security | LOC |
|-------|--------|-------------|----------|-----|
| `/api/chat/agent` | POST | Agent Mode (NDJSON Streaming) | Middleware | ~70 |
| `/api/comfyui/gallery` | GET | Bilder auflisten | Middleware | ~80 |
| `/api/comfyui/gallery/[id]` | GET | Einzelnes Bild servieren | Middleware | ~50 |
| `/api/comfyui/gallery/metadata` | GET | PNG Metadaten extrahieren | Middleware | ~276 |
| `/api/comfyui/gallery/delete` | DELETE | Bild löschen | Middleware | ~40 |
| `/api/comfyui/gallery/copy-to-input` | POST | Bild zu ComfyUI Input kopieren | Middleware | ~50 |
| `/api/comfyui/launch` | POST | ComfyUI starten | Middleware | ~60 |
| `/api/comfyui/status` | GET | ComfyUI Status prüfen | Middleware | ~30 |
| `/api/documents` | GET | Alle Dokumente auflisten | Middleware | ~40 |
| `/api/documents/[id]` | DELETE | Dokument löschen | Middleware | ~40 |
| `/api/documents/search` | POST | Semantische Suche | Middleware | ~50 |
| `/api/documents/upload` | POST | Datei hochladen + indexieren | Middleware | ~100 |
| `/api/folder-picker` | GET | OS Folder Dialog | Middleware | ~30 |
| `/api/gpu/kill-process` | POST | GPU Prozess beenden | Middleware + assertLocal | ~50 |
| `/api/notes` | GET/POST/DELETE | Notes CRUD | Middleware | ~100 |
| `/api/notes/ai` | POST | AI Completion/Summary | Middleware | ~80 |
| `/api/notes/embed` | POST | Embeddings erstellen | Middleware | ~50 |
| `/api/notes/embed-test` | GET | Embedding Test | Middleware | ~30 |
| `/api/notes/search` | POST | Notes Suche (lexical+semantic) | Middleware | ~60 |
| `/api/notes/semantic-links` | GET | Semantic Links zwischen Notes | Middleware | ~50 |
| `/api/ollama/pull` | GET/POST | Models auflisten/herunterladen | Middleware | ~100 |
| `/api/search` | GET/POST/PUT | Web Search (SearXNG/DuckDuckGo) | Middleware | ~100 |
| `/api/search/optimize` | POST | LLM-basierte Kontext-Optimierung | Middleware | ~80 |
| `/api/settings` | GET/POST | App-Einstellungen | Middleware | ~60 |
| `/api/system-stats` | GET | CPU, RAM, VRAM, Models | Middleware | ~286 |

### 5.2 Sicherheitsarchitektur

Die API-Sicherheit besteht aus zwei Schichten:

1. **Next.js Middleware** (`src/middleware.ts`): Schützt ALLE `/api/*` Routes
   - Local-only Enforcement (Origin/Host Header Check)
   - Token-based Auth (`LOCAI_API_TOKEN`)
   - Remote-Bypass (`LOCAI_ALLOW_REMOTE`)

2. **Utility Functions** (`src/app/api/_utils/security.ts`):
   - `assertLocalRequest()` — für zusätzliche Route-Level Checks
   - `sanitizeBasePath()` — Path Traversal Prevention
   - `validatePath()` — Prefix-based Path Validation

---

## 6. Hooks & State Management

### 6.1 Global Hooks (`src/hooks/`)

| Hook | LOC | Zuständigkeit | State Location |
|------|-----|--------------|----------------|
| `useChat` | 296 | Chat-Nachrichten senden (Streaming + Non-Streaming), RAG-Integration | React State |
| `useAgentChat` | 359 | Agent Mode (NDJSON Stream Parsing, Tool Tracking) | React State |
| `useConversations` | 278 | Conversation CRUD, Import/Export, Auto-Save | localStorage |
| `useModels` | ~108 | Model List, Selection, Vision Detection | Ollama API |
| `useSettings` | 310 | App-Einstellungen (Ollama Host, Paths, etc.) | localStorage |
| `useDocuments` | ~180 | Document RAG Lifecycle, Upload, Search | API + React |
| `useWebSearch` | 361 | Web Search Integration, Content Fetching | React State |
| `useOllamaStatus` | ~50 | Connection Monitoring | Polling |
| `useKeyboardShortcuts` | 70 | Global Shortcuts | Event Listeners |

### 6.2 Feature-spezifische Hooks

| Hook | Modul | Zuständigkeit |
|------|-------|--------------|
| `useGalleryImages` | gallery | Bilder laden + Polling |
| `useFavorites` | gallery | Favoriten (localStorage) |
| `useImageMetadata` | gallery | PNG Metadata Extraction |
| `useImageActions` | gallery | Delete, Copy, Download |
| `useNotes` | notes | Notes CRUD |
| `useNoteSearch` | notes | Debounced Search |
| `useGraph` | notes | Graph Data + Embeddings |

### 6.3 State Management Pattern

LocAI verwendet **kein** globales State Management (kein Redux, Zustand, Jotai). State wird über:
- **Custom Hooks** — Feature-gebundener React State
- **localStorage** — Persistenz für Conversations, Settings, Favorites
- **URL State** — Conversation Loading via `?load=<id>`
- **React Context** — Notes Context Provider (shared state zwischen Notes/Graph Pages)
- **API Polling** — Documents (5s), System Stats

**Bewertung:** Für die aktuelle Größe angemessen. Bei Wachstum sollte ein leichtgewichtiges Global State (Zustand) evaluiert werden.

---

## 7. Datenspeicherung

### 7.1 Speicher-Übersicht

| Daten | Speicherort | Format | Persistence |
|-------|-------------|--------|-------------|
| Conversations | `localStorage` | JSON Array | Browser-gebunden |
| App Settings | `localStorage` | JSON Object | Browser-gebunden |
| Gallery Favorites | `localStorage` | JSON Array | Browser-gebunden |
| Notes | Filesystem (`~/.locai/notes/` oder Custom) | Markdown Files | Persistent |
| Note Embeddings | Filesystem | JSONL | Persistent |
| Documents | Filesystem (`~/.locai/documents/`) | Raw Files + JSON | Persistent |
| Document Metadata | Filesystem | `documents.json` | Persistent |
| Document Embeddings | Filesystem | `document-embeddings.jsonl` | Persistent |
| ComfyUI Images | Filesystem (ComfyUI Output Dir) | PNG/JPG | Persistent |
| LLM Models | Ollama | Model Files | Persistent |

### 7.2 localStorage-Nutzung (Client-Side)

```typescript
// Conversations — Haupt-Storage
"locai-conversations"    // Array<Conversation> mit Messages

// Settings
"locai-settings"         // { ollamaHost, comfyUIPath, searxngUrl, ... }

// Gallery
"locai-gallery-favorites" // string[] (Image IDs)

// Misc
"locai-graph-settings"   // Graph UI Settings
```

**Bekannte Probleme mit localStorage:**
- **Quota Limit:** ~5-10MB je nach Browser. Große Bild-Conversations können überlaufen.
- **Mitigation:** Quota-Fallback implementiert — bei Overflow werden Bilder durch Platzhalter ersetzt.
- **Risiko:** Datenverlust bei Browser-Reset, kein Cross-Device Sync.

### 7.3 Filesystem-Nutzung (Server-Side)

```
~/.locai/
├── documents/
│   ├── documents.json              # Document Metadata
│   ├── document-embeddings.jsonl    # Embedding Vectors
│   └── uploads/                    # Raw Uploaded Files
│       └── <doc-id>/
│           └── original-filename.pdf
└── notes/                          # (wenn LOCAL_NOTES_PATH nicht gesetzt)
    ├── note-title.md               # Note Files
    └── embeddings.jsonl            # Note Embeddings
```

### 7.4 Embedding-Storage Design

Beide Embedding-Stores (Notes + Documents) verwenden JSONL:

```jsonl
{"id":"doc123#0","documentId":"doc123","chunk":"Text chunk...","embedding":[0.012,-0.034,...],"model":"nomic-embed-text","createdAt":"2026-02-08T10:00:05Z"}
```

**Skalierungsgrenzen:**
- Gut bis ~10.000 Chunks (alles in-memory geladen für Search)
- Bei >10k: SQLite + sqlite-vss als geplanter Upgrade-Pfad
- Embedding Model: `nomic-embed-text` (768 Dimensionen, ~270MB VRAM)

---

## 8. Agent Mode — Deep Dive

### 8.1 Architektur

Der Agent Mode implementiert ein klassisches **ReAct-Pattern** (Reason + Act):

```
User Message
    ↓
┌─────────────────────────────────┐
│      Agent Executor Loop        │
│  (AsyncGenerator, max 8 Iter.)  │
│                                 │
│  LLM (with tools) ───────────┐ │
│       ↓                       │ │
│  tool_calls? ─── yes ─────── │ │
│       ↓ no                   │ │
│  Final Answer              Execute Tools
│                               │ │
│                     Feed Results Back
│                               │ │
│                     ◄─────────┘ │
└─────────────────────────────────┘
    ↓
NDJSON Stream → Client
```

### 8.2 Tool Registry

```typescript
class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  
  register(tool: RegisteredTool): void;
  list(enabledNames?: string[]): OllamaTool[];
  execute(call: ToolCall, signal?: AbortSignal): Promise<ToolResult>;
}
```

**Registrierte Built-in Tools:**

| Tool Name | Kategorie | Beschreibung | LOC |
|-----------|-----------|-------------|-----|
| `search_documents` | search | RAG Semantic Search über indexierte Dokumente | 105 |
| `web_search` | web | SearXNG/DuckDuckGo Web Search | 105 |
| `read_file` | files | Dateien lesen (mit Security Sandbox) | 160 |
| `create_note` | notes | Neue Note im LocAI Notes System erstellen | 108 |

### 8.3 Agent Executor Flow

```typescript
// Vereinfachter Ablauf
async function* executeAgentLoop(params) {
  for (let i = 0; i < maxIterations; i++) {
    // 1. LLM aufrufen (non-streaming, mit Tools)
    const response = await sendAgentChatMessage(model, messages, tools);
    
    // 2. Keine tool_calls → Final Answer
    if (!response.tool_calls?.length) {
      yield { assistantMessage: response.content };
      return;
    }
    
    // 3. Tools ausführen
    for (const call of toolCalls) {
      const result = await registry.execute(call);
      messages.push({ role: 'tool', content: result.content });
    }
    
    // 4. Turn yielden (für Streaming)
    yield { toolCalls, toolResults };
  }
  
  // 5. Max iterations reached → Force final answer
  yield { assistantMessage: finalResponse.content };
}
```

### 8.4 NDJSON Streaming Protocol

```
→ Client sendet POST /api/chat/agent
← Server streamt NDJSON Events:

{"type":"turn_start","turn":0}
{"type":"tool_call","turn":0,"call":{"id":"tc_1","name":"web_search","arguments":{"query":"..."}}}
{"type":"tool_result","turn":0,"result":{"callId":"tc_1","content":"...","success":true}}
{"type":"turn_end","turn":0}
{"type":"turn_start","turn":1}
...
{"type":"message","content":"Die Antwort ist...","done":true}
```

### 8.5 Was der Agent Mode kann

- ✅ 4 Built-in Tools (Docs Search, Web Search, File Read, Note Create)
- ✅ Multi-Turn Tool Calling (bis 8 Iterationen)
- ✅ Real-time Progress Streaming (NDJSON)
- ✅ Tool Enable/Disable via UI (Toggle + Rechtsklick Popover)
- ✅ Abort/Cancel Support
- ✅ Error Handling pro Tool
- ✅ Visual Tool Call Blocks (collapsible, with result preview)
- ✅ Tool Registry Pattern (einfach erweiterbar)

### 8.6 Was dem Agent Mode fehlt

| Fehlendes Feature | Priorität | Vergleich OpenClaw |
|-------------------|-----------|-------------------|
| **Code Execution** (Shell/Sandbox) | 🔴 Hoch | OpenClaw hat `exec` Tool |
| **File Write/Edit** | 🔴 Hoch | OpenClaw hat `write`/`edit` Tools |
| **Multi-Agent Orchestration** | 🟡 Mittel | OpenClaw hat Sub-Agents |
| **Persistent Agent Sessions** | 🟡 Mittel | OpenClaw hat Session Continuity |
| **Browser Automation** | 🟡 Mittel | OpenClaw hat `browser` Tool |
| **Streaming Tool Results** | 🟢 Niedrig | Tools sind aktuell non-streaming |
| **Tool Chaining / Planning** | 🟡 Mittel | Kein explizites Planning |
| **Memory / Context Management** | 🟡 Mittel | Kein persistenter Agent-Kontext |
| **Parallel Tool Execution** | 🟢 Niedrig | Tools werden sequentiell ausgeführt |

---

## 9. OpenClaw-Vergleich & Multi-Agent Konzept

### 9.1 OpenClaw vs LocAI Agent — Feature Matrix

| Capability | OpenClaw | LocAI Agent |
|------------|----------|-------------|
| **LLM Chat** | ✅ (Claude, diverse Models) | ✅ (Ollama, 60+ Models) |
| **Tool Calling** | ✅ (13+ Tools) | ✅ (4 Tools) |
| **Code Execution** | ✅ (`exec` mit Shell) | ❌ |
| **File Read** | ✅ (`Read`) | ✅ (`read_file`, sandboxed) |
| **File Write/Edit** | ✅ (`Write`, `Edit`) | ❌ |
| **Web Search** | ✅ (`web_search`) | ✅ (`web_search`) |
| **Web Fetch** | ✅ (`web_fetch`) | ❌ |
| **Browser Automation** | ✅ (`browser`) | ❌ |
| **Image Analysis** | ✅ (`image`) | ✅ (Vision Models) |
| **TTS** | ✅ (`tts`) | ❌ |
| **Messaging** | ✅ (`message`, Discord/Telegram) | ❌ |
| **Device Control** | ✅ (`nodes`, Camera, Screen) | ❌ |
| **Sub-Agents** | ✅ (Multi-Agent Orchestration) | ❌ |
| **Persistent Memory** | ✅ (MEMORY.md, daily logs) | ❌ (nur localStorage) |
| **Canvas / UI Rendering** | ✅ (`canvas`) | ❌ |
| **RAG / Document Chat** | ❌ (nicht built-in) | ✅ (Vollständig) |
| **Knowledge Graph** | ❌ | ✅ (3D Visualization) |
| **GPU Monitoring** | ❌ | ✅ |
| **ComfyUI Integration** | ❌ | ✅ |
| **Notes System** | ❌ (nutzt Files) | ✅ (Full Editor) |
| **Local/Private** | ❌ (Cloud API) | ✅ (100% lokal) |

### 9.2 Was LocAI von OpenClaw übernehmen könnte

#### Phase 1: Grundlegende Tools (Quick)
1. **`write_file` Tool** — Dateien erstellen/überschreiben
2. **`edit_file` Tool** — Chirurgische Edits (find & replace)
3. **`list_directory` Tool** — Verzeichnisse durchsuchen
4. **`run_command` Tool** — Shell-Befehle ausführen (sandboxed)

#### Phase 2: Agent Intelligence (Medium)
5. **Planning Tool** — Agent kann Aufgaben in Schritte zerlegen
6. **Memory Tool** — Persistenter Kontext über Sessions hinweg
7. **Web Fetch Tool** — URL-Inhalte extrahieren (Markdown)

#### Phase 3: Multi-Agent (Large)
8. **Sub-Agent Spawning** — Spezialisierte Unter-Agents
9. **Agent Orchestrator** — Koordination mehrerer Agents
10. **Persistent Sessions** — Agent-State über Restarts hinweg

### 9.3 Multi-Agent System — Konzeptplan für LocAI

```
┌──────────────────────────────────────────────────────┐
│                  ORCHESTRATOR AGENT                   │
│  (Versteht die Aufgabe, plant, delegiert, reviewed)  │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Code Agent  │  │Research Agent│  │ Review Agent │  │
│  │ write_file  │  │ web_search   │  │ read_file    │  │
│  │ edit_file   │  │ web_fetch    │  │ search_docs  │  │
│  │ run_command │  │ search_docs  │  │ create_note  │  │
│  │ read_file   │  │ create_note  │  │              │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐                    │
│  │Planning Agent│  │  QA Agent   │                    │
│  │ create_note  │  │ run_command │                    │
│  │ search_docs  │  │ read_file   │                    │
│  │ web_search   │  │ web_search  │                    │
│  └─────────────┘  └─────────────┘                    │
└──────────────────────────────────────────────────────┘
```

**Implementierungsvorschlag:**

```typescript
// src/lib/agents/orchestrator.ts

interface AgentProfile {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];  // Erlaubte Tool-Namen
  model?: string;   // Kann ein anderes Model nutzen
}

const AGENT_PROFILES: Record<string, AgentProfile> = {
  code: {
    name: 'Code Agent',
    description: 'Schreibt und editiert Code',
    systemPrompt: 'Du bist ein erfahrener Entwickler...',
    tools: ['write_file', 'edit_file', 'read_file', 'run_command'],
    model: 'qwen3-coder',
  },
  research: {
    name: 'Research Agent',
    description: 'Recherchiert und fasst zusammen',
    systemPrompt: 'Du bist ein Research-Spezialist...',
    tools: ['web_search', 'web_fetch', 'search_documents', 'create_note'],
  },
  review: {
    name: 'Review Agent',
    description: 'Prüft Code und Ergebnisse',
    systemPrompt: 'Du bist ein Code Reviewer...',
    tools: ['read_file', 'search_documents'],
  },
};

// Orchestrator entscheidet anhand der User-Nachricht, welche Agents spawnen
async function* orchestrate(userMessage: string) {
  // 1. Planning: Was muss getan werden?
  const plan = await planTasks(userMessage);
  
  // 2. Delegation: Welcher Agent macht was?
  for (const task of plan.tasks) {
    const agent = selectAgent(task);
    yield* executeAgentLoop({ ...params, profile: agent });
  }
  
  // 3. Review: Alles korrekt?
  yield* executeAgentLoop({ ...params, profile: AGENT_PROFILES.review });
}
```

---

## 10. Technische Schulden & Schwächen

### 10.1 Kritische Probleme

| # | Problem | Schwere | Aufwand | Details |
|---|---------|---------|---------|---------|
| 1 | **Nur 3 Test-Dateien** (108 LOC Tests) | 🔴 | 8-12h | Nur `parser.test.ts`, `embeddings.test.ts`, `resultSelector.test.ts`. 0% API Route Coverage |
| 2 | **localStorage für Conversations** | 🔴 | 6-8h | ~5-10MB Limit, Datenverlust bei Browser-Reset, kein Sync |
| 3 | **Settings Page 984 LOC** | 🟡 | 3h | Größte Einzelkomponente, should be split |
| 4 | **Kein globaler Error Response Standard** | 🟡 | 2h | API Routes antworten inkonsistent |
| 5 | **Sequential Embedding Generation** | 🟡 | 1h | Chunks werden einzeln embedded, keine Parallelität |

### 10.2 TODOs / FIXMEs im Code

Überraschend wenig explizite TODOs im Code — nur 1 WARNING-Kommentar gefunden:
- `src/app/api/gpu/kill-process/route.ts:13` — "WARNING: This is a powerful operation"

### 10.3 Code Smell Inventory

| Smell | Ort | Beschreibung |
|-------|-----|-------------|
| God Component | `settings/page.tsx` (984 LOC) | Zu viele Concerns in einer Datei |
| Duplicated Host Resolution | Mehrere Orte | Ollama Host wird 4+ mal anders aufgelöst |
| Unused Dependency | `supabase` in devDeps | Installiert aber nie genutzt |
| Gallery FS Scan | `/api/comfyui/gallery` | Jeder Request scannt Filesystem rekursiv |
| Console Logging | Diverse | Production-Code mit verbose Logging |
| Hardcoded Strings | UI Components | Alle Strings auf Deutsch, keine i18n |

### 10.4 Dokumentation Stand

| Dokument | Status | Aktualität |
|----------|--------|-----------|
| `README.MD` | ✅ Gut | Aktuell |
| `Agents.md` | ✅ Sehr umfangreich | Leicht veraltet (Dec 2025 als "current") |
| `docs/rag-architecture.md` | ✅ Exzellent | Aktuell |
| `docs/rag-api.md` | ✅ Gut | Aktuell |
| `docs/improvement-tasks.md` | ✅ Exzellent | Feb 2026 |
| `docs/milestones/M1.md` | ✅ Gut | Abgeschlossen |
| `folder_structure.md` | ⚠️ Veraltet | Stimmt nicht mehr mit aktuellem Stand überein |

---

## 11. Feature-Roadmap (Priorisiert)

### 11.1 Quick Wins (1-2h Aufwand)

| # | Feature | Aufwand | Impact | Details |
|---|---------|---------|--------|---------|
| 1 | **`write_file` Tool** | 1.5h | 🔴 Hoch | Analog zu `createNote`, aber für beliebige Dateien (sandboxed) |
| 2 | **`edit_file` Tool** | 1.5h | 🔴 Hoch | Find & Replace in Dateien (wie OpenClaw's `Edit`) |
| 3 | **`list_directory` Tool** | 1h | 🟡 Mittel | Directory Listing (read_file kann schon Dirs, aber explizites Tool) |
| 4 | **API Error Response Standardisierung** | 1h | 🟡 Mittel | `apiError()` / `apiSuccess()` Utility |
| 5 | **Settings Page Split** | 2h | 🟡 Mittel | In 4-5 Sub-Komponenten aufteilen |
| 6 | **Embedding Parallelisierung** | 1h | 🟡 Mittel | `Promise.allSettled` mit Concurrency 3-5 |
| 7 | **Agent Tool: web_fetch** | 1.5h | 🟡 Mittel | URL → Markdown Content Extraction |
| 8 | **Console.log Cleanup** | 1h | 🟢 Niedrig | Logger-Utility mit Levels |
| 9 | **Supabase devDep entfernen** | 5min | 🟢 Niedrig | Ungenutzt, verkleinert install |

### 11.2 Medium Features (1 Nacht / 4-8h)

| # | Feature | Aufwand | Impact | Details |
|---|---------|---------|--------|---------|
| 1 | **`run_command` Tool** (Sandboxed Shell) | 4h | 🔴 Hoch | Shell Execution mit Whitelist, Timeout, Output Capture |
| 2 | **Conversation Storage Migration** | 6h | 🔴 Hoch | localStorage → Filesystem (JSONL), Server-Side API |
| 3 | **Agent Memory / Persistent Context** | 4h | 🟡 Mittel | Agent kann Kontext über Sessions speichern |
| 4 | **Test Coverage: API Routes** | 6h | 🟡 Mittel | Vitest + Mocks für kritische Routes |
| 5 | **Test Coverage: Hooks** | 4h | 🟡 Mittel | React Testing Library für useChat, useConversations |
| 6 | **Chat Export** (MD/JSON/PDF) | 4h | 🟡 Mittel | Export einzelner oder aller Conversations |
| 7 | **Unified Search** | 5h | 🟡 Mittel | Cross-Chat + Notes + Documents Search |
| 8 | **Agent Planning Mode** | 5h | 🟡 Mittel | Agent kann mehrstufige Pläne erstellen und abarbeiten |
| 9 | **Gallery File Watcher** | 3h | 🟡 Mittel | In-Memory Cache + fs.watch statt FS-Scan pro Request |

### 11.3 Large Features (Mehrere Nächte / 16-40h)

| # | Feature | Aufwand | Impact | Details |
|---|---------|---------|--------|---------|
| 1 | **Multi-Agent System** | 20h | 🔴 Hoch | Orchestrator + spezialisierte Agents (s. Konzept oben) |
| 2 | **SQLite + Vector Search** | 16h | 🔴 Hoch | Skalierbare Alternative zu JSONL Embeddings |
| 3 | **Docker Deployment** | 8h | 🟡 Mittel | Dockerfile + docker-compose (LocAI + SearXNG + Ollama) |
| 4 | **Voice Input/Output** | 12h | 🟡 Mittel | Whisper STT + TTS Integration |
| 5 | **ComfyUI Workflow Editor** | 20h | 🟡 Mittel | Drag & Drop Workflow Creation in LocAI |
| 6 | **MCP (Model Context Protocol)** | 12h | 🟡 Mittel | Standard-Interface für externe Tools |

### 11.4 Langfristige Vision

```
LocAI v2.0 Vision
├── Multi-Agent Orchestration (OpenClaw-like)
│   ├── Spezialisierte Agents (Code, Research, Review, Planning)
│   ├── Agent-zu-Agent Kommunikation
│   ├── Persistent Agent Sessions
│   └── Automatische Feature-Planung
├── Skalierbare Datenschicht
│   ├── SQLite + sqlite-vss für Embeddings
│   ├── Conversations in DB statt localStorage
│   └── Full-Text Search Index
├── Extended Tool Ecosystem
│   ├── Shell Execution (sandboxed)
│   ├── Browser Automation (Playwright)
│   ├── Email Integration
│   └── Calendar Integration
├── Developer Experience
│   ├── Plugin System für custom Tools
│   ├── Webhook Endpoints
│   └── REST API für externe Integration
└── Deployment
    ├── Docker One-Click Setup
    ├── PWA / Offline Support
    └── Multi-User Support
```

---

## 12. Automatisierungs-Möglichkeiten

### 12.1 Aktueller CI/CD Stand

**GitHub Actions Pipeline** (`.github/workflows/ci.yml`):
```yaml
# Trigger: push + pull_request (alle Branches)
Jobs:
  1. npm ci          # Install Dependencies
  2. npm run lint    # ESLint
  3. npm run typecheck  # TypeScript
  4. npm run test    # Vitest (3 Test Files)
  5. npm run build   # Next.js Build
```

**Bewertung:** ✅ Grundlegend vorhanden, aber:
- Nur 3 Test-Dateien (108 LOC)
- Kein Coverage-Reporting
- Keine Deployment-Pipeline
- Keine Security Scanning
- Keine Performance Tests

### 12.2 Empfohlene CI/CD Erweiterungen

#### Sofort (1-2h)

```yaml
# .github/workflows/ci.yml — Erweitert

jobs:
  ci:
    steps:
      # ... existing steps ...
      
      # NEU: Coverage Report
      - name: Test with Coverage
        run: npm run test -- --coverage
      
      # NEU: Upload Coverage
      - name: Upload Coverage
        uses: codecov/codecov-action@v4
        
  security:
    runs-on: ubuntu-latest
    steps:
      # NEU: Dependency Audit
      - name: Security Audit
        run: npm audit --production
      
      # NEU: License Check
      - name: License Check
        run: npx license-checker --production --failOn "GPL"
```

#### Mittelfristig (4-8h)

| Automation | Tool | Beschreibung |
|-----------|------|-------------|
| **Dependency Updates** | Renovate Bot | Automatische PRs für Updates |
| **Code Coverage Gate** | Codecov | Min. 60% Coverage als PR-Gate |
| **Bundle Size Check** | @next/bundle-analyzer | Bundle Size in PRs anzeigen |
| **Lighthouse CI** | lighthouse-ci | Performance-Metriken pro PR |
| **Preview Deployments** | Vercel / Cloudflare | PR-Preview URLs |
| **E2E Tests** | Playwright | Kritische User Flows testen |

#### Langfristig

| Automation | Beschreibung |
|-----------|-------------|
| **Automatic Release** | semantic-release für Versioning |
| **Changelog Generation** | conventional-commits + auto-changelog |
| **Stale Issue Cleanup** | stale-bot für Issues/PRs |
| **Performance Monitoring** | Sentry / LogRocket Integration |

### 12.3 Automatische Code-Reviews

```yaml
# .github/workflows/code-review.yml
name: AI Code Review
on: pull_request

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: AI Review
        uses: coderabbitai/openai-pr-reviewer@latest
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Alternativ: LocAI's eigener Agent Mode könnte (mit Erweiterungen) als Self-Review Tool dienen:
1. Git Diff als Input
2. `read_file` für geänderte Dateien
3. Review-Agent analysiert Patterns, Security, Tests
4. Ergebnis als PR-Kommentar

### 12.4 Test-Strategie Empfehlung

```
Test-Pyramide für LocAI:

     /\
    /  \       E2E Tests (Playwright)
   / 5% \     Critical Flows: Chat, Upload, Agent
  /______\
  /      \     Integration Tests
 /  15%   \    API Routes, Hook + Component
/_________ \
/           \  Unit Tests
/    80%     \ Pure Functions, Utils, Tools
/____________ \
```

**Prioritäten für Tests:**

1. **Sofort:** Agent Tools (pure functions, einfach testbar)
2. **Sofort:** `lib/documents/chunker.ts`, `lib/documents/parser.ts`
3. **Bald:** API Routes (`/api/documents/*`, `/api/chat/agent`)
4. **Bald:** Hooks (`useConversations`, `useChat`)
5. **Später:** E2E (Chat Flow, Document Upload, Agent Mode)

---

## 13. Lines of Code — Detailliert

### 13.1 LOC nach Bereich

| Bereich | Dateien | LOC | % |
|---------|---------|-----|---|
| **App Pages** | 10 | ~4.200 | 13% |
| **API Routes** | 22+ | ~2.400 | 8% |
| **Chat Components** | 18 | ~3.500 | 11% |
| **Gallery Components** | 9 | ~900 | 3% |
| **Notes Components** | 12 | ~2.800 | 9% |
| **Document Components** | 4 | ~600 | 2% |
| **UI Components** | 14 | ~1.500 | 5% |
| **Standalone Widgets** | 8 | ~2.500 | 8% |
| **Global Hooks** | 12 | ~2.400 | 8% |
| **lib/ollama.ts** | 1 | 757 | 2% |
| **lib/storage.ts** | 1 | 524 | 2% |
| **lib/documents/** | 7 | 1.479 | 5% |
| **lib/notes/** | 8 | 726 | 2% |
| **lib/agents/** | 7 | 739 | 2% |
| **lib/webSearch/** | 7 | 1.165 | 4% |
| **lib/templates/** | 8 | ~800 | 3% |
| **Types** | 4 | ~400 | 1% |
| **Config/CSS/Other** | ~20 | ~3.000 | 9% |
| **Tests** | 3 | 158 | <1% |
| **TOTAL** | **181** | **~31.910** | **100%** |

### 13.2 Top 20 größte Dateien

| Rang | Datei | LOC | Bewertung |
|------|-------|-----|-----------|
| 1 | `settings/page.tsx` | 984 | ⚠️ Sollte gesplittet werden |
| 2 | `WebSearchButton.tsx` | 761 | ⚠️ Könnte modularisiert werden |
| 3 | `ollama.ts` | 757 | ✅ Utility, akzeptabel |
| 4 | `chat/page.tsx` | 726 | ✅ Hauptseite, akzeptabel |
| 5 | `ModelPullDialog.tsx` | 635 | ✅ Feature-komplett |
| 6 | `SetupCard.tsx` | 605 | ⚠️ Etwas groß |
| 7 | `GraphControls.tsx` | 590 | ✅ Akzeptabel |
| 8 | `KnowledgeGraph.tsx` | 545 | ✅ Akzeptabel |
| 9 | `storage.ts` | 524 | ✅ Akzeptabel |
| 10 | `search/page.tsx` | 513 | ✅ Akzeptabel |
| 11 | `ConversationSidebar.tsx` | 498 | ⚠️ Sollte gesplittet werden |
| 12 | `KnowledgeGraph2D.tsx` | 459 | ✅ Akzeptabel |
| 13 | `NoteAIActions.tsx` | 458 | ✅ Akzeptabel |
| 14 | `GpuMonitorWidget.tsx` | 457 | ✅ Akzeptabel |
| 15 | `SystemMonitor.tsx` | 456 | ✅ Akzeptabel |
| 16 | `prompt-templates.ts` | 390 | ✅ Daten-Datei |
| 17 | `notes/page.tsx` | 389 | ✅ Akzeptabel |
| 18 | `GpuMonitorDialog.tsx` | 385 | ✅ Akzeptabel |
| 19 | `ChatHeader.tsx` | 383 | ✅ Akzeptabel |
| 20 | `documents/store.ts` | 377 | ✅ Akzeptabel |

---

## 14. Appendix: Schlüssel-Dateien Referenz

### 14.1 Einstiegspunkte

| Datei | Zweck |
|-------|-------|
| `src/app/page.tsx` | Landing Page |
| `src/app/(app)/layout.tsx` | Shared Navigation Layout |
| `src/app/(app)/chat/page.tsx` | Hauptchat-Seite |
| `src/app/api/chat/agent/route.ts` | Agent Mode API |

### 14.2 Core Libraries

| Datei | Zweck |
|-------|-------|
| `src/lib/ollama.ts` | Ollama API Client (Chat + Streaming + Tools) |
| `src/lib/storage.ts` | localStorage Persistence mit Quota-Handling |
| `src/lib/agents/executor.ts` | Agent Loop (AsyncGenerator) |
| `src/lib/agents/registry.ts` | Tool Registry |
| `src/lib/documents/rag.ts` | RAG Pipeline |
| `src/lib/documents/store.ts` | Document Storage (JSONL) |
| `src/lib/notes/embeddings.ts` | Embedding Generation + Search |
| `src/lib/webSearch/searxng.ts` | Web Search Engine |

### 14.3 Konfiguration

| Datei | Zweck |
|-------|-------|
| `.env.example` | Environment Variables Documentation |
| `next.config.ts` | Next.js Config (minimal) |
| `tsconfig.json` | TypeScript Config (strict mode) |
| `vitest.config.ts` | Test Runner Config |
| `.github/workflows/ci.yml` | CI Pipeline |
| `docker-compose.yml` | SearXNG Container |
| `components.json` | Shadcn UI Config |

---

## Zusammenfassung

**LocAI ist ein beeindruckend umfangreiches Hobby-Projekt** mit:
- 31.910 LOC gut strukturiertem TypeScript/React Code
- 24+ implementierten Features (Chat, RAG, Agent Mode, Gallery, Notes, Graph, GPU Monitor...)
- Sauberer Architektur mit Domain-Driven Folders und Custom Hooks
- Funktionalem Agent Mode mit 4 Tools und erweiterbbarer Registry

**Größte Stärken:**
1. Privacy-First Design (100% lokal)
2. Feature-Reichtum für ein lokales Tool
3. Gut refactored Code (Gallery, Notes)
4. Solide RAG Pipeline
5. Agent Mode Grundlage ist erweiterbar

**Größte Schwächen:**
1. Minimale Testabdeckung (3 Dateien / 158 LOC)
2. localStorage als primärer Conversation Store
3. Kein Multi-Agent Support
4. Einige übergroße Komponenten (Settings 984 LOC)
5. Agent Mode hat nur 4 Tools (kein Code Execution, File Write)

**Empfohlene Nächste Schritte:**
1. 🔴 **Quick:** Agent Tools erweitern (write_file, edit_file, run_command)
2. 🔴 **Quick:** Test Coverage starten (Agent Tools, RAG, Chunker)
3. 🟡 **Medium:** Conversation Storage auf Filesystem migrieren
4. 🟡 **Medium:** Multi-Agent Orchestrator bauen
5. 🟢 **Large:** SQLite + Vector Search für Skalierung

---

*Dieser Bericht basiert auf einer vollständigen Analyse aller 181 Source-Dateien des LocAI Projekts.*
