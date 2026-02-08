import path from 'path';
import { promises as fs } from 'fs';
import { resolveWorkspacePath, getHomeDir } from '@/lib/settings/store';
import { validatePath } from '@/app/api/_utils/security';
import type { FileEntry, BrowseableRoot, FilePreviewType } from './types';

const MAX_READ_SIZE = 100 * 1024; // 100 KB

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.ts', '.tsx', '.js', '.jsx', '.py', '.css',
  '.html', '.yaml', '.yml', '.csv', '.log', '.xml', '.svg', '.sh',
  '.bat', '.ps1', '.cfg', '.ini', '.toml', '.env', '.gitignore',
  '.dockerfile', '.sql', '.r', '.rb', '.go', '.rs', '.java', '.c',
  '.cpp', '.h', '.hpp', '.cs', '.php', '.swift', '.kt', '.lua',
]);

function getPreviewType(ext: string): FilePreviewType {
  if (ext === '.md') return 'markdown';
  if (ext === '.json') return 'json';
  if (ext === '.txt' || ext === '.csv' || ext === '.log') return 'text';
  if (TEXT_EXTENSIONS.has(ext)) return 'code';
  return 'binary';
}

function getLanguageFromExtension(ext: string): string {
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

export async function listDirectory(rootId: string, relativePath: string): Promise<FileEntry[]> {
  const dirPath = resolveAndValidate(rootId, relativePath || '.');
  if (!dirPath) throw new Error('Ungültiger Pfad');

  let dirEntries;
  try {
    dirEntries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new Error('Verzeichnis nicht gefunden');
    if (code === 'EACCES') throw new Error('Zugriff verweigert');
    throw err;
  }

  const entries: FileEntry[] = [];

  for (const dirent of dirEntries) {
    // Skip hidden files/dirs (starting with .)
    if (dirent.name.startsWith('.') && rootId !== 'locai') continue;

    const entryPath = path.join(dirPath, dirent.name);
    const relPath = path.relative(getRootPath(rootId), entryPath).replace(/\\/g, '/');

    try {
      const stat = await fs.stat(entryPath);
      const ext = dirent.isDirectory() ? '' : path.extname(dirent.name).toLowerCase();

      const entry: FileEntry = {
        name: dirent.name,
        relativePath: relPath,
        rootId,
        type: dirent.isDirectory() ? 'directory' : 'file',
        size: dirent.isDirectory() ? 0 : stat.size,
        modifiedAt: stat.mtime.toISOString(),
        extension: ext,
      };

      if (dirent.isDirectory()) {
        try {
          const children = await fs.readdir(entryPath);
          entry.childCount = children.length;
        } catch {
          entry.childCount = 0;
        }
      }

      entries.push(entry);
    } catch {
      // Skip entries we can't stat
    }
  }

  // Sort: directories first, then files, both alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, 'de');
  });

  return entries;
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
  if (rootId !== 'workspace') {
    throw new Error('Löschen ist nur im Workspace erlaubt');
  }

  const filePath = resolveAndValidate(rootId, relativePath);
  if (!filePath) throw new Error('Ungültiger Pfad');

  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) {
    throw new Error('Verzeichnisse können nicht gelöscht werden');
  }

  await fs.unlink(filePath);
  return true;
}

export { TEXT_EXTENSIONS, getPreviewType, getLanguageFromExtension };
