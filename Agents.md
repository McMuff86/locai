# LocAI - AI Agent Documentation

> Last Updated: 2025-12-06
> Status: Active Development

---

## Project Overview

**LocAI** is a modern local AI chat application that runs AI models directly on local hardware using Ollama. The project emphasizes privacy, data control, and cloud-independence.

### Key Features
- 💬 Local chat with multiple AI models (Llama3, Gemma, Mistral, DeepSeek, Granite, Qwen)
- 🖼️ Image analysis with vision models (Granite Vision, Llama3.2 Vision)
- 💾 Local data storage (LocalStorage) with Auto-Save
- 🎨 Dark/Light theme support (Grok-style dark theme)
- 📱 Responsive design with resizable sidebar (400px default)
- 🔍 Chat search across conversations
- 📊 Conversation statistics
- 🎨 **ComfyUI Integration** - Launch, monitor & image gallery
- ⭐ **Image Gallery** - Favorites, metadata, delete, analyze, use as input
- 📥 **Model Pull UI** - Download 60+ models directly from LocAI
- ✨ **Prompt Templates** - 12 specialized templates in 5 categories
- 🖥️ **GPU Monitor** - Real-time NVIDIA GPU stats, VRAM, temp, processes
- 📊 **Right Sidebar** - Dockable tools panel with widgets
- ⚡ **Process Kill** - Terminate GPU processes with safety warnings

---

## Tech Stack

| Technology | Version | Status |
|------------|---------|--------|
| Next.js | 15.5.7 | ✅ Current (Security patched) |
| React | 19.2.1 | ✅ Current |
| TypeScript | 5.9.3 | ✅ Current |
| Tailwind CSS | 4.1.17 | ✅ Current |
| Framer Motion | 12.23.25 | ✅ Current |
| react-markdown | 10.x | ✅ GFM support |
| react-syntax-highlighter | 15.x | ✅ Code highlighting |
| Shadcn/UI | - | ✅ Current |
| date-fns | 4.x | ✅ Date formatting |

---

## Current Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── comfyui/
│   │   │   ├── gallery/
│   │   │   │   ├── route.ts            # List images
│   │   │   │   ├── [id]/route.ts       # Serve single image
│   │   │   │   ├── metadata/route.ts   # PNG metadata extraction
│   │   │   │   ├── delete/route.ts     # Delete image
│   │   │   │   └── copy-to-input/route.ts  # Copy to ComfyUI input
│   │   │   ├── launch/route.ts         # Start ComfyUI
│   │   │   └── status/route.ts         # Check if running
│   │   ├── ollama/
│   │   │   └── pull/route.ts           # Pull models (streaming, 60+ models)
│   │   ├── folder-picker/route.ts      # Native folder dialog
│   │   ├── notes/                      # Notes CRUD/search/embed
│   │   │   ├── route.ts                # CRUD list/create/delete
│   │   │   ├── search/route.ts         # Lexical + semantic search
│   │   │   └── embed/route.ts          # Build embeddings for notes
│   │   └── system-stats/route.ts       # CPU/RAM/VRAM monitoring
│   ├── chat/              
│   │   └── page.tsx                    # Chat page (~680 lines)
│   ├── notes/                          # Notes UI
│   │   └── page.tsx                    # Notes list + editor + 3D graph
│   ├── layout.tsx         
│   └── globals.css                     # Grok/Ollama-style dark theme
├── components/
│   ├── chat/                           # Chat-specific components
│   │   ├── ChatContainer.tsx
│   │   ├── ChatHeader.tsx              # 172 lines
│   │   ├── ChatInput.tsx               # 134 lines
│   │   ├── ChatMessage.tsx             # 216 lines
│   │   ├── ChatSearch.tsx              # 226 lines
│   │   ├── ConversationSidebar.tsx     # 543 lines ⚠️
│   │   ├── ConversationStats.tsx       # 261 lines
│   │   ├── MarkdownRenderer.tsx        # 234 lines
│   │   ├── SetupCard.tsx               # ~280 lines (with Template Picker)
│   │   ├── ThinkingProcess.tsx         # 85 lines
│   │   └── TokenCounter.tsx            # 107 lines
│   ├── gallery/                        # ✅ NEW: Refactored Image Gallery
│   │   ├── types.ts                    # Type definitions
│   │   ├── hooks/
│   │   │   ├── index.ts
│   │   │   ├── useGalleryImages.ts     # Image fetching (~80 lines)
│   │   │   ├── useFavorites.ts         # Favorites management (~70 lines)
│   │   │   ├── useImageMetadata.ts     # PNG metadata (~45 lines)
│   │   │   └── useImageActions.ts      # Delete/copy/download (~75 lines)
│   │   ├── GalleryHeader.tsx           # Header with controls (~120 lines)
│   │   ├── ImageCard.tsx               # Image thumbnail (~75 lines)
│   │   ├── Lightbox.tsx                # Full-screen viewer (~175 lines)
│   │   ├── MetadataPanel.tsx           # Metadata display (~120 lines)
│   │   ├── DeleteConfirmDialog.tsx     # Confirmation dialog (~55 lines)
│   │   ├── EmptyState.tsx              # Empty/error states (~45 lines)
│   │   ├── ImageGallery.tsx            # Main component (~230 lines)
│   │   └── index.ts                    # Exports
│   ├── ui/                             # Shadcn UI components
│   ├── ComfyUIWidget.tsx               # 238 lines
│   ├── ErrorBoundary.tsx               # Error handling
│   ├── ClientErrorBoundary.tsx         # Client wrapper
│   ├── ImageGallery.tsx                # Legacy wrapper → gallery/
│   ├── ModelPullDialog.tsx             # Download models (~400 lines)
│   ├── OllamaStatus.tsx                # Connection indicator
│   ├── SystemMonitor.tsx               # 246 lines
│   └── ThemeProvider.tsx
├── hooks/
│   ├── index.ts
│   ├── useChat.ts                      # 228 lines
│   ├── useConversations.ts             # 231 lines
│   ├── useModels.ts                    # 108 lines
│   ├── useKeyboardShortcuts.ts         # 70 lines
│   ├── useOllamaStatus.ts              # Connection monitoring
│   └── useSettings.ts                  # ComfyUI paths, etc.
├── lib/
│   ├── ollama.ts                       # 550 lines
│   ├── storage.ts                      # 389 lines
│   ├── notes/                          # Notes domain (storage, parsing, embeddings)
│   │   ├── types.ts
│   │   ├── noteStorage.ts
│   │   ├── fileNoteStorage.ts
│   │   ├── parser.ts
│   │   ├── graph.ts
│   │   ├── embeddings.ts
│   │   ├── search.ts
│   │   └── index.ts
│   ├── templates/                      # Model prompts
│   │   ├── index.ts
│   │   ├── deepseek.ts                 # <think> reasoning support
│   │   ├── gemma.ts
│   │   ├── granite-vision.ts
│   │   ├── llama3.ts
│   │   ├── llama3-vision.ts
│   │   ├── mistral.ts
│   │   └── qwen-coder.ts               # Qwen3-Coder template
│   ├── prompt-templates.ts             # ✅ NEW: 12 Prompt Templates
│   └── utils.ts
└── types/
    ├── chat.ts
    └── index.ts
```

---

## File Size Overview (Files > 200 lines)

| File | Lines | Status |
|------|-------|--------|
| ~~`ImageGallery.tsx`~~ | ~~958~~ | ✅ Refactored into gallery/ |
| `page.tsx` | 680 | ✅ Acceptable |
| `ollama.ts` | 550 | ✅ Utility file |
| `ConversationSidebar.tsx` | 543 | ⚠️ Could be split |
| `ModelPullDialog.tsx` | 400 | ✅ Standalone feature |
| `storage.ts` | 389 | ✅ OK |
| `ConversationStats.tsx` | 261 | ✅ OK |
| `metadata/route.ts` | 259 | ✅ OK |
| `SystemMonitor.tsx` | 246 | ✅ OK |
| `ComfyUIWidget.tsx` | 238 | ✅ OK |
| `MarkdownRenderer.tsx` | 234 | ✅ OK |
| `gallery/ImageGallery.tsx` | 230 | ✅ Refactored |
| `useConversations.ts` | 231 | ✅ OK |
| `useChat.ts` | 228 | ✅ OK |
| `ChatSearch.tsx` | 226 | ✅ OK |
| `ChatMessage.tsx` | 216 | ✅ OK |
| `SetupCard.tsx` | 210 | ✅ OK |

---

## Feature Status

### ✅ Implemented Features

| Feature | Status | Notes |
|---------|--------|-------|
| Chat with Ollama | ✅ | Multiple models |
| Streaming Responses | ✅ | Token-by-token |
| Vision Model Support | ✅ | Granite, Llama3.2 |
| Token Counter | ✅ | Input/output/speed |
| Context Window Display | ✅ | Shows usage |
| Dark/Light Theme | ✅ | Grok-style |
| Conversation History | ✅ | LocalStorage |
| Auto-Save | ✅ | After each message |
| Chat Search | ✅ | Full-text |
| Conversation Stats | ✅ | Words, tokens, time |
| Markdown Rendering | ✅ | GFM + syntax highlight |
| Code Copy Button | ✅ | One-click copy |
| Keyboard Shortcuts | ✅ | Ctrl+N/S, Escape, / |
| Resizable Sidebar | ✅ | 240-500px, default 400px |
| System Monitor | ✅ | CPU/RAM/VRAM |
| ComfyUI Launch | ✅ | Start from LocAI |
| ComfyUI Status | ✅ | Running indicator |
| Image Gallery | ✅ | Grid view, lightbox |
| Gallery Grid Sizes | ✅ | XS/S/M/L |
| Image Favorites | ✅ | LocalStorage |
| Image Delete | ✅ | With confirmation |
| PNG Metadata | ✅ | Prompt/Seed/Sampler |
| Copy Prompt | ✅ | From metadata |
| Analyze with Vision | ✅ | Granite preferred |
| Use as ComfyUI Input | ✅ | Copy to input folder |
| Native Folder Picker | ✅ | OS dialogs |
| Error Boundaries | ✅ | Graceful error handling |
| Ollama Status | ✅ | Real-time connection indicator |
| Loading Skeletons | ✅ | All loading states |
| Model Pull UI | ✅ | Download 60+ models in-app |
| Qwen3-Coder Template | ✅ | Optimized for code models |
| Prompt Templates | ✅ | 12 templates in 5 categories |
| GPU Monitor | ✅ | nvidia-smi: VRAM, Temp, Utilization, Processes |

### ✅ Recently Completed (Current Session)

| # | Feature | Status |
|---|---------|--------|
| 1 | Error Boundaries | ✅ Global error catching with recovery UI |
| 2 | Ollama Connection Status | ✅ Real-time indicator in sidebar |
| 3 | Loading Skeletons | ✅ Skeleton components for all loading states |
| 4 | Model Pull UI | ✅ 60+ models in 6 categories, custom model support |
| 5 | ImageGallery Refactoring | ✅ 992 lines → 11 files (~200 lines each) |
| 6 | Qwen3-Coder Template | ✅ Optimized system prompt for code models |
| 7 | Prompt Templates | ✅ 12 templates: Code Review, Debugging, Translation, etc. |
| 8 | Template Picker UI | ✅ Integrated into SetupCard with categories |
| 9 | GPU Monitor | ✅ nvidia-smi integration, VRAM, Temp, GPU Processes |

### 🟡 TODO: Medium Priority

| # | Feature | Effort | Description |
|---|---------|--------|-------------|
| 1 | ConversationSidebar Refactoring | 3h | Split 543 lines |
| 2 | Export Chat | 2h | Markdown/JSON/PDF |
| 3 | Image Drag & Drop | 3h | Gallery → Chat |
| 4 | Conversation Tags | 4h | Categorization |
| 5 | Keyboard Shortcuts Modal | 2h | Show all (? key) |

### 🟢 TODO: Low Priority (Future)

| # | Feature | Effort | Description |
|---|---------|--------|-------------|
| 7 | Supabase Integration | 8h | Cloud sync |
| 8 | Multi-Model Chat | 6h | Different models in one chat |
| 9 | RAG Integration | 12h | Document upload |
| 10 | ComfyUI Workflow Editor | 20h | Edit workflows in LocAI |
| 11 | Voice Input | 6h | Whisper integration |

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
| **Qwen3 Coder** | `qwen-coder.ts` | **NEW**: ChatML, code-focused |

### Qwen3-Coder Recommended Settings
```typescript
{
  temperature: 0.7,
  top_p: 0.8,
  top_k: 20,
  repeat_penalty: 1.05,
  num_predict: 8192
}
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/system-stats` | GET | CPU, RAM, VRAM, active models |
| `/api/folder-picker` | GET | Native OS folder dialog |
| `/api/ollama/pull` | GET | List 60+ suggested models |
| `/api/ollama/pull` | POST | Pull/download a model (streaming) |
| `/api/comfyui/status` | GET | Check if ComfyUI running |
| `/api/comfyui/launch` | POST | Start ComfyUI |
| `/api/comfyui/gallery` | GET | List images |
| `/api/comfyui/gallery/[id]` | GET | Serve single image |
| `/api/comfyui/gallery/metadata` | GET | Extract PNG metadata |
| `/api/comfyui/gallery/delete` | DELETE | Delete image |
| `/api/comfyui/gallery/copy-to-input` | POST | Copy to input folder |

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

### 2025-12-06 (Current Session)
- ✅ Resumed development
- ✅ Updated all safe dependencies
- ✅ Security patch (Next.js 15.5.7)
- ✅ Optimized all model templates
- ✅ New Grok-style dark theme
- ✅ System Monitor (CPU/RAM/VRAM)
- ✅ Major refactoring (968 → 622 lines in page.tsx)
- ✅ Streaming responses
- ✅ Token counter & context window
- ✅ Keyboard shortcuts
- ✅ Code copy button
- ✅ Chat search
- ✅ Markdown rendering (GFM + syntax highlight)
- ✅ Conversation statistics
- ✅ Auto-save
- ✅ Resizable sidebar (400px default)
- ✅ ComfyUI integration (launch, status)
- ✅ Image Gallery with all features
- ✅ Native folder picker
- ✅ Toast notifications
- ✅ Error Boundaries + Ollama Status
- ✅ Loading Skeletons
- ✅ **Model Pull UI** (60+ models, categories, custom names)
- ✅ **ImageGallery Refactoring** (992 → 11 files)
- ✅ **Qwen3-Coder Template** (optimized system prompt)
- ✅ **Prompt Templates** (12 templates in 5 categories)
- ✅ **Template Picker UI** (SetupCard with category filter & preview)
- ✅ **GPU Monitor** (nvidia-smi: VRAM, Temp, Utilization, Processes)
- ✅ **Right Sidebar** (Tools Panel with GPU Monitor widget)
- ✅ **Process Kill** (Kill GPU processes with safety confirmation)
- ✅ **Notes scaffold** (filesystem storage, parsing, graph, embeddings helpers, API stubs)
- ✅ **Notes UI** (Separate page, list, create, 3D graph, open via sidebar)

### 2025-03-08
- Initial project structure
- Basic chat functionality
- Vision model support

---

## Next Steps (In Order)

1. ~~Error Boundaries + Ollama Status~~ ✅
2. ~~Loading Skeletons~~ ✅
3. ~~Model Pull UI~~ ✅
4. ~~ImageGallery Refactoring~~ ✅
5. ~~Qwen3-Coder Template~~ ✅
6. ~~Prompt Templates~~ ✅ (12 templates in 5 categories)
7. ~~Template Picker UI~~ ✅ (integrated into SetupCard)
8. ~~GPU Monitor~~ ✅ (nvidia-smi integration)
9. **ConversationSidebar Refactoring** ← NEXT (optional)
10. Export Chat (Markdown/JSON/PDF)
