"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Folder, 
  Play, 
  Square, 
  Plus, 
  Minus, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WorkspaceIndexerStatus {
  status: 'running' | 'stopped';
  workspacePaths: string[];
}

interface WorkspaceIndexerProps {
  className?: string;
}

export function WorkspaceIndexer({ className }: WorkspaceIndexerProps) {
  const [status, setStatus] = useState<WorkspaceIndexerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load initial status
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/documents/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });

      if (!response.ok) throw new Error('Failed to load status');
      
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (action: string, path?: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/documents/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, path }),
      });

      if (!response.ok) throw new Error('Action failed');
      
      const data = await response.json();
      
      // Update status
      if (action === 'start') {
        setStatus(prev => prev ? { ...prev, status: 'running' } : null);
      } else if (action === 'stop') {
        setStatus(prev => prev ? { ...prev, status: 'stopped' } : null);
      } else if (action === 'add-path' && data.workspacePaths) {
        setStatus(prev => prev ? { ...prev, workspacePaths: data.workspacePaths } : null);
        setNewPath('');
      } else if (action === 'remove-path' && data.workspacePaths) {
        setStatus(prev => prev ? { ...prev, workspacePaths: data.workspacePaths } : null);
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => performAction('start');
  const handleStop = () => performAction('stop');
  const handleAddPath = () => {
    if (newPath.trim()) {
      performAction('add-path', newPath.trim());
    }
  };
  const handleRemovePath = (path: string) => performAction('remove-path', path);

  if (!status) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg",
                status.status === 'running' ? 'bg-green-500/10' : 'bg-muted/50'
              )}>
                <FolderOpen className={cn(
                  'h-5 w-5',
                  status.status === 'running' ? 'text-green-500' : 'text-muted-foreground'
                )} />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Workspace Auto-Index</CardTitle>
                <CardDescription>
                  Automatische Indizierung von Workspace-Dateien
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge 
                variant={status.status === 'running' ? 'default' : 'secondary'}
                className={cn(
                  status.status === 'running' && 'bg-green-500/20 text-green-400 border-green-500/30'
                )}
              >
                {status.status === 'running' ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Aktiv
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Gestoppt
                  </>
                )}
              </Badge>
              
              <Button
                variant={status.status === 'running' ? 'destructive' : 'default'}
                size="sm"
                onClick={status.status === 'running' ? handleStop : handleStart}
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : status.status === 'running' ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {status.status === 'running' ? 'Stop' : 'Start'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Workspace Paths */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground/90">Überwachte Verzeichnisse</h4>
            <div className="space-y-2">
              {status.workspacePaths.map((path, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-2 rounded-md border border-border/30 bg-muted/20"
                >
                  <Folder className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-mono flex-1 truncate">{path}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePath(path)}
                    disabled={loading}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              
              {status.workspacePaths.length === 0 && (
                <div className="text-sm text-muted-foreground italic text-center py-4">
                  Keine Verzeichnisse konfiguriert
                </div>
              )}
            </div>
          </div>

          {/* Add New Path */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground/90">Verzeichnis hinzufügen</h4>
            <div className="flex gap-2">
              <Input
                placeholder="/path/to/workspace"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddPath();
                  }
                }}
                className="flex-1 font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddPath}
                disabled={loading || !newPath.trim()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground border-t border-border/30 pt-3">
            <p>
              Der Auto-Indexer überwacht die konfigurierten Verzeichnisse und indiziert automatisch 
              neue oder geänderte Dateien (PDF, Markdown, Text, Code). 
              Indizierte Dateien stehen sofort als Kontext im Chat zur Verfügung.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}