# LocAI - AI Agent Documentation

> Last Updated: 2025-12-06
> Status: Active Development (Resumed)

---

## Project Overview

**LocAI** is a modern local AI chat application that runs AI models directly on local hardware using Ollama. The project emphasizes privacy, data control, and cloud-independence.

### Key Features
- 💬 Local chat with multiple AI models (Llama3, Gemma, Mistral, DeepSeek)
- 🖼️ Image analysis with vision models
- 💾 Local data storage (LocalStorage/FileSystem)
- 🎨 Dark/Light theme support
- 📱 Responsive design

---

## Tech Stack

| Technology | Version | Status |
|------------|---------|--------|
| Next.js | 15.5.7 | ✅ Current (Security patched) |
| React | 19.2.1 | ✅ Current |
| TypeScript | 5.9.3 | ✅ Current |
| Tailwind CSS | 4.1.17 | ✅ Current |
| Framer Motion | 12.23.25 | ✅ Current |
| Shadcn/UI | - | ✅ Current |
| Supabase CLI | 2.65.6 | ✅ Current |

---

## Current Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── chat/              # Main chat functionality
│   │   └── page.tsx       # Chat page component (965 lines)
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   ├── chat/              # Chat-specific components
│   │   ├── ChatContainer.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── ConversationSidebar.tsx
│   │   └── ThinkingProcess.tsx
│   ├── ui/                # Shadcn UI components
│   └── ThemeProvider.tsx
├── lib/
│   ├── ollama.ts          # Ollama API integration
│   ├── storage.ts         # Local storage utilities
│   ├── templates/         # Model-specific prompts
│   └── utils.ts
└── types/
    └── chat.ts            # TypeScript definitions
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

1. **Large component**: `src/app/chat/page.tsx` is 965 lines - should be split
2. **No streaming**: Chat responses are not streamed (all-at-once)
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

### 2025-03-08 (Last Active)
- Initial project structure
- Basic chat functionality
- Vision model support

