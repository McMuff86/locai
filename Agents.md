# LocAI - AI Agent Documentation

> Last Updated: 2025-12-06
> Status: Active Development (Resumed)

---

## Project Overview

**LocAI** is a modern local AI chat application that runs AI models directly on local hardware using Ollama. The project emphasizes privacy, data control, and cloud-independence.

### Key Features
- 💬 Local chat with multiple AI models (Llama3, Gemma, Mistral, DeepSeek)
- 🖼️ Image analysis with vision models
- 💾 Local data storage (LocalStorage/FileSystem) with Auto-Save
- 🎨 Dark/Light theme support (Grok-style dark theme)
- 📱 Responsive design with resizable sidebar
- 🔍 Chat search across conversations
- 📊 Conversation statistics
- 🎨 **ComfyUI Integration** - Launch & monitor from LocAI

---

## Tech Stack

| Technology | Version | Status |
|------------|---------|--------|
| Next.js | 15.5.7 | ✅ Current (Security patched) |
| React | 19.2.1 | ✅ Current |
| TypeScript | 5.9.3 | ✅ Current |
| Tailwind CSS | 4.1.17 | ✅ Current |
| Framer Motion | 12.23.25 | ✅ Current |
| react-markdown | 10.x | ✅ NEW - GFM support |
| react-syntax-highlighter | 15.x | ✅ NEW - Code highlighting |
| Shadcn/UI | - | ✅ Current |
| Supabase CLI | 2.65.6 | ✅ Current |

---

## Current Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── comfyui/       # ComfyUI Integration APIs
│   │   │   ├── launch/route.ts   # Start ComfyUI
│   │   │   └── status/route.ts   # Check if running
│   │   └── system-stats/route.ts # System monitoring
│   ├── chat/              
│   │   └── page.tsx       # Chat page (~550 lines, resizable sidebar)
│   ├── layout.tsx         
│   └── globals.css        # Grok/Ollama-style dark theme
├── components/
│   ├── chat/              # Chat-specific components
│   │   ├── ChatContainer.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessage.tsx    # Uses MarkdownRenderer
│   │   ├── ChatSearch.tsx     # Conversation search
│   │   ├── ConversationSidebar.tsx  # Settings + ComfyUI widget
│   │   ├── ConversationStats.tsx    # Per-chat statistics
│   │   ├── MarkdownRenderer.tsx     # GFM + syntax highlighting
│   │   ├── SetupCard.tsx
│   │   ├── ThinkingProcess.tsx
│   │   └── TokenCounter.tsx
│   ├── ui/                # Shadcn UI components
│   ├── ComfyUIWidget.tsx  # NEW: ComfyUI status & launcher
│   ├── SystemMonitor.tsx
│   └── ThemeProvider.tsx
├── hooks/
│   ├── index.ts
│   ├── useChat.ts         # Chat + streaming + tokens
│   ├── useConversations.ts # Auto-save conversations
│   ├── useModels.ts       # Ollama models
│   ├── useKeyboardShortcuts.ts
│   └── useSettings.ts     # NEW: App settings (localStorage)
├── lib/
│   ├── ollama.ts
│   ├── storage.ts
│   ├── templates/         # Model prompts
│   └── utils.ts
└── types/
    └── chat.ts
```

---

## Pending Updates (npm outdated)

### ✅ Completed Updates (2025-12-06)
All safe updates have been applied:
- React 19.0.0 → 19.2.1
- Framer Motion 12.4.10 → 12.23.25
- Tailwind CSS 4.0.12 → 4.1.17
- TypeScript 5.8.2 → 5.9.3
- All @radix-ui/* packages → latest
- Next.js 15.2.1 → 15.5.7 (Security fix)
- Supabase CLI 2.15.8 → 2.65.6

### 🟡 Available Major Updates (Optional)
These are major version updates that may have breaking changes:

| Package | Current | Target | Notes |
|---------|---------|--------|-------|
| next | 15.5.7 | 16.0.7 | Major version - new features |
| uuid | 11.1.0 | 13.0.0 | Major version jump |
| lucide-react | 0.479.0 | 0.556.0 | Icon updates |
| @types/node | 20.19.25 | 24.10.1 | Node.js type definitions |

---

## Upgrade Recommendations

### Phase 1: Quick Wins (Einfachste Upgrades)
1. **Safe dependency updates**: `npm update`
2. **TypeScript strict mode** improvements
3. **Code cleanup** in chat/page.tsx (currently 965 lines)

### Phase 2: Feature Enhancements
1. **Streaming responses** - Enable `stream: true` in Ollama API
2. **Better error handling** with toast notifications
3. **Loading states** optimization

### Phase 3: Architecture Improvements
1. **Supabase integration** - config exists but not implemented
2. **Server Actions** for better security
3. **Component refactoring** - break down large components

---

## Known Issues

1. ~~**Large component**: `src/app/chat/page.tsx` is 965 lines~~ ✅ FIXED (now ~300 lines)
2. ~~**No streaming**: Chat responses are not streamed~~ ✅ FIXED (streaming implemented)
3. **Supabase unused**: Config exists but no database integration
4. **LocalStorage only**: Data persistence is browser-local only

---

## Related Documentation

- [README.md](./README.md) - Project overview and setup
- [README_AIAGENT.MD](./README_AIAGENT.MD) - AI Agent instructions
- [folder_structure.md](./folder_structure.md) - Project structure
- [thoughtprocess/](./thoughtprocess/) - Development thought process

---

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm build

# Update safe dependencies
npm update

# Check outdated packages
npm outdated

# Start Ollama (required)
ollama serve

# Pull recommended models
ollama pull llama3
ollama pull llama3.2-vision
```

---

## Changelog

### 2025-12-06
- ✅ Resumed development after pause
- ✅ Created Agents.md documentation
- ✅ Updated all safe dependencies via `npm update`
- ✅ Applied critical security patch (Next.js 15.2.1 → 15.5.7)
  - Fixed: Information exposure in dev server
  - Fixed: Authorization bypass in middleware
  - Fixed: RCE vulnerability in React flight protocol
  - Fixed: SSRF vulnerability
- ✅ 0 vulnerabilities remaining
- ✅ Fixed tsconfig.json to exclude `thoughtprocess/` from compilation
- ✅ Build successful with Next.js 15.5.7
- ✅ Optimized all model templates:
  - DeepSeek R1: Added `<think>` reasoning support
  - Granite Vision: New template for IBM models
  - Llama3 Vision: Enhanced system prompt
  - Llama3/Gemma/Mistral: Improved prompts
- ✅ New Dark Theme (Grok/Ollama style)
  - Deep black background (#141414)
  - Teal/Cyan accent color
  - Enhanced contrast
- ✅ System Monitor Component
  - Real-time CPU usage
  - RAM usage tracking
  - VRAM monitoring via Ollama API
  - Live updates during generation
- ✅ Major Refactoring (968 → ~300 lines in page.tsx)
  - Extracted: useModels, useConversations, useChat hooks
  - Extracted: ChatHeader, SetupCard, TokenCounter components
  - ollama.ts now returns token statistics
  - Token Counter shows: input/output tokens, speed, duration
- ✅ New Features implemented:
  - **Streaming Responses**: Live token-by-token output
  - **Context Window Display**: Shows model's context limit & usage
  - **Keyboard Shortcuts**: Ctrl+N (new), Ctrl+S (save), Escape (stop), / (focus)
  - **Code Block Copy Button**: Click to copy code snippets
  - **Stop Button**: Cancel generation mid-stream
  - **Multi-line Input**: Textarea with Enter/Ctrl+Enter support
- ✅ **Chat Search** (NEW):
  - Full-text search across all conversations
  - Highlights matching text
  - Shows context preview
  - Relevance-based sorting
- ✅ **Markdown Rendering** (NEW):
  - react-markdown with GitHub Flavored Markdown (GFM)
  - Syntax highlighting for 100+ languages via Prism
  - Tables, task lists, strikethrough support
  - Beautiful blockquotes and inline code
  - Copy button for all code blocks
- ✅ **Conversation Statistics** (NEW):
  - Word & character count per conversation
  - Message breakdown (user/assistant)
  - Estimated token count
  - Duration tracking
  - Model information display
  - Expandable stats panel in sidebar

### 2025-03-08 (Last Active)
- Initial project structure
- Basic chat functionality
- Vision model support

