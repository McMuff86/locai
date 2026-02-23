# LocAI API Reference

> **Base URL:** `http://localhost:3000`  
> **Authentication:** None (local-first, localhost only)

---

## Table of Contents

- [Chat](#chat)
- [Workflows](#workflows)
- [Conversations](#conversations)
- [Documents](#documents)
- [Notes](#notes)
- [Gallery (ComfyUI)](#gallery-comfyui)
- [Files](#files)
- [Audio](#audio)
- [Search](#search)
- [System](#system)

---

## Chat

### POST `/api/chat/agent`
Stream an agent chat session with tool calling. Returns NDJSON events.

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | **Required.** User message |
| `model` | string | Model name |
| `provider` | string | `ollama`, `openai`, `anthropic`, `google` |
| `enabledTools` | string[] | Tool names to enable |
| `maxIterations` | number | Max agent loops |
| `conversationHistory` | object[] | Previous messages |
| `presetId` | string | Agent preset ID |
| `enablePlanning` | boolean | Enable planning step |
| `chatOptions` | object | Ollama options (e.g. temperature) |

```bash
curl -X POST http://localhost:3000/api/chat/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "Erstelle eine Datei test.txt mit Hello World", "model": "llama3"}'
```

### POST `/api/chat/agent/workflow`
Execute a multi-step workflow via the WorkflowEngine. Streams NDJSON events.

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | **Required.** Task description |
| `model` | string | Model name |
| `provider` | string | Provider type |
| `enabledTools` | string[] | Tool names |
| `maxStepIterations` | number | Max iterations per step |
| `maxTotalIterations` | number | Max total iterations |
| `initialPlan` | object | Pre-defined workflow plan |

### DELETE `/api/chat/agent/workflow/{workflowId}`
Cancel a running workflow.

---

## Workflows

### GET `/api/workflows`
List saved workflow summaries.

```bash
curl http://localhost:3000/api/workflows
```

### POST `/api/workflows`
Save a completed workflow.

### GET `/api/workflows/{id}`
Load a single workflow by ID.

### DELETE `/api/workflows/{id}`
Delete a workflow.

---

## Conversations

### GET `/api/conversations`
List conversation summaries.

```bash
curl http://localhost:3000/api/conversations
```

### POST `/api/conversations`
Save a conversation.

| Field | Type | Description |
|-------|------|-------------|
| `conversation` | object | **Required.** Conversation object with `id`, `title`, `messages` |

### DELETE `/api/conversations?id={id}`
Delete a single conversation. Use `?all=true` to delete all.

### GET `/api/conversations/{id}`
Load full conversation with messages.

### PUT `/api/conversations/{id}`
Update conversation metadata (title, tags).

### GET `/api/conversations/search?q={query}&limit=20`
Full-text search across all conversation messages. Minimum query length: 2 characters.

```bash
curl "http://localhost:3000/api/conversations/search?q=machine+learning&limit=10"
```

---

## Documents

### GET `/api/documents`
List all uploaded documents, sorted newest first.

```bash
curl http://localhost:3000/api/documents
```

### DELETE `/api/documents?id={id}`
Delete a document, its embeddings, and uploaded file.

### GET `/api/documents/{id}`
Get document details including chunk previews and embedding count.

### PATCH `/api/documents/{id}`
Rename a document. Body: `{ "name": "New Name" }`

### DELETE `/api/documents/{id}`
Delete a specific document.

### POST `/api/documents/{id}/copy`
Duplicate a document. Optionally: `{ "name": "Custom Name" }`

### POST `/api/documents/upload`
Upload, parse, chunk, and embed a document. Multipart form with `file` field.

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@report.pdf" \
  -F "model=nomic-embed-text"
```

### POST `/api/documents/search`
Semantic search across documents (RAG).

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | **Required.** Search query (min 2 chars) |
| `topK` | number | Max results |
| `threshold` | number | Similarity threshold |
| `documentIds` | string[] | Filter by document IDs |
| `types` | string[] | Filter by document types |
| `model` | string | Embedding model (default: `nomic-embed-text`) |
| `host` | string | Ollama host |

```bash
curl -X POST http://localhost:3000/api/documents/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning basics", "topK": 5}'
```

---

## Notes

All notes endpoints accept `basePath` via query param, `x-notes-path` header, or `LOCAL_NOTES_PATH` env var.

### GET `/api/notes`
List all notes. Add `?id={noteId}` to get a single note.

### POST `/api/notes`
Create or update a note.

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | **Required.** Note title |
| `content` | string | Markdown content |
| `tags` | string[] | Tags |
| `id` | string | ID for update (omit for create) |
| `basePath` | string | Notes directory path |

```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title": "My Note", "content": "# Hello\nWorld", "tags": ["test"], "basePath": "/path/to/notes"}'
```

### DELETE `/api/notes?id={id}`
Delete a note.

### GET `/api/notes/search?query={q}`
Basic text search across notes (title, content, tags).

### POST `/api/notes/search`
Semantic search using embeddings.

### POST `/api/notes/embed`
Generate/update embeddings for notes. Streams NDJSON progress.

### POST `/api/notes/embed-test`
Test if embedding model is available.

### POST `/api/notes/ai`
AI-powered note completion or summarization. Streams response.

| Field | Type | Description |
|-------|------|-------------|
| `action` | string | `complete` or `summarize` |
| `noteId` | string | Existing note ID |
| `content` | string | Raw content (alternative to noteId) |
| `model` | string | LLM model |
| `provider` | string | Provider type |
| `useWebSearch` | boolean | Include web search context |

### GET `/api/notes/semantic-links?threshold=0.7`
Get semantic similarity links between all notes for graph visualization.

---

## Gallery (ComfyUI)

### GET `/api/comfyui/gallery`
List gallery images with pagination and sorting.

| Param | Default | Description |
|-------|---------|-------------|
| `outputPath` | — | Absolute path to output folder |
| `comfyUIPath` | — | Fallback ComfyUI base path |
| `limit` | 50 | Page size |
| `offset` | 0 | Page offset |
| `sortBy` | `modifiedAt` | `modifiedAt`, `createdAt`, `filename` |
| `sortOrder` | `desc` | `asc`, `desc` |

### GET `/api/comfyui/gallery/{id}`
Serve a gallery image. ID is base64url-encoded relative path.

### DELETE `/api/comfyui/gallery/delete?id={id}`
Delete a gallery image.

### POST `/api/comfyui/gallery/copy-to-input`
Copy gallery image to ComfyUI input folder.

### GET `/api/comfyui/gallery/metadata?id={id}`
Read PNG metadata (ComfyUI prompt and workflow data).

### POST `/api/comfyui/gallery/upload`
Upload images/videos to the gallery. Multipart form with `files` field.

### GET `/api/comfyui/status?port=8188&host=localhost`
Check if ComfyUI is running.

### POST `/api/comfyui/launch`
Launch ComfyUI process. Body: `{ "comfyUIPath": "/path/to/comfyui" }`

### GET `/api/comfyui/templates`
List workflow templates.

### POST `/api/comfyui/templates`
Create a workflow template. Body: `{ "name": "...", "workflow": {...} }`

### GET `/api/comfyui/templates/{id}`
Load a single template.

### DELETE `/api/comfyui/templates/{id}`
Delete a template.

### POST `/api/image-editor/ai-describe`
Describe an image using a vision model (tries llama3.2-vision, granite3.1-vision, llava).

### POST `/api/image-editor/ai-edit`
AI-edit an image via ComfyUI img2img pipeline.

---

## Files

### GET `/api/filebrowser`
Get browseable root directories (workspace, notes, etc.).

### GET `/api/filebrowser/list?rootId={id}&path={rel}`
List directory contents.

### GET `/api/filebrowser/read?rootId={id}&path={rel}`
Read text file content.

### POST `/api/filebrowser/write`
Write content to a file. Supports `utf-8` and `base64` encoding.

```bash
curl -X POST http://localhost:3000/api/filebrowser/write \
  -H "Content-Type: application/json" \
  -d '{"rootId": "workspace", "path": "hello.txt", "content": "Hello World"}'
```

### POST `/api/filebrowser/create`
Create a file or directory.

| Field | Type | Description |
|-------|------|-------------|
| `rootId` | string | **Required.** Root ID |
| `name` | string | **Required.** Name |
| `path` | string | Parent path (default: root) |
| `type` | string | `file` or `directory` |
| `content` | string | Initial file content |

### DELETE `/api/filebrowser/delete?rootId={id}&path={rel}`
Delete a file (workspace only).

### POST `/api/filebrowser/rename`
Rename a file or directory. Body: `{ "rootId", "path", "newName" }`

### POST `/api/filebrowser/move`
Move a file or directory. Body: `{ "rootId", "path", "targetPath" }`

### POST `/api/filebrowser/upload`
Upload files (max 20 MB each). Multipart form with `rootId`, `path`, `files`.

### GET `/api/filebrowser/download?rootId={id}&path={rel}`
Download a file as attachment.

### GET `/api/filebrowser/image?rootId={id}&path={rel}`
Serve an image with correct MIME type.

### GET `/api/filebrowser/audio?rootId={id}&path={rel}`
Serve an audio file with Range header support.

### GET `/api/filebrowser/pdf?rootId={id}&path={rel}`
Serve a PDF file.

### POST `/api/folder-picker`
Open native OS folder picker dialog (Windows/macOS/Linux).

---

## Audio

### GET `/api/audio/{filename}`
Serve a cached audio file from `~/.locai/audio/` with Range support.

### GET `/api/audio-files`
List all cached audio files, newest first.

```bash
curl http://localhost:3000/api/audio-files
```

### POST `/api/audio-files/upload`
Upload an audio file (max 100 MB). Accepted: wav, mp3, flac, ogg, m4a.

### POST `/api/audio-files/save-to-workspace`
Copy an audio file from cache to the workspace `audio/` folder.

### POST `/api/ace-step/generate`
Start async music generation via ACE-Step. Returns `taskId`.

| Field | Type | Description |
|-------|------|-------------|
| `task_type` | string | `text2music`, `caption`, `description` |
| `caption` | string | Music description |
| `lyrics` | string | Song lyrics |
| `duration` | number | Duration in seconds |
| `bpm` | number | Beats per minute |
| `batch` | number | Number of outputs |

### POST `/api/ace-step/generate-sync`
Synchronous generation — blocks until audio is ready, returns local URLs.

### POST `/api/ace-step/status/{taskId}`
Poll generation task status.

### POST `/api/ace-step/health`
Check ACE-Step service health. Optional body: `{ "url": "http://..." }`

### POST `/api/ace-step/launch`
Launch ACE-Step process. Body: `{ "aceStepPath": "/path" }`

### POST `/api/qwen-tts/generate`
Generate speech with Qwen TTS.

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | **Required.** Text to speak |
| `language` | string | Language (default: `German`) |
| `mode` | string | `custom` or `clone` |
| `modelSize` | string | `1.7B` (default) |
| `referenceAudio` | string | For clone mode |
| `referenceText` | string | For clone mode |

### POST `/api/qwen-tts/health`
Check Qwen TTS availability.

### POST `/api/qwen-tts/upload`
Upload voice reference audio for cloning (max 50 MB).

### POST `/api/qwen-tts/transcribe`
Transcribe a reference audio file. Body: `{ "filePath": "..." }`

---

## Search

### GET `/api/search?q={query}`
Simple SearXNG web search without AI processing.

| Param | Default | Description |
|-------|---------|-------------|
| `q` | — | **Required.** Search query |
| `searxngUrl` | — | Custom SearXNG instance |
| `language` | `de-DE` | Search language |
| `maxResults` | 8 | Max results |

```bash
curl "http://localhost:3000/api/search?q=nextjs+tutorial"
```

### POST `/api/search`
AI-powered web search with query optimization and content fetching.

| Field | Type | Description |
|-------|------|-------------|
| `question` | string | **Required.** User question |
| `options.model` | string | LLM model (default: `llama3`) |
| `options.optimizeQuery` | boolean | AI query optimization (default: true) |
| `options.fetchContent` | boolean | Fetch full page content (default: true) |

### PUT `/api/search`
Fetch and extract content from a URL. Body: `{ "url": "https://...", "maxLength": 5000 }`

### PATCH `/api/search`
Optimize a search query using AI. Body: `{ "question": "...", "model": "llama3" }`

### POST `/api/search/optimize`
AI-optimize search result snippets with presets (`bullets`, `detailed`, `steps`, `risks`, `compare`).

---

## System

### GET `/api/health`
Health check for Ollama and ComfyUI services.

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-23T00:00:00.000Z",
  "uptime": 3600,
  "services": [
    { "name": "ollama", "status": "ok", "latencyMs": 12, "version": "0.6.2" },
    { "name": "comfyui", "status": "unavailable", "latencyMs": 3001 }
  ]
}
```

### GET `/api/settings`
Get current application settings.

### POST `/api/settings`
Update settings. Only known keys are accepted.

### DELETE `/api/settings`
Reset all settings to defaults.

### GET `/api/models`
List available models across all configured providers. Add `?provider=ollama` to filter.

```bash
curl http://localhost:3000/api/models
```

### GET `/api/system-stats`
Get CPU, RAM, GPU usage and loaded Ollama models.

### GET `/api/ollama/pull`
List popular models available for download.

### POST `/api/ollama/pull`
Pull an Ollama model. Streams NDJSON progress. Body: `{ "model": "llama3" }`

### GET `/api/memory`
List memories. Add `?q=search` for text search.

### POST `/api/memory`
Save a memory entry.

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | **Required.** Memory key |
| `value` | string | **Required.** Memory value |
| `category` | string | **Required.** Category |
| `tags` | string[] | Tags |
| `source` | string | Source identifier |

### DELETE `/api/memory?id={id}`
Delete a memory entry.

### GET `/api/memory/relevant?message={text}&limit=10`
Get context-relevant memories for a given message.

### POST `/api/migrate`
Migrate localStorage data to filesystem stores.

### GET `/api/preferences/favorites`
Load user favorites.

### POST `/api/preferences/favorites`
Save favorites. Body: `{ "favorites": ["id1", "id2"] }`

### GET `/api/preferences/graph`
Load graph visualization settings.

### POST `/api/preferences/graph`
Save graph settings. Body: `{ "settings": {...} }`

### POST `/api/gpu/kill-process`
Kill a GPU process. Body: `{ "pid": 1234 }`. Protected system processes are blocked.

### GET `/api/pdf/license`
Get PDF.js license information.
