"use client";

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface NoteAIActionsProps {
  basePath?: string;
  host?: string;
  content: string;
  selectedNoteId: string | null;
  model: string;
  installedModels: string[];
  onModelChange: (model: string) => void;
  onApplyResult: (mode: 'append' | 'replace', result: string) => void;
}

export function NoteAIActions({
  basePath,
  host,
  content,
  selectedNoteId,
  model,
  installedModels,
  onModelChange,
  onApplyResult,
}: NoteAIActionsProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<'complete' | 'summarize'>('complete');
  const [error, setError] = useState<string | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  const stopAi = useCallback(() => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setAiLoading(false);
  }, []);

  const runAi = async (action: 'complete' | 'summarize') => {
    if (!basePath) {
      setError('Bitte zuerst den Notizen-Pfad setzen.');
      return;
    }
    if (!model.trim()) {
      setError('Bitte ein Modell auswählen.');
      return;
    }
    if (!content.trim()) {
      setError('Für KI-Aktionen wird Inhalt benötigt.');
      return;
    }
    
    // Cancel any existing request
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    
    // Create new abort controller
    const abortController = new AbortController();
    aiAbortControllerRef.current = abortController;
    
    setAiLoading(true);
    setAiAction(action);
    setAiResult('');
    setError(null);
    
    try {
      const res = await fetch('/api/notes/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePath,
          noteId: selectedNoteId || undefined,
          content,
          action,
          model,
          host,
        }),
        signal: abortController.signal,
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Fehler bei der KI-Aktion');
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('Stream nicht verfügbar');
      }

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        if (abortController.signal.aborted) {
          reader.cancel();
          break;
        }
        
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const jsonStr = line.replace('data: ', '');
            const data = JSON.parse(jsonStr);
            
            if (data.token) {
              accumulated += data.token;
              setAiResult(accumulated);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setAiResult(null);
    } finally {
      setAiLoading(false);
      aiAbortControllerRef.current = null;
    }
  };

  const handleApply = (mode: 'append' | 'replace') => {
    if (aiResult) {
      onApplyResult(mode, aiResult);
      setAiResult(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Model Selection and AI Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">Modell</label>
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[180px]"
        >
          <option value="">Modell wählen</option>
          {installedModels.length > 0 ? (
            installedModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))
          ) : (
            <>
              <option value="llama3">llama3</option>
              <option value="qwen2.5-coder">qwen2.5-coder</option>
            </>
          )}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => runAi('complete')}
          disabled={aiLoading}
        >
          {aiLoading && aiAction === 'complete' ? 'KI ergänzt...' : 'KI ergänzt'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => runAi('summarize')}
          disabled={aiLoading}
        >
          {aiLoading && aiAction === 'summarize' ? 'KI fasst...' : 'KI fasst zusammen'}
        </Button>
      </div>
      
      {/* Error Display */}
      {error && <p className="text-xs text-destructive">{error}</p>}
      
      {/* AI Streaming / Result Area */}
      {(aiLoading || aiResult) && (
        <div className={`rounded-md border p-3 space-y-2 transition-colors ${
          aiLoading 
            ? 'border-primary/40 bg-primary/5' 
            : 'border-green-500/40 bg-green-500/5'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className={`text-xs font-medium flex items-center gap-2 ${
              aiLoading ? 'text-primary' : 'text-green-600 dark:text-green-400'
            }`}>
              {aiLoading ? (
                <>
                  <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>{aiAction === 'complete' ? 'KI ergänzt...' : 'KI fasst zusammen...'}</span>
                  <span className="text-muted-foreground font-normal">({model})</span>
                </>
              ) : (
                <>✓ KI-Vorschlag ({aiAction === 'complete' ? 'Ergänzung' : 'Zusammenfassung'})</>
              )}
            </div>
            <div className="flex items-center gap-1">
              {aiLoading && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-6 px-2 text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={stopAi}
                >
                  Stop
                </Button>
              )}
              {!aiLoading && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setAiResult(null)}
                >
                  ×
                </Button>
              )}
            </div>
          </div>
          
          {/* Streaming text with blinking cursor */}
          <div className={`text-sm whitespace-pre-wrap border-l-2 pl-3 py-1 ${
            aiLoading ? 'border-primary/30' : 'border-green-500/30'
          }`}>
            {aiResult}
            {aiLoading && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse" 
                    style={{ animation: 'cursor-blink 0.8s ease-in-out infinite' }} />
            )}
          </div>
          
          {/* Action buttons (only when done) */}
          {!aiLoading && aiResult && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={() => handleApply('append')}>
                Anhängen
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleApply('replace')}>
                Ersetzen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAiResult(null)}>
                Verwerfen
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

