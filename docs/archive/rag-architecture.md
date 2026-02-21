# RAG Architecture – LocAI Document Chat

> Version: 1.0 | Sprint A | 2026-02-08

## Overview

LocAI's RAG (Retrieval-Augmented Generation) system enables users to chat with their own documents. Files are uploaded, chunked, and embedded locally via Ollama. When a user asks a question, the system retrieves the most relevant chunks via semantic search and injects them as context into the LLM prompt — all running entirely on local hardware.

---

## High-Level Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                       INGESTION PIPELINE                        │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────────┐ │
│  │  Upload   │───▶│  Parse   │───▶│  Chunk   │───▶│  Embed     │ │
│  │  (File)   │    │  (Text)  │    │  (Split) │    │  (Vectors) │ │
│  └──────────┘    └──────────┘    └──────────┘    └─────┬──────┘ │
│                                                        │        │
│                                              ┌─────────▼──────┐ │
│                                              │ JSONL Store    │ │
│                                              │ + Metadata     │ │
│                                              └─────────┬──────┘ │
└────────────────────────────────────────────────────────┼────────┘
                                                         │
┌────────────────────────────────────────────────────────┼────────┐
│                       RAG PIPELINE                     │        │
│                                                        ▼        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  User     │───▶│  Embed   │───▶│  Search  │───▶│  Inject  │  │
│  │  Query    │    │  Query   │    │  Top-K   │    │  Context │  │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘  │
│                                                       │         │
│                                                  ┌────▼─────┐  │
│                                                  │  Ollama   │  │
│                                                  │  Chat LLM │  │
│                                                  └────┬─────┘  │
│                                                       │         │
│                                                  ┌────▼─────┐  │
│                                                  │ Response  │  │
│                                                  │ + Sources │  │
│                                                  └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Document Processing (`src/lib/documents/`)

| File            | Responsibility                                           |
|-----------------|----------------------------------------------------------|
| `types.ts`      | Core interfaces: `Document`, `DocumentChunk`, `RAGContext`, `SearchOptions`, etc. |
| `constants.ts`  | Configuration: supported MIME types, file extensions, chunk sizes, limits, defaults |
| `parser.ts`     | Extract plain text from uploaded files (PDF, TXT, MD, Code, DOCX) |
| `chunker.ts`    | Split extracted text into overlapping chunks (paragraph-aware, code-aware) |
| `store.ts`      | Manage document metadata (`documents.json`) and embeddings (`document-embeddings.jsonl`) |

### 2. Existing Embedding Infrastructure (`src/lib/notes/`)

| File             | Responsibility                                          |
|------------------|---------------------------------------------------------|
| `embeddings.ts`  | Core embedding functions: `chunkText()`, `cosineSimilarity()`, `embedQuery()`, `loadEmbeddings()` |

The document RAG system builds on the same patterns established for note embeddings — same JSONL storage format, same chunking approach, same Ollama embedding API.

### 3. API Routes (`src/app/api/documents/`)

| Endpoint                         | Method   | Purpose                              |
|----------------------------------|----------|--------------------------------------|
| `/api/documents/upload`          | `POST`   | Upload file, parse, chunk, embed     |
| `/api/documents`                 | `GET`    | List all indexed documents           |
| `/api/documents/[id]`            | `DELETE` | Remove document + its embeddings     |
| `/api/documents/search`          | `POST`   | Semantic search across all documents |

### 4. RAG Pipeline (`src/lib/documents/rag.ts`)

| File       | Responsibility                                            |
|------------|-----------------------------------------------------------|
| `rag.ts`   | Orchestrate: query embedding → search → context assembly  |

### 5. UI Components (`src/components/documents/`)

| Component            | Responsibility                                   |
|----------------------|--------------------------------------------------|
| Document Manager     | Upload panel, document list, delete actions       |
| RAG Indicator        | Badge showing when RAG context is active in chat  |
| Source Citations     | Display which documents/chunks were used          |

---

## Embedding Pipeline (Ingestion)

### Step-by-step

1. **Upload**: User uploads a file via the Document Manager UI or API.
2. **Type Detection**: File extension is mapped to a `DocumentType` using `EXTENSION_TO_TYPE`.
3. **Parsing**: The parser extracts plain text based on type:
   - **PDF** → `pdf-parse` library
   - **TXT** → read as-is
   - **MD/MDX** → read as-is (markdown preserved for context)
   - **Code** → read as-is (language-aware chunking applied later)
   - **DOCX** → Not yet implemented (planned for a future sprint)
4. **Chunking**: Text is split into overlapping chunks using type-specific configuration:
   - Default: 500 chars, 80 char overlap
   - Code: 400 chars, 60 char overlap
   - Code-aware splitting respects function/class boundaries where possible
5. **Embedding**: Each chunk is sent to Ollama's `/api/embeddings` endpoint using `nomic-embed-text` (768 dimensions).
6. **Storage**: Embeddings are appended to `document-embeddings.jsonl`. Document metadata is saved to `documents.json`.

### Chunk Configuration

| Document Type | Chunk Size (chars) | Overlap (chars) |
|---------------|-------------------|-----------------|
| PDF           | 500               | 80              |
| TXT           | 500               | 80              |
| MD            | 500               | 80              |
| Code          | 400               | 60              |
| DOCX          | 500               | 80              |

---

## RAG Pipeline (Query → Search → Inject → Respond)

### Step-by-step

1. **Query**: User sends a chat message with RAG mode enabled.
2. **Embed Query**: The user's question is embedded using the same model (`nomic-embed-text`).
3. **Search**: The query vector is compared against all stored document chunk vectors using cosine similarity.
4. **Top-K Selection**: The top K most similar chunks are selected (default: 5, threshold: 0.3).
5. **Context Assembly**: Selected chunks are formatted into a `RAGContext` object containing:
   - The chunk texts
   - Source document metadata
   - The original query
6. **Prompt Injection**: The RAG context is prepended to the system message as additional context:
   ```
   The following document excerpts are relevant to the user's question:

   [Source: document-name.pdf, Chunk 3]
   <chunk text>

   [Source: notes.md, Chunk 1]
   <chunk text>

   Use these excerpts to inform your answer. Cite the sources when relevant.
   ```
7. **LLM Response**: Ollama generates a response with the enriched context.
8. **Citations**: The response includes source references so the user knows which documents contributed.

### Search Parameters

| Parameter    | Default | Description                                  |
|-------------|---------|----------------------------------------------|
| `topK`      | 5       | Maximum number of chunks returned            |
| `threshold` | 0.3     | Minimum cosine similarity score (0–1)        |
| `documentIds` | —     | Optional filter: only search specific docs   |
| `types`     | —       | Optional filter: only search specific types  |

---

## Storage Format

### Document Metadata (`documents.json`)

A JSON file containing an array of `Document` objects:

```json
[
  {
    "id": "abc123",
    "name": "report.pdf",
    "type": "pdf",
    "size": 245760,
    "uploadedAt": "2026-02-08T10:00:00.000Z",
    "indexedAt": "2026-02-08T10:00:15.000Z",
    "chunkCount": 42,
    "status": "ready",
    "contentHash": "sha256:..."
  }
]
```

### Document Embeddings (`document-embeddings.jsonl`)

One JSON object per line (JSONL format). Each line represents a single chunk with its embedding vector:

```jsonl
{"id":"abc123#0","documentId":"abc123","chunk":"This is the first chunk...","embedding":[0.012,-0.034,...],"model":"nomic-embed-text","createdAt":"2026-02-08T10:00:05.000Z"}
{"id":"abc123#1","documentId":"abc123","chunk":"This is the second chunk...","embedding":[0.045,-0.012,...],"model":"nomic-embed-text","createdAt":"2026-02-08T10:00:06.000Z"}
```

**Why JSONL?**
- Simple, no database dependency (fits LocAI's local-first philosophy)
- Easy to append, read line-by-line, and filter
- Human-debuggable
- Performant for up to ~10k chunks (loaded into memory for search)

### Uploaded Files (`uploads/`)

Original files are stored in the `uploads/` subdirectory under the data path, named by their document ID.

---

## Supported File Types

| Type   | Extensions                                                      | Parser            |
|--------|-----------------------------------------------------------------|-------------------|
| PDF    | `.pdf`                                                          | `pdf-parse`       |
| Text   | `.txt`                                                          | Native (fs.read)  |
| Markdown | `.md`, `.mdx`                                                 | Native (fs.read)  |
| Code   | `.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.java`, `.c`, `.cpp`, `.h`, `.hpp`, `.rs`, `.go`, `.rb`, `.php`, `.swift`, `.kt`, `.cs`, `.css`, `.html`, `.xml`, `.json`, `.yaml`, `.yml`, `.toml`, `.sh`, `.bash`, `.zsh`, `.sql`, `.dockerfile`, `.vue`, `.svelte` | Native (fs.read) |
| DOCX   | `.docx`                                                         | Planned (not yet) |

### Limits

| Limit                     | Value    |
|---------------------------|----------|
| Max file size             | 20 MB    |
| Max chunks per document   | 2,000    |
| Max documents             | 500      |
| Max embed text length     | 8,000 chars |
| Embed timeout             | 120 s    |

---

## Embedding Model

| Property    | Value                |
|-------------|----------------------|
| Model       | `nomic-embed-text`   |
| Dimensions  | 768                  |
| VRAM        | ~270 MB              |
| Languages   | English, German, multilingual |
| Alternative | `mxbai-embed-large` (1024 dims) |

---

## Security Considerations

- **Path validation**: All file paths are validated to prevent directory traversal attacks.
- **File size limits**: Enforced at upload to prevent resource exhaustion.
- **Content hashing**: SHA-256 hash enables deduplication and change detection.
- **No external calls**: All processing happens locally via Ollama.
- **Sandboxed storage**: Documents are stored in a dedicated directory, not mixed with application code.

---

## Future Improvements (Post-Sprint A)

- **SQLite + sqlite-vss**: Vector search extension for better performance at scale (>10k chunks)
- **Batch embedding**: Process multiple chunks in parallel
- **Incremental re-indexing**: Only re-embed changed chunks when a document is updated
- **OCR support**: Extract text from scanned PDFs
- **Conversation-aware RAG**: Use chat history as additional search context
