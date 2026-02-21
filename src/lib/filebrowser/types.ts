export interface FileEntry {
  name: string;
  relativePath: string;
  rootId: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
  extension: string;
  childCount?: number;
}

export interface BrowseableRoot {
  id: string;
  label: string;
  absolutePath: string;
  exists: boolean;
}

export type FilePreviewType = 'text' | 'code' | 'markdown' | 'json' | 'binary' | 'image' | 'pdf';
