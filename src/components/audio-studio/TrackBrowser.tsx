"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Music, Clock, HardDrive, Search, Tag, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStudioStore } from '@/stores/studioStore';
import { Input } from '@/components/ui/input';

interface AudioFile {
  filename: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Derive tags from filename patterns
function deriveTags(filename: string): string[] {
  const tags: string[] = [];
  const lower = filename.toLowerCase();
  if (lower.includes('tts') || lower.includes('speech') || lower.includes('voice')) tags.push('Sprache');
  if (lower.includes('music') || lower.includes('song') || lower.includes('beat')) tags.push('Musik');
  if (lower.includes('remix')) tags.push('Remix');
  if (lower.includes('repaint')) tags.push('Repaint');
  if (tags.length === 0) tags.push('Audio');
  return tags;
}

interface TrackBrowserProps {
  compact?: boolean;
  onTrackSelected?: () => void;
}

export function TrackBrowser({ compact, onTrackSelected }: TrackBrowserProps) {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const loadTrack = useStudioStore((s) => s.loadTrack);
  const activeTrack = useStudioStore((s) => s.activeTrack);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/audio-files');
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        setFiles(data.files);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Compute available tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    files.forEach(f => deriveTags(f.filename).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [files]);

  // Filter files
  const filteredFiles = useMemo(() => {
    let result = files;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.filename.toLowerCase().includes(q));
    }
    if (activeTag) {
      result = result.filter(f => deriveTags(f.filename).includes(activeTag));
    }
    return result;
  }, [files, searchQuery, activeTag]);

  const handleSelect = useCallback(
    (file: AudioFile) => {
      const url = `/api/audio/${file.filename}`;
      loadTrack(url, file.filename);
      onTrackSelected?.();
    },
    [loadTrack, onTrackSelected],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Music className="h-6 w-6 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">
          Noch keine Audio-Dateien vorhanden.
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          Generiere Musik im &quot;Musik&quot; Tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Search + Tag Filter */}
      {!compact && (
        <div className="space-y-2 px-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-muted/30 border-border/30 rounded-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {allTags.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                    activeTag === tag
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 border border-transparent'
                  }`}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File List */}
      <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
        <AnimatePresence mode="popLayout">
          {filteredFiles.map((file, i) => {
            const isActive = activeTrack?.url === `/api/audio/${file.filename}`;
            const tags = deriveTags(file.filename);
            return (
              <motion.button
                key={file.filename}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => handleSelect(file)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'hover:bg-muted/40 text-foreground/70 hover:text-foreground/90 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Music className={`h-3 w-3 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground/40'}`} />
                  <p className="font-mono text-[11px] truncate leading-tight flex-1">
                    {file.filename}
                  </p>
                </div>
                {!compact && (
                  <div className="flex items-center gap-3 mt-1 ml-5">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                      <HardDrive className="h-2.5 w-2.5" />
                      {formatSize(file.size)}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDate(file.createdAt)}
                    </span>
                    {tags.map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground/60">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
        {filteredFiles.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-4">
            Keine Ergebnisse
          </p>
        )}
      </div>
    </div>
  );
}
