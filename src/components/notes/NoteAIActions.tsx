"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Globe, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getModelInfo } from '@/lib/ollama';
import WebSearchButton from '@/components/chat/WebSearchButton';

interface NoteAIActionsProps {
  basePath?: string;
  host?: string;
  searxngUrl?: string;
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
  searxngUrl,
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
  const [instruction, setInstruction] = useState('');
  const [contextMax, setContextMax] = useState<number | null>(null);
  const [numCtx, setNumCtx] = useState<number | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [externalWebContext, setExternalWebContext] = useState<string | null>(null);
  const [externalQuery, setExternalQuery] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  // Load context window info for selected model
  useEffect(() => {
    let cancelled = false;
    const loadCtx = async () => {
      if (!model) {
        setContextMax(null);
        setNumCtx(null);
        return;
      }
      setLoadingCtx(true);
      try {
        const info = await getModelInfo(model, host);
        if (cancelled) return;
        if (info?.contextLength) {
          setContextMax(info.contextLength);
          const safeDefault = Math.min(info.contextLength, 32768);
          setNumCtx(safeDefault);
        } else {
          setContextMax(null);
          setNumCtx(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('ctx load error', err);
          setContextMax(null);
          setNumCtx(null);
        }
      } finally {
        if (!cancelled) setLoadingCtx(false);
      }
    };
    loadCtx();
    return () => {
      cancelled = true;
    };
  }, [model, host]);

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

    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }

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
          prompt: instruction || undefined,
          numCtx: numCtx || undefined,
          useWebSearch: false,
          searxngUrl,
          externalContext: externalWebContext || undefined,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Fehler bei der KI-Aktion');
      }

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

  const hasWebContext = !!externalWebContext;

  return (
    <div className="space-y-0">
      {/* Header Row — always visible */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-t-md bg-muted/40 border border-border/60 cursor-pointer select-none"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>KI-Assistent</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Model Dropdown — stop propagation so click doesn't toggle expand */}
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs min-w-[140px]"
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
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Quick Actions Row — always visible */}
      <div className={`flex items-center gap-2 px-3 py-2 border-x border-b border-border/60 ${isExpanded ? '' : 'rounded-b-md'}`}>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => runAi('complete')}
          disabled={aiLoading}
        >
          {aiLoading && aiAction === 'complete' ? 'KI ergänzt...' : 'KI ergänzt'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => runAi('summarize')}
          disabled={aiLoading}
        >
          {aiLoading && aiAction === 'summarize' ? 'Zusammenfassen...' : 'Zusammenfassen'}
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <WebSearchButton
            enabled
            searxngUrl={searxngUrl}
            ollamaHost={host}
            model={model}
            onInsertResults={(results, query) => {
              setExternalWebContext(results);
              setExternalQuery(query);
            }}
          />
          {hasWebContext && (
            <span
              className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
              title={`Web-Kontext: ${externalQuery || 'ohne Query'} — Klicken zum Entfernen`}
              onClick={() => {
                setExternalWebContext(null);
                setExternalQuery(null);
              }}
            >
              <Globe className="h-3 w-3" />
              ×
            </span>
          )}
        </div>
      </div>

      {/* Expanded Section */}
      {isExpanded && (
        <div className="border-x border-b border-border/60 rounded-b-md px-3 py-3 space-y-3">
          {/* Optional Prompt */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Optionaler Prompt
            </label>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="z.B. Schreibe eine stichpunktartige Fortsetzung..."
              className="min-h-[60px] text-sm"
            />
          </div>

          {/* Web Context Preview */}
          {externalWebContext && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Web-Kontext ({externalQuery || 'ohne Query'})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setExternalWebContext(null);
                    setExternalQuery(null);
                  }}
                >
                  Entfernen
                </Button>
              </div>
              <div className="border rounded-md p-2 bg-background/50 text-xs text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap">
                {externalWebContext.slice(0, 400)}
                {externalWebContext.length > 400 && ' ...'}
              </div>
            </div>
          )}

          {/* Advanced Section */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsAdvancedOpen((v) => !v)}
            >
              {isAdvancedOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3 rotate-90" />
              )}
              Erweitert
            </button>
            {isAdvancedOpen && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Kontext-Fenster (Tokens)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {loadingCtx
                      ? 'Lade...'
                      : contextMax
                      ? `${numCtx ?? contextMax} / ${contextMax}`
                      : 'Nicht verfügbar'}
                  </span>
                </div>
                {contextMax ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1024}
                      max={contextMax}
                      step={512}
                      value={numCtx ?? contextMax}
                      onChange={(e) => setNumCtx(parseInt(e.target.value, 10))}
                      className="flex-1"
                      disabled={aiLoading}
                    />
                    <input
                      type="number"
                      min={512}
                      max={contextMax}
                      step={256}
                      value={numCtx ?? contextMax}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (Number.isNaN(val)) return;
                        setNumCtx(Math.min(Math.max(val, 512), contextMax));
                      }}
                      className="w-24 h-7 rounded-md border border-input bg-background px-2 text-xs"
                      disabled={aiLoading}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Kontext-Länge für dieses Modell konnte nicht geladen werden.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}

      {/* AI Streaming / Result Area */}
      {(aiLoading || aiResult) && (
        <div className={`rounded-md border p-3 space-y-2 transition-colors mt-2 ${
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
          {aiLoading ? (
            <div className="text-sm whitespace-pre-wrap border-l-2 pl-3 py-1 border-primary/30">
              {aiResult}
              <span
                className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse"
                style={{ animation: 'cursor-blink 0.8s ease-in-out infinite' }}
              />
            </div>
          ) : (
            aiResult && (
              <Textarea
                value={aiResult}
                onChange={(e) => setAiResult(e.target.value)}
                className="text-sm whitespace-pre-wrap border-l-2 pl-3 py-1 border-green-500/30"
                rows={8}
              />
            )
          )}

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
