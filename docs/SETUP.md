# LocAI — Setup Guide

> Complete setup guide for running LocAI locally. From zero to first chat message.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [Configuration](#4-configuration)
5. [Quick Start](#5-quick-start)
6. [Troubleshooting](#6-troubleshooting)
7. [Upgrading](#7-upgrading)

---

## 1. System Requirements

### Operating System

| OS | Notes |
|---|---|
| **Linux** | Native — works out of the box |
| **macOS** | Intel & Apple Silicon supported |
| **Windows** | **WSL2 required** — run LocAI inside a WSL2 distro (Ubuntu recommended) |

> ⚠️ **Windows users:** Do NOT run LocAI natively in PowerShell/cmd. Use WSL2. The web terminal feature (`node-pty`) requires a Unix environment.

### Software

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 22+ | Required. Check with `node -v` |
| **npm** | 10+ | Ships with Node.js 22 |
| **Git** | 2.x | For cloning and updates |

### Hardware

| | Minimum | Recommended |
|---|---|---|
| **RAM** | 8 GB | 16 GB+ (LLMs are memory-hungry) |
| **Storage** | 5 GB free | 20 GB+ (models take space) |
| **GPU** | Not required | NVIDIA GPU with 8 GB+ VRAM for fast local inference |
| **CPU** | Any modern x64/ARM | 8+ cores for comfortable multitasking |

> 💡 If you use cloud providers (Anthropic, OpenAI, OpenRouter) instead of Ollama, hardware requirements are minimal — any machine that can run Node.js works fine.

---

## 2. Prerequisites

LocAI is modular. You only need to install what you want to use.

### Core (always required)

- **Node.js 22+** — [Download](https://nodejs.org/)
- **npm** — comes with Node.js

### LLM — Chat & Agent (pick at least one)

#### Option A: Ollama (Local — recommended for privacy)

1. Install Ollama: [https://ollama.com/download](https://ollama.com/download)
2. Pull at least one chat model:

```bash
ollama pull llama3
```

3. Verify it's running:

```bash
ollama list          # should show your models
curl http://localhost:11434/api/tags   # should return JSON
```

#### Option B: Cloud Provider (API key required)

Set the corresponding API key in `.env.local`:

| Provider | Sign up | Env Variable |
|---|---|---|
| **Anthropic** (Claude) | [console.anthropic.com](https://console.anthropic.com/) | `ANTHROPIC_API_KEY` |
| **OpenAI** (GPT-4o) | [platform.openai.com](https://platform.openai.com/) | `OPENAI_API_KEY` |
| **OpenRouter** (100+ models) | [openrouter.ai](https://openrouter.ai/) | `OPENROUTER_API_KEY` |

> You can use multiple providers simultaneously. Select the active provider/model in the Settings page or per-chat.

### Embeddings / RAG (optional but recommended)

For document search, semantic note linking, and RAG (Retrieval-Augmented Generation):

```bash
ollama pull nomic-embed-text
```

Without this, document upload and semantic search won't work.

### Image Generation (optional)

LocAI integrates with **ComfyUI** for AI image generation and a gallery viewer.

1. Install ComfyUI: [https://github.com/comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI)
2. Download models (place in ComfyUI's `models/` folder):
   - **Recommended:** Stable Diffusion XL (`sd_xl_base_1.0.safetensors`)
   - **Recommended:** FLUX.1 schnell or dev
   - Get models from [https://civitai.com](https://civitai.com) or [https://huggingface.co](https://huggingface.co)
3. Start ComfyUI (default: `http://localhost:8188`)

### Music Generation (optional)

LocAI can generate music via **ACE-Step 1.5**.

1. Install ACE-Step: [https://github.com/ace-step/ace-step](https://github.com/ace-step/ace-step)
2. Requirements:
   - Python 3.11+
   - CUDA GPU strongly recommended (generation is very slow on CPU)
3. Start the ACE-Step server:

```bash
# Default URL: http://localhost:8001
python app.py
```

### Voice Clone / Text-to-Speech (optional)

LocAI integrates with **Qwen3-TTS** for text-to-speech and voice cloning.

1. Install Qwen3-TTS: [https://github.com/QwenLM/Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
2. Requirements:
   - Python 3.11+
   - CUDA GPU recommended
3. Start the Qwen3-TTS server:

```bash
# Default URL: http://localhost:7861
python app.py
```

---

## 3. Installation

### Step 1: Clone the repository

```bash
git clone https://github.com/McMuff86/locai.git
cd locai
```

### Step 2: Install dependencies

```bash
npm install
```

> This also copies the PDF worker to `public/` automatically (postinstall script).

### Step 3: Create your environment file

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings (see [Configuration](#4-configuration) below).

### Step 4: Start the dev server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser. Done! 🎉

### Production build (optional)

```bash
npm run build
npm run start
```

---

## 4. Configuration

### Environment Variables (`.env.local`)

Copy `.env.example` to `.env.local` and adjust as needed:

```bash
# ──────────────────────────────────────────────
# Ollama
# ──────────────────────────────────────────────
# Ollama API URL (default: http://localhost:11434)
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434

# Alternative: OLLAMA_HOST (server-side only)
# OLLAMA_HOST=http://localhost:11434

# ──────────────────────────────────────────────
# Cloud LLM Providers (optional)
# ──────────────────────────────────────────────
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# OPENROUTER_API_KEY=sk-or-...

# ──────────────────────────────────────────────
# Security
# ──────────────────────────────────────────────
# API token to protect routes (optional, recommended if exposed to network)
# LOCAI_API_TOKEN=your-secret-token-here

# Allow requests from non-localhost (default: false)
# LOCAI_ALLOW_REMOTE=true

# ──────────────────────────────────────────────
# Data Paths
# ──────────────────────────────────────────────
# Custom data directory for LocAI storage
# LOCAI_DATA_PATH=/path/to/data

# Custom path for file-based notes storage
# LOCAL_NOTES_PATH=/path/to/your/notes

# ──────────────────────────────────────────────
# Misc
# ──────────────────────────────────────────────
# Port (default: 3000)
# PORT=3000

# Syncfusion PDF Viewer license key (optional)
# SYNCFUSION_LICENSE_KEY=your-key-here
```

### Settings Page

Visit **http://localhost:3000/settings** to configure:

- **Active LLM provider** — switch between Ollama, Anthropic, OpenAI, OpenRouter
- **Default model** — select which model to use for chat
- **Preferences** — UI settings, favorites, graph layout

> API keys must be set in `.env.local` (server-side). The Settings page handles model selection and UI preferences.

### Provider Setup

| Provider | Setup |
|---|---|
| **Ollama** | Just install and run Ollama. No config needed. Models appear automatically. |
| **Anthropic** | Set `ANTHROPIC_API_KEY` in `.env.local`. Restart the server. Select "Anthropic" as provider. |
| **OpenAI** | Set `OPENAI_API_KEY` in `.env.local`. Restart the server. Select "OpenAI" as provider. |
| **OpenRouter** | Set `OPENROUTER_API_KEY` in `.env.local`. Restart the server. Select "OpenRouter" as provider. |

---

## 5. Quick Start

### First Launch Checklist

1. **Start LocAI:** `npm run dev` → open `http://localhost:3000`
2. **Check Ollama** (if using local models):
   ```bash
   ollama list   # should show at least one model
   ```
3. **Send your first message:** Go to `/chat`, type something, hit Enter
4. **Upload a document:** Go to `/documents`, drag & drop a PDF or text file
5. **Try the flow builder:** Go to `/flow`, create a simple workflow
6. **Open the terminal:** Go to `/terminal` — you get a full shell in the browser

### What happens on first start?

- LocAI starts on port 3000 with a custom server (HTTP + WebSocket for terminal)
- Data is stored client-side in IndexedDB (conversations, notes, documents)
- File-based features (file browser, notes) use server-side storage at `LOCAI_DATA_PATH` or `LOCAL_NOTES_PATH`
- No database setup needed — it just works

---

## 6. Troubleshooting

### Ollama not reachable

**Symptom:** "Failed to fetch models" or empty model list.

**Fix:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve

# If running on a different host/port, set in .env.local:
NEXT_PUBLIC_OLLAMA_URL=http://your-host:11434
```

### Port 3000 already in use

**Symptom:** `Error: listen EADDRINUSE :::3000`

**Fix:**
```bash
# Find what's using port 3000
lsof -i :3000    # macOS/Linux
ss -tlnp | grep 3000   # Linux

# Kill it
kill <PID>

# Or use a different port
PORT=3001 npm run dev
```

### GPU not recognized by Ollama

**Symptom:** Ollama runs but inference is very slow (using CPU).

**Fix:**
```bash
# Check if Ollama sees your GPU
ollama ps

# NVIDIA: make sure drivers + CUDA are installed
nvidia-smi

# On WSL2: install NVIDIA CUDA drivers for WSL
# https://docs.nvidia.com/cuda/wsl-user-guide/
```

### Models not found

**Symptom:** "Model not found" errors in chat.

**Fix:**
```bash
# List available models
ollama list

# Pull the model you need
ollama pull llama3
ollama pull nomic-embed-text
```

### CORS problems

**Symptom:** Browser console shows CORS errors when calling Ollama.

**Fix:** Ollama needs to allow your origin. Set the environment variable before starting Ollama:

```bash
OLLAMA_ORIGINS="http://localhost:3000" ollama serve
```

Or for all origins (development only):
```bash
OLLAMA_ORIGINS="*" ollama serve
```

### node-pty build errors on `npm install`

**Symptom:** Native module compilation fails.

**Fix:**
```bash
# Make sure you have build tools
# Ubuntu/Debian:
sudo apt install build-essential python3

# macOS:
xcode-select --install

# Then retry
npm install
```

### WebSocket / Terminal not working

**Symptom:** Terminal page shows blank or connection error.

**Fix:** Make sure you're using the custom dev server (`npm run dev`), not `next dev` directly. The WebSocket endpoint (`/ws/terminal`) is only available through `server.ts`.

---

## 7. Upgrading

```bash
cd locai
git pull origin main
npm install
npm run build     # optional, for production
npm run dev       # restart
```

### After upgrading

- Check the [CHANGELOG](../CHANGELOG.md) or git log for breaking changes
- If models changed, pull new ones: `ollama pull <model-name>`
- Clear browser cache / IndexedDB if you see stale UI issues

---

## API Routes Reference

LocAI exposes ~70 API routes. Key groups:

| Group | Base Path | Purpose |
|---|---|---|
| Chat & Agent | `/api/chat/agent` | Chat streaming, agent execution, workflows |
| Documents | `/api/documents` | CRUD, upload, RAG search |
| Notes | `/api/notes` | CRUD, embeddings, semantic links, AI actions |
| File Browser | `/api/filebrowser` | List, read, write, upload, delete files |
| Gallery | `/api/comfyui/gallery` | ComfyUI image gallery |
| Music | `/api/ace-step` | ACE-Step music generation |
| TTS | `/api/qwen-tts` | Qwen3-TTS text-to-speech |
| Models | `/api/models` | List available models across providers |
| Settings | `/api/settings` | App preferences |
| Search | `/api/search` | Global search |
| Health | `/api/health` | Health check |

For detailed API documentation, see the source code in `src/app/api/`.

---

*Last updated: February 2026*
