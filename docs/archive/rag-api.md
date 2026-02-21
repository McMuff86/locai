# RAG Document API Reference

> Version: 1.0 | Sprint A | 2026-02-08

Base URL: `http://localhost:3000` (default Next.js dev server)

---

## Endpoints Overview

| Method   | Path                         | Description                                 |
|----------|------------------------------|---------------------------------------------|
| `POST`   | `/api/documents/upload`      | Upload, parse, chunk, and embed a document  |
| `GET`    | `/api/documents`             | List all indexed documents                  |
| `GET`    | `/api/documents/[id]`        | Get document details + chunk previews       |
| `DELETE` | `/api/documents?id=xxx`      | Delete a document (via query param)         |
| `DELETE` | `/api/documents/[id]`        | Delete a specific document (via path param) |
| `POST`   | `/api/documents/search`      | Semantic search across all documents        |

---

## POST `/api/documents/upload`

Upload a file, parse its content, chunk it, and generate embeddings. The full ingestion pipeline runs synchronously — the response includes the final indexed document.

### Request

- **Content-Type:** `multipart/form-data`
- **Body:**

| Field          | Type     | Required | Description                                                 |
|----------------|----------|----------|-------------------------------------------------------------|
| `file`         | File     | ✅       | The document file to upload                                |
| `model`        | string   | ❌       | Embedding model (default: `nomic-embed-text`)              |
| `host`         | string   | ❌       | Ollama host URL (default: `http://localhost:11434`)         |
| `chunkSize`    | string   | ❌       | Custom chunk size in characters (parsed to int)            |
| `chunkOverlap` | string   | ❌       | Custom chunk overlap in characters (parsed to int)         |

### Response

**Success (200):**

```json
{
  "success": true,
  "document": {
    "id": "abc123def456",
    "name": "report.pdf",
    "type": "pdf",
    "size": 245760,
    "uploadedAt": "2026-02-08T10:00:00.000Z",
    "indexedAt": "2026-02-08T10:00:15.000Z",
    "chunkCount": 42,
    "status": "ready",
    "contentHash": "e3b0c44298fc1c149afbf4c8996fb924..."
  }
}
```

### Errors

| Status | Code | Reason                                                      |
|--------|------|-------------------------------------------------------------|
| 400    |      | No file provided or file too large (>20 MB)                 |
| 409    |      | Duplicate: file with same content hash already uploaded      |
| 500    |      | Indexing failed (Ollama not running, parsing error, etc.)    |

**Error with partial success (500):** If the file was uploaded but indexing failed, the response includes the document metadata with `status: "error"`:

```json
{
  "success": false,
  "error": "Datei hochgeladen, aber Indexierung fehlgeschlagen: Ollama Timeout",
  "document": {
    "id": "abc123def456",
    "name": "report.pdf",
    "status": "error",
    "error": "Ollama Timeout"
  }
}
```

### Example

```bash
# Upload a PDF
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@./my-report.pdf"

# Upload with custom chunk size
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@./main.py" \
  -F "chunkSize=300" \
  -F "chunkOverlap=50"

# Upload with a different embedding model
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@./notes.md" \
  -F "model=mxbai-embed-large"
```

---

## GET `/api/documents`

List all indexed documents, sorted by upload date (newest first).

### Request

No parameters required.

### Response

**Success (200):**

```json
{
  "success": true,
  "documents": [
    {
      "id": "abc123def456",
      "name": "report.pdf",
      "type": "pdf",
      "size": 245760,
      "uploadedAt": "2026-02-08T10:00:00.000Z",
      "indexedAt": "2026-02-08T10:00:15.000Z",
      "chunkCount": 42,
      "status": "ready",
      "contentHash": "e3b0c44298fc..."
    }
  ],
  "count": 1
}
```

### Example

```bash
curl http://localhost:3000/api/documents
```

---

## GET `/api/documents/[id]`

Get full details for a specific document, including chunk previews.

### Request

- **Path parameter:** `id` — document ID

### Response

**Success (200):**

```json
{
  "success": true,
  "document": {
    "id": "abc123def456",
    "name": "report.pdf",
    "type": "pdf",
    "size": 245760,
    "uploadedAt": "2026-02-08T10:00:00.000Z",
    "indexedAt": "2026-02-08T10:00:15.000Z",
    "chunkCount": 42,
    "status": "ready",
    "contentHash": "e3b0c44298fc..."
  },
  "chunks": [
    {
      "id": "abc123def456#0",
      "preview": "This is the first 200 characters of the chunk...",
      "model": "nomic-embed-text",
      "createdAt": "2026-02-08T10:00:05.000Z"
    }
  ],
  "embeddingCount": 42
}
```

### Errors

| Status | Reason                |
|--------|-----------------------|
| 404    | Document not found    |
| 500    | Internal server error |

### Example

```bash
curl http://localhost:3000/api/documents/abc123def456
```

---

## DELETE `/api/documents?id=xxx`

Remove a document using a query parameter. This is the handler on the `/api/documents` route.

### Request

- **Query parameter:** `id` — document ID to delete

### Response

**Success (200):**

```json
{
  "success": true,
  "id": "abc123def456"
}
```

### Errors

| Status | Reason                            |
|--------|-----------------------------------|
| 400    | Missing `id` query parameter      |
| 404    | Document not found                |
| 500    | Failed to delete                  |

### Example

```bash
curl -X DELETE "http://localhost:3000/api/documents?id=abc123def456"
```

---

## DELETE `/api/documents/[id]`

Remove a document using a path parameter. This is the handler on the `/api/documents/[id]` route.

### Request

- **Path parameter:** `id` — document ID to delete

### Response

**Success (200):**

```json
{
  "success": true,
  "id": "abc123def456"
}
```

### Errors

| Status | Reason                |
|--------|-----------------------|
| 404    | Document not found    |
| 500    | Failed to delete      |

### Example

```bash
curl -X DELETE http://localhost:3000/api/documents/abc123def456
```

---

## POST `/api/documents/search`

Perform semantic search across all indexed documents. Returns the most relevant chunks ranked by cosine similarity.

### Request

- **Content-Type:** `application/json`
- **Body:**

| Field          | Type       | Required | Description                                       |
|----------------|------------|----------|---------------------------------------------------|
| `query`        | string     | ✅       | Search query (min. 2 characters)                  |
| `topK`         | number     | ❌       | Max results to return (default: 5)                |
| `threshold`    | number     | ❌       | Min similarity score 0–1 (default: 0.3)           |
| `documentIds`  | string[]   | ❌       | Filter: only search specific documents            |
| `types`        | string[]   | ❌       | Filter: only search specific document types       |
| `model`        | string     | ❌       | Embedding model (default: `nomic-embed-text`)     |
| `host`         | string     | ❌       | Ollama host URL (default: `http://localhost:11434`)|

### Response

**Success (200):**

```json
{
  "success": true,
  "results": [
    {
      "chunk": {
        "id": "abc123def456#7",
        "documentId": "abc123def456",
        "content": "The quarterly revenue increased by 15%...",
        "index": 7,
        "createdAt": "2026-02-08T10:00:08.000Z"
      },
      "document": {
        "id": "abc123def456",
        "name": "report.pdf",
        "type": "pdf",
        "size": 245760,
        "uploadedAt": "2026-02-08T10:00:00.000Z",
        "indexedAt": "2026-02-08T10:00:15.000Z",
        "chunkCount": 42,
        "status": "ready",
        "contentHash": "e3b0c44298fc..."
      },
      "score": 0.847
    }
  ],
  "count": 1,
  "query": "What was the revenue growth?"
}
```

### Errors

| Status | Reason                                            |
|--------|---------------------------------------------------|
| 400    | Missing or too short `query` (min. 2 characters)  |
| 500    | Embedding generation failed or store error         |

### Example

```bash
# Basic search
curl -X POST http://localhost:3000/api/documents/search \
  -H "Content-Type: application/json" \
  -d '{"query": "What was the revenue growth?"}'

# Filtered search
curl -X POST http://localhost:3000/api/documents/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication flow",
    "topK": 10,
    "threshold": 0.5,
    "types": ["code", "md"]
  }'

# Search within specific documents
curl -X POST http://localhost:3000/api/documents/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "error handling",
    "documentIds": ["abc123def456"],
    "topK": 3
  }'
```

---

## Common Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

---

## Prerequisites

- **Ollama must be running** (`http://localhost:11434` by default) for upload and search endpoints.
- The default embedding model must be available: `ollama pull nomic-embed-text`
- All data is stored locally — no external services required.

## Limits

| Constraint                | Value           |
|---------------------------|-----------------|
| Max file size per upload  | 20 MB           |
| Max documents             | 500             |
| Max chunks per document   | 2,000           |
| Min search query length   | 2 characters    |
| Embedding timeout         | 120 seconds     |
