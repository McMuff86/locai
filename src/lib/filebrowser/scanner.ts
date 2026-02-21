import path from 'path';
import { promises as fs } from 'fs';
import { resolveWorkspacePath, getHomeDir } from '@/lib/settings/store';
import { validatePath } from '@/app/api/_utils/security';
import type { FileEntry, BrowseableRoot, FilePreviewType } from './types';

const MAX_READ_SIZE = 100 * 1024; // 100 KB
const MUTABLE_ROOT_ID = 'workspace';

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.ts', '.tsx', '.js', '.jsx', '.py', '.css',
  '.html', '.yaml', '.yml', '.csv', '.log', '.xml', '.svg', '.sh',
  '.bat', '.ps1', '.cfg', '.ini', '.toml', '.env', '.gitignore',
  '.dockerfile', '.sql', '.r', '.rb', '.go', '.rs', '.java', '.c',
  '.cpp', '.h', '.hpp', '.cs', '.php', '.swift', '.kt', '.lua',
]);

export interface ListDirectoryOptions {
  includeChildCount?: boolean;
}

const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico']);

export function getPreviewType(ext: string): FilePreviewType {
  if (ext === '.md') return 'markdown';
  if (ext === '.json') return 'json';
  if (ext === '.txt' || ext === '.csv' || ext === '.log') return 'text';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (ext === '.pdf') return 'pdf';
  if (TEXT_EXTENSIONS.has(ext)) return 'code';
  return 'binary';
}

export function getLanguageFromExtension(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
    '.py': 'python', '.css': 'css', '.html': 'html', '.xml': 'xml',
    '.yaml': 'yaml', '.yml': 'yaml', '.json': 'json', '.sh': 'bash',
    '.sql': 'sql', '.go': 'go', '.rs': 'rust', '.java': 'java',
    '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp', '.cs': 'csharp',
    '.php': 'php', '.rb': 'ruby', '.swift': 'swift', '.kt': 'kotlin',
    '.lua': 'lua', '.r': 'r', '.svg': 'xml', '.toml': 'toml',
  };
  return map[ext] || 'text';
}

function getRootPath(rootId: string): string {
  const home = getHomeDir();
  switch (rootId) {
    case 'workspace':
      return resolveWorkspacePath();
    case 'locai':
      return home ? path.resolve(home, '.locai') : '';
    case 'documents':
      return home ? path.resolve(home, 'Documents') : '';
    default:
      return '';
  }
}

function getRootPathOrThrow(rootId: string): string {
  const rootPath = getRootPath(rootId);
  if (!rootPath) {
    throw new Error('Unbekannter Root');
  }
  return rootPath;
}

function ensureWorkspaceMutationRoot(rootId: string) {
  if (rootId !== MUTABLE_ROOT_ID) {
    throw new Error('Diese Aktion ist nur im Workspace erlaubt');
  }
}

function sanitizeEntryName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Name darf nicht leer sein');
  }
  if (trimmed === '.' || trimmed === '..') {
    throw new Error('Ungültiger Name');
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    throw new Error('Name darf keine Pfadseparatoren enthalten');
  }
  return trimmed;
}

function toRelativePath(rootId: string, fullPath: string): string {
  return path.relative(getRootPathOrThrow(rootId), fullPath).replace(/\\/g, '/');
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectoryExists(dirPath: string): Promise<void> {
  const stat = await fs.stat(dirPath);
  if (!stat.isDirectory()) {
    throw new Error('Ziel ist kein Verzeichnis');
  }
}

async function ensureDoesNotExist(targetPath: string): Promise<void> {
  if (await pathExists(targetPath)) {
    throw new Error('Ziel existiert bereits');
  }
}

async function buildEntry(rootId: string, entryPath: string, includeChildCount = false): Promise<FileEntry> {
  const stat = await fs.stat(entryPath);
  const isDirectory = stat.isDirectory();

  const entry: FileEntry = {
    name: path.basename(entryPath),
    relativePath: toRelativePath(rootId, entryPath),
    rootId,
    type: isDirectory ? 'directory' : 'file',
    size: isDirectory ? 0 : stat.size,
    modifiedAt: stat.mtime.toISOString(),
    extension: isDirectory ? '' : path.extname(entryPath).toLowerCase(),
  };

  if (isDirectory && includeChildCount) {
    try {
      const children = await fs.readdir(entryPath);
      entry.childCount = children.length;
    } catch {
      entry.childCount = 0;
    }
  }

  return entry;
}

async function resolveValidatedDirectoryPath(rootId: string, relativePath: string): Promise<string> {
  const dirPath = resolveAndValidate(rootId, relativePath || '.');
  if (!dirPath) {
    throw new Error('Ungültiger Pfad');
  }
  await ensureDirectoryExists(dirPath);
  return dirPath;
}

async function findAvailablePath(basePath: string): Promise<string> {
  if (!(await pathExists(basePath))) {
    return basePath;
  }

  const dirName = path.dirname(basePath);
  const extension = path.extname(basePath);
  const name = path.basename(basePath, extension);

  let counter = 1;
  while (counter < 10_000) {
    const candidate = path.join(dirName, `${name} (${counter})${extension}`);
    if (!(await pathExists(candidate))) {
      return candidate;
    }
    counter += 1;
  }

  throw new Error('Konnte keinen freien Dateinamen finden');
}

export async function getBrowseableRoots(): Promise<BrowseableRoot[]> {
  const roots: BrowseableRoot[] = [
    { id: 'workspace', label: 'Agent Workspace', absolutePath: getRootPath('workspace'), exists: false },
    { id: 'locai', label: 'LocAI Daten', absolutePath: getRootPath('locai'), exists: false },
    { id: 'documents', label: 'Dokumente', absolutePath: getRootPath('documents'), exists: false },
  ];

  for (const root of roots) {
    if (!root.absolutePath) continue;
    try {
      const stat = await fs.stat(root.absolutePath);
      root.exists = stat.isDirectory();
    } catch {
      root.exists = false;
    }
  }

  return roots;
}

export function resolveAndValidate(rootId: string, relativePath: string): string | null {
  if (relativePath.includes('\0')) return null;
  if (relativePath.includes('..')) return null;

  const rootPath = getRootPath(rootId);
  if (!rootPath) return null;

  const fullPath = path.resolve(rootPath, relativePath);
  return validatePath(fullPath, rootPath);
}

export async function listDirectory(
  rootId: string,
  relativePath: string,
  options: ListDirectoryOptions = {},
): Promise<FileEntry[]> {
  const dirPath = await resolveValidatedDirectoryPath(rootId, relativePath);

  let dirEntries;
  try {
    dirEntries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new Error('Verzeichnis nicht gefunden');
    if (code === 'EACCES') throw new Error('Zugriff verweigert');
    throw err;
  }

  const includeChildCount = Boolean(options.includeChildCount);

  const entries = await Promise.all(
    dirEntries.map(async (dirent) => {
      if (dirent.name.startsWith('.') && rootId !== 'locai') {
        return null;
      }

      const entryPath = path.join(dirPath, dirent.name);

      try {
        return await buildEntry(rootId, entryPath, includeChildCount);
      } catch {
        return null;
      }
    }),
  );

  const validEntries = entries.filter((entry): entry is FileEntry => entry !== null);

  validEntries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, 'de');
  });

  return validEntries;
}

export async function readFileContent(rootId: string, relativePath: string): Promise<{
  content: string;
  truncated: boolean;
  size: number;
  previewType: FilePreviewType;
  language: string;
}> {
  const filePath = resolveAndValidate(rootId, relativePath);
  if (!filePath) throw new Error('Ungültiger Pfad');

  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) throw new Error('Kann kein Verzeichnis lesen');

  const ext = path.extname(filePath).toLowerCase();
  const previewType = getPreviewType(ext);

  if (previewType === 'binary') {
    throw new Error('Binärdateien können nicht als Text angezeigt werden');
  }

  // Images are served separately via /api/filebrowser/image
  if (previewType === 'image') {
    return {
      content: '',
      truncated: false,
      size: stat.size,
      previewType,
      language: 'text',
    };
  }

  // PDFs are served separately via /api/filebrowser/pdf
  if (previewType === 'pdf') {
    return {
      content: '',
      truncated: false,
      size: stat.size,
      previewType,
      language: 'text',
    };
  }

  const truncated = stat.size > MAX_READ_SIZE;
  const buffer = Buffer.alloc(Math.min(stat.size, MAX_READ_SIZE));
  const fd = await fs.open(filePath, 'r');
  try {
    await fd.read(buffer, 0, buffer.length, 0);
  } finally {
    await fd.close();
  }

  return {
    content: buffer.toString('utf-8'),
    truncated,
    size: stat.size,
    previewType,
    language: getLanguageFromExtension(ext),
  };
}

export async function getFileStream(rootId: string, relativePath: string): Promise<{
  filePath: string;
  fileName: string;
  size: number;
}> {
  const filePath = resolveAndValidate(rootId, relativePath);
  if (!filePath) throw new Error('Ungültiger Pfad');

  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) throw new Error('Kann kein Verzeichnis herunterladen');

  return {
    filePath,
    fileName: path.basename(filePath),
    size: stat.size,
  };
}

export async function deleteFile(rootId: string, relativePath: string): Promise<boolean> {
  ensureWorkspaceMutationRoot(rootId);

  const filePath = resolveAndValidate(rootId, relativePath);
  if (!filePath) throw new Error('Ungültiger Pfad');

  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) {
    throw new Error('Verzeichnisse können nicht gelöscht werden');
  }

  await fs.unlink(filePath);
  return true;
}

export async function createFile(
  rootId: string,
  parentPath: string,
  name: string,
  content = '',
): Promise<FileEntry> {
  ensureWorkspaceMutationRoot(rootId);

  const safeName = sanitizeEntryName(name);
  const directoryPath = await resolveValidatedDirectoryPath(rootId, parentPath);

  const targetPath = path.join(directoryPath, safeName);
  const validatedTarget = validatePath(targetPath, getRootPathOrThrow(rootId));
  if (!validatedTarget) {
    throw new Error('Ungültiger Pfad');
  }

  await ensureDoesNotExist(validatedTarget);
  await fs.writeFile(validatedTarget, content, 'utf-8');

  return buildEntry(rootId, validatedTarget);
}

export async function createDirectory(rootId: string, parentPath: string, name: string): Promise<FileEntry> {
  ensureWorkspaceMutationRoot(rootId);

  const safeName = sanitizeEntryName(name);
  const directoryPath = await resolveValidatedDirectoryPath(rootId, parentPath);

  const targetPath = path.join(directoryPath, safeName);
  const validatedTarget = validatePath(targetPath, getRootPathOrThrow(rootId));
  if (!validatedTarget) {
    throw new Error('Ungültiger Pfad');
  }

  await ensureDoesNotExist(validatedTarget);
  await fs.mkdir(validatedTarget, { recursive: false });

  return buildEntry(rootId, validatedTarget);
}

export async function renameEntry(rootId: string, relativePath: string, newName: string): Promise<FileEntry> {
  ensureWorkspaceMutationRoot(rootId);

  const sourcePath = resolveAndValidate(rootId, relativePath);
  if (!sourcePath) {
    throw new Error('Ungültiger Pfad');
  }

  const safeName = sanitizeEntryName(newName);
  const targetPath = path.join(path.dirname(sourcePath), safeName);

  const validatedTarget = validatePath(targetPath, getRootPathOrThrow(rootId));
  if (!validatedTarget) {
    throw new Error('Ungültiger Pfad');
  }

  if (path.normalize(sourcePath) === path.normalize(validatedTarget)) {
    return buildEntry(rootId, sourcePath);
  }

  await ensureDoesNotExist(validatedTarget);
  await fs.rename(sourcePath, validatedTarget);

  return buildEntry(rootId, validatedTarget);
}

export async function moveEntry(
  rootId: string,
  relativePath: string,
  targetDirectoryPath: string,
): Promise<FileEntry> {
  ensureWorkspaceMutationRoot(rootId);

  const sourcePath = resolveAndValidate(rootId, relativePath);
  if (!sourcePath) {
    throw new Error('Ungültiger Pfad');
  }

  const targetDir = await resolveValidatedDirectoryPath(rootId, targetDirectoryPath);

  const targetPath = path.join(targetDir, path.basename(sourcePath));
  const validatedTarget = validatePath(targetPath, getRootPathOrThrow(rootId));
  if (!validatedTarget) {
    throw new Error('Ungültiger Pfad');
  }

  if (path.normalize(sourcePath) === path.normalize(validatedTarget)) {
    return buildEntry(rootId, sourcePath);
  }

  await ensureDoesNotExist(validatedTarget);
  await fs.rename(sourcePath, validatedTarget);

  return buildEntry(rootId, validatedTarget);
}

export async function saveUploadedFile(
  rootId: string,
  parentPath: string,
  name: string,
  content: Buffer,
): Promise<FileEntry> {
  ensureWorkspaceMutationRoot(rootId);

  const safeName = sanitizeEntryName(name);
  const directoryPath = await resolveValidatedDirectoryPath(rootId, parentPath);

  const basePath = path.join(directoryPath, safeName);
  const validatedBasePath = validatePath(basePath, getRootPathOrThrow(rootId));
  if (!validatedBasePath) {
    throw new Error('Ungültiger Pfad');
  }

  const targetPath = await findAvailablePath(validatedBasePath);
  await fs.writeFile(targetPath, content);

  return buildEntry(rootId, targetPath);
}

/**
 * Overwrites an existing file in the workspace with new content.
 * Only allowed in the workspace root.
 */
export async function writeFileContent(
  rootId: string,
  relativePath: string,
  content: string,
): Promise<FileEntry> {
  ensureWorkspaceMutationRoot(rootId);

  const fullPath = resolveAndValidate(rootId, relativePath);
  if (!fullPath) {
    throw new Error('Ungültiger Pfad');
  }

  let stat;
  try {
    stat = await fs.stat(fullPath);
  } catch {
    throw new Error('Datei nicht gefunden');
  }

  if (stat.isDirectory()) {
    throw new Error('Pfad zeigt auf ein Verzeichnis, keine Datei');
  }

  await fs.writeFile(fullPath, content, 'utf-8');
  return buildEntry(rootId, fullPath);
}

/**
 * Write binary content (base64-encoded) to a file in the workspace.
 */
export async function writeFileBinary(
  rootId: string,
  relativePath: string,
  base64Content: string,
): Promise<FileEntry> {
  ensureWorkspaceMutationRoot(rootId);

  const fullPath = resolveAndValidate(rootId, relativePath);
  if (!fullPath) {
    throw new Error('Ungültiger Pfad');
  }

  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });

  const buffer = Buffer.from(base64Content, 'base64');
  await fs.writeFile(fullPath, buffer);
  return buildEntry(rootId, fullPath);
}

export { TEXT_EXTENSIONS };

