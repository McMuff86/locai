// ============================================================================
// Document Parser
// ============================================================================
// Extracts plain text from uploaded files (PDF, TXT, MD, Code).
// Uses pdf-parse for PDF extraction, direct Buffer→string for text formats.
// ============================================================================

import { DocumentType } from './types';
import { EXTENSION_TO_TYPE } from './constants';
import path from 'path';

// ---------------------------------------------------------------------------
// Language detection for code files
// ---------------------------------------------------------------------------

const EXTENSION_LANGUAGE: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript (JSX)',
  '.ts': 'typescript',
  '.tsx': 'typescript (TSX)',
  '.py': 'python',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'c++',
  '.h': 'c header',
  '.hpp': 'c++ header',
  '.rs': 'rust',
  '.go': 'go',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.cs': 'c#',
  '.css': 'css',
  '.html': 'html',
  '.xml': 'xml',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.sh': 'shell',
  '.bash': 'bash',
  '.zsh': 'zsh',
  '.sql': 'sql',
  '.dockerfile': 'dockerfile',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

/**
 * Detect the programming language from a filename's extension.
 *
 * @param filename  The original filename (e.g., "main.py")
 * @returns Language name string (e.g., "python") or "plaintext" if unknown
 */
function detectLanguage(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return EXTENSION_LANGUAGE[ext] || 'plaintext';
}

// ---------------------------------------------------------------------------
// Detect DocumentType from filename and MIME type
// ---------------------------------------------------------------------------

/**
 * Detect the {@link DocumentType} from a filename and MIME type.
 * Prefers extension-based detection; falls back to MIME type matching.
 *
 * @param filename  Original filename (e.g., "report.pdf")
 * @param mimeType  MIME type reported by the browser/client
 * @returns The detected {@link DocumentType}
 */
export function detectDocumentType(
  filename: string,
  mimeType: string,
): DocumentType {
  // Extension-based detection (preferred)
  const ext = path.extname(filename).toLowerCase();
  if (ext && EXTENSION_TO_TYPE[ext]) {
    return EXTENSION_TO_TYPE[ext];
  }

  // MIME-based fallback
  if (mimeType === 'application/pdf') return DocumentType.PDF;
  if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown')
    return DocumentType.MD;
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return DocumentType.DOCX;
  if (mimeType.startsWith('text/')) return DocumentType.TXT;

  // Default
  return DocumentType.TXT;
}

// ---------------------------------------------------------------------------
// PDF Parsing
// ---------------------------------------------------------------------------

/**
 * Extract plain text from a PDF file buffer using `pdf-parse`.
 * Throws if the PDF contains no extractable text (e.g., scanned images).
 *
 * @param buffer  Raw PDF file content
 * @returns Extracted text content
 * @throws Error if parsing fails or no text is found
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const pdf = new PDFParse({ data: buffer });
    const result = await pdf.getText();

    // result.text contains the full concatenated text
    const text = result.text ?? '';

    if (!text || text.trim().length === 0) {
      throw new Error(
        'PDF enthält keinen extrahierbaren Text (möglicherweise ein gescanntes Dokument)',
      );
    }

    await pdf.destroy();
    return text;
  } catch (err) {
    if (err instanceof Error && err.message.includes('keinen extrahierbaren')) {
      throw err;
    }
    throw new Error(
      `PDF-Parsing fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Text / Markdown parsing
// ---------------------------------------------------------------------------

/**
 * Extract plain text from a TXT or Markdown file buffer.
 *
 * @param buffer  Raw file content
 * @returns UTF-8 text content
 * @throws Error if the file is empty
 */
function parseText(buffer: Buffer): string {
  const text = buffer.toString('utf-8');
  if (!text || text.trim().length === 0) {
    throw new Error('Datei ist leer');
  }
  return text;
}

// ---------------------------------------------------------------------------
// Code parsing – wraps content with language metadata
// ---------------------------------------------------------------------------

/**
 * Extract text from a code file, prefixed with language and filename metadata.
 * The metadata prefix helps the embedding model understand the code context.
 *
 * @param buffer    Raw file content
 * @param filename  Original filename (used for language detection)
 * @returns Code text prefixed with `[Language: ...] [File: ...]`
 * @throws Error if the file is empty
 */
function parseCode(buffer: Buffer, filename: string): string {
  const raw = buffer.toString('utf-8');
  if (!raw || raw.trim().length === 0) {
    throw new Error('Code-Datei ist leer');
  }

  const language = detectLanguage(filename);
  // Prefix with language info so the chunker / embedder knows the context
  return `[Language: ${language}] [File: ${filename}]\n\n${raw}`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse an uploaded file buffer into plain text.
 *
 * @param file      Raw file content as Buffer
 * @param filename  Original filename (used for type detection)
 * @param mimeType  MIME type as reported by the client
 * @returns Extracted plain text ready for chunking
 */
export async function parseDocument(
  file: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  if (!file || file.length === 0) {
    throw new Error('Leere Datei erhalten');
  }

  const type = detectDocumentType(filename, mimeType);

  switch (type) {
    case DocumentType.PDF:
      return parsePDF(file);

    case DocumentType.MD:
    case DocumentType.TXT:
      return parseText(file);

    case DocumentType.CODE:
      return parseCode(file, filename);

    case DocumentType.DOCX:
      // DOCX support is a future enhancement – for now, attempt plain text extraction
      throw new Error(
        'DOCX-Unterstützung kommt bald. Bitte als PDF oder TXT hochladen.',
      );

    default:
      return parseText(file);
  }
}
