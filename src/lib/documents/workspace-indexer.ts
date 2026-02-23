// ============================================================================
// Workspace File Auto-Indexer
// ============================================================================
// Background service to automatically index new files in the workspace
// ============================================================================

import { watch, FSWatcher } from 'fs';
import { readFile, stat, readdir } from 'fs/promises';
import { join, extname, relative } from 'path';
import { createHash } from 'crypto';
import { parseDocument, detectDocumentType } from './parser';
import { chunkDocument } from './chunker';
import { embedQuery } from '../notes/embeddings';
import {
  saveDocument,
  saveDocumentEmbeddings,
  loadDocuments,
  updateDocumentStatus,
  saveUploadedFile,
} from './store';
import {
  Document,
  IndexStatus,
  DocumentType,
} from './types';
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_OLLAMA_HOST,
  MAX_FILE_SIZE,
  MAX_EMBED_TEXT_LENGTH,
} from './constants';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.txt', '.md', '.ts', '.tsx', '.js', '.jsx',
  '.py', '.css', '.html', '.json', '.yaml', '.yml',
  '.c', '.cpp', '.h', '.hpp', '.java', '.go', '.rs',
  '.php', '.rb', '.sh', '.sql', '.xml', '.csv'
]);

const IGNORED_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.next/,
  /\.nuxt/,
  /dist/,
  /build/,
  /\.cache/,
  /\.temp/,
  /\.tmp/,
  /\.DS_Store/,
  /\.env/,
  /\.log$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
];

// ---------------------------------------------------------------------------
// Auto-Indexer Service
// ---------------------------------------------------------------------------

export class WorkspaceIndexer {
  private watchers: FSWatcher[] = [];
  private indexQueue: Set<string> = new Set();
  private isProcessing = false;
  private workspacePaths: string[] = [];
  private enabled = false;

  constructor(workspacePaths: string[] = []) {
    this.workspacePaths = workspacePaths;
  }

  /**
   * Start watching workspace directories for changes
   */
  async start(): Promise<void> {
    if (this.enabled) return;
    
    this.enabled = true;
    console.log('[WorkspaceIndexer] Starting auto-indexer...');

    for (const workspacePath of this.workspacePaths) {
      try {
        await this.startWatchingDirectory(workspacePath);
        console.log(`[WorkspaceIndexer] Watching: ${workspacePath}`);
      } catch (error) {
        console.warn(`[WorkspaceIndexer] Failed to watch ${workspacePath}:`, error);
      }
    }

    // Initial scan of existing files
    await this.scanExistingFiles();
  }

  /**
   * Stop the auto-indexer
   */
  stop(): void {
    if (!this.enabled) return;
    
    this.enabled = false;
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
    this.indexQueue.clear();
    
    console.log('[WorkspaceIndexer] Auto-indexer stopped');
  }

  /**
   * Add a workspace path to watch
   */
  addWorkspacePath(path: string): void {
    if (!this.workspacePaths.includes(path)) {
      this.workspacePaths.push(path);
      if (this.enabled) {
        this.startWatchingDirectory(path);
      }
    }
  }

  /**
   * Remove a workspace path
   */
  removeWorkspacePath(path: string): void {
    const index = this.workspacePaths.indexOf(path);
    if (index > -1) {
      this.workspacePaths.splice(index, 1);
    }
  }

  private async startWatchingDirectory(dirPath: string): Promise<void> {
    const watcher = watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (!filename || !this.enabled) return;
      
      const fullPath = join(dirPath, filename);
      
      // Check if file should be ignored
      if (this.shouldIgnoreFile(fullPath)) return;
      
      // Check if file has supported extension
      if (!this.isSupportedFile(fullPath)) return;
      
      if (eventType === 'rename' || eventType === 'change') {
        this.queueFileForIndexing(fullPath);
      }
    });

    watcher.on('error', (error) => {
      console.error(`[WorkspaceIndexer] Watcher error for ${dirPath}:`, error);
    });

    this.watchers.push(watcher);
  }

  private shouldIgnoreFile(filePath: string): boolean {
    const relativePath = relative(process.cwd(), filePath);
    return IGNORED_PATTERNS.some(pattern => pattern.test(relativePath));
  }

  private isSupportedFile(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  }

  private queueFileForIndexing(filePath: string): void {
    this.indexQueue.add(filePath);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.indexQueue.size === 0) return;
    
    this.isProcessing = true;
    
    try {
      const filesToProcess = Array.from(this.indexQueue);
      this.indexQueue.clear();
      
      for (const filePath of filesToProcess) {
        try {
          await this.indexFile(filePath);
        } catch (error) {
          console.error(`[WorkspaceIndexer] Failed to index ${filePath}:`, error);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async indexFile(filePath: string): Promise<void> {
    try {
      // Check if file exists and is accessible
      const stats = await stat(filePath);
      
      if (!stats.isFile()) return;
      if (stats.size > MAX_FILE_SIZE) {
        console.warn(`[WorkspaceIndexer] File too large: ${filePath} (${stats.size} bytes)`);
        return;
      }
      
      // Read file content
      const buffer = await readFile(filePath);
      const filename = relative(process.cwd(), filePath);
      const contentHash = createHash('sha256').update(buffer).digest('hex');
      
      // Check if file is already indexed with same content
      const existingDocs = await loadDocuments();
      const existing = existingDocs.find(doc => 
        doc.name === filename && doc.contentHash === contentHash
      );
      
      if (existing) {
        console.log(`[WorkspaceIndexer] File already indexed: ${filename}`);
        return;
      }
      
      // Detect document type
      const mimeType = this.getMimeType(filePath);
      const docType = detectDocumentType(filename, mimeType);
      
      // Generate document ID
      const id = createHash('sha1').update(filePath + Date.now()).digest('hex').slice(0, 12);
      
      // Create document record
      const doc: Document = {
        id,
        name: filename,
        type: docType,
        size: stats.size,
        uploadedAt: new Date().toISOString(),
        indexedAt: null,
        chunkCount: 0,
        status: IndexStatus.Pending,
        contentHash,
      };
      
      console.log(`[WorkspaceIndexer] Indexing workspace file: ${filename}`);
      
      // Save document and file
      await saveDocument(doc);
      await saveUploadedFile(id, filename, buffer);
      await updateDocumentStatus(id, IndexStatus.Indexing);
      
      try {
        // Parse document
        const text = await parseDocument(buffer, filename, mimeType);
        
        // Chunk document
        const chunks = chunkDocument(text, id, docType);
        
        if (chunks.length === 0) {
          throw new Error('Could not chunk document');
        }
        
        // Embed chunks
        for (const chunk of chunks) {
          const truncated = chunk.content.slice(0, MAX_EMBED_TEXT_LENGTH);
          const embedding = await embedQuery(truncated, {
            host: DEFAULT_OLLAMA_HOST,
            model: DEFAULT_EMBEDDING_MODEL,
          });
          chunk.embedding = embedding;
          chunk.model = DEFAULT_EMBEDDING_MODEL;
        }
        
        // Save embeddings
        await saveDocumentEmbeddings(id, chunks, DEFAULT_EMBEDDING_MODEL);
        
        // Update status
        await updateDocumentStatus(id, IndexStatus.Ready, undefined, {
          indexedAt: new Date().toISOString(),
          chunkCount: chunks.length,
        });
        
        console.log(`[WorkspaceIndexer] Successfully indexed: ${filename} (${chunks.length} chunks)`);
      } catch (indexError) {
        const errorMsg = indexError instanceof Error ? indexError.message : 'Indexing failed';
        await updateDocumentStatus(id, IndexStatus.Error, undefined, {
          error: errorMsg,
        });
        console.error(`[WorkspaceIndexer] Failed to index ${filename}:`, errorMsg);
      }
    } catch (error) {
      console.error(`[WorkspaceIndexer] Error processing ${filePath}:`, error);
    }
  }

  private async scanExistingFiles(): Promise<void> {
    if (!this.enabled) return;
    
    console.log('[WorkspaceIndexer] Scanning existing workspace files...');
    
    for (const workspacePath of this.workspacePaths) {
      try {
        await this.scanDirectory(workspacePath);
      } catch (error) {
        console.warn(`[WorkspaceIndexer] Failed to scan ${workspacePath}:`, error);
      }
    }
  }

  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        
        if (this.shouldIgnoreFile(fullPath)) continue;
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath);
        } else if (entry.isFile() && this.isSupportedFile(fullPath)) {
          this.queueFileForIndexing(fullPath);
        }
      }
    } catch (error) {
      console.error(`[WorkspaceIndexer] Error scanning directory ${dirPath}:`, error);
    }
  }

  private getMimeType(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.py': 'text/x-python',
      '.java': 'text/x-java-source',
      '.cpp': 'text/x-c++src',
      '.c': 'text/x-csrc',
      '.h': 'text/x-chdr',
    };
    
    return mimeMap[ext] || 'text/plain';
  }
}

// ---------------------------------------------------------------------------
// Global instance
// ---------------------------------------------------------------------------

let globalIndexer: WorkspaceIndexer | null = null;

export function getWorkspaceIndexer(): WorkspaceIndexer {
  if (!globalIndexer) {
    // Default workspace paths (can be configured)
    const workspacePaths = [
      process.env.LOCAI_WORKSPACE || join(process.cwd(), 'workspace'),
      join(process.cwd(), 'src'),
      join(process.cwd(), 'docs'),
    ];
    
    globalIndexer = new WorkspaceIndexer(workspacePaths);
  }
  
  return globalIndexer;
}

export async function startWorkspaceIndexer(): Promise<void> {
  const indexer = getWorkspaceIndexer();
  await indexer.start();
}

export function stopWorkspaceIndexer(): void {
  const indexer = getWorkspaceIndexer();
  indexer.stop();
}