# LocAI API Routes

Auto-generated route audit. Last updated: 2026-02-20.

## Health & System

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Health check (Ollama, ComfyUI status) |
| GET | `/api/system-stats` | System stats (CPU, RAM, GPU, Ollama) |
| GET | `/api/settings` | Get app settings |
| POST | `/api/settings` | Update app settings |
| DELETE | `/api/settings` | Reset settings |

## Chat & Agents

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/chat/agent` | Send chat message to agent |
| POST | `/api/chat/agent/workflow` | Execute agent workflow |

## Conversations

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Create conversation |
| DELETE | `/api/conversations` | Delete conversations |
| GET | `/api/conversations/[id]` | Get conversation by ID |
| PUT | `/api/conversations/[id]` | Update conversation |
| GET | `/api/conversations/search` | Search conversations |

## Documents (RAG)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/documents` | List documents |
| DELETE | `/api/documents` | Delete documents |
| GET | `/api/documents/[id]` | Get document by ID |
| DELETE | `/api/documents/[id]` | Delete document by ID |
| POST | `/api/documents/search` | Semantic search |
| POST | `/api/documents/upload` | Upload document |

## File Browser

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/filebrowser` | Get roots |
| GET | `/api/filebrowser/list` | List directory |
| GET | `/api/filebrowser/read` | Read file |
| POST | `/api/filebrowser/write` | Write file |
| POST | `/api/filebrowser/create` | Create file/folder |
| DELETE | `/api/filebrowser/delete` | Delete file/folder |
| GET | `/api/filebrowser/download` | Download file |
| GET | `/api/filebrowser/image` | Get image thumbnail |
| POST | `/api/filebrowser/move` | Move file/folder |
| POST | `/api/filebrowser/rename` | Rename file/folder |
| POST | `/api/filebrowser/upload` | Upload file |

## Image Editor (AI)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/image-editor/ai-describe` | AI image description |
| POST | `/api/image-editor/ai-edit` | AI image editing (ComfyUI) |

## Notes (Obsidian-like)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/notes` | List notes |
| POST | `/api/notes` | Create/update note |
| DELETE | `/api/notes` | Delete note |
| POST | `/api/notes/ai` | AI note operations |
| POST | `/api/notes/embed` | Embed note |
| POST | `/api/notes/embed-test` | Test embedding |
| GET/POST | `/api/notes/search` | Search notes |
| GET | `/api/notes/semantic-links` | Get semantic links |

## Memory

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/memory` | Get memories |
| POST | `/api/memory` | Store memory |
| DELETE | `/api/memory` | Delete memory |
| GET | `/api/memory/relevant` | Get relevant memories |

## ComfyUI

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/comfyui/status` | ComfyUI connection status |
| POST | `/api/comfyui/launch` | Launch ComfyUI |
| GET | `/api/comfyui/gallery` | List gallery images |
| GET | `/api/comfyui/gallery/[id]` | Get gallery image |
| POST | `/api/comfyui/gallery/upload` | Upload to gallery |
| POST | `/api/comfyui/gallery/copy-to-input` | Copy image to input |
| DELETE | `/api/comfyui/gallery/delete` | Delete gallery image |
| GET | `/api/comfyui/gallery/metadata` | Get image metadata |

## Other

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/folder-picker` | Browse filesystem folders |
| GET/POST | `/api/gpu/kill-process` | Kill GPU process |
| POST | `/api/migrate` | Run DB migrations |
| GET/POST | `/api/ollama/pull` | Pull Ollama model |
| GET/POST | `/api/preferences/favorites` | Manage favorites |
| GET/POST | `/api/preferences/graph` | Graph preferences |
| GET/POST/PUT/PATCH | `/api/search` | Web search (SearXNG) |
| POST | `/api/search/optimize` | Optimize search query |

---

**Total: 47 routes across 17 API domains.**
