import { NextRequest } from 'next/server';
import { resolveAndValidateOllamaHost } from '../../_utils/ollama';
import { apiError } from '../../_utils/responses';

export const runtime = 'nodejs';

// Optimization presets with their system prompts
const OPTIMIZATION_PRESETS: Record<string, string> = {
  bullets: `Erstelle eine präzise Zusammenfassung als Bullet-Points (max 5-7 Punkte). 
Extrahiere nur die wichtigsten Fakten und Informationen aus allen Quellen.
Format: Markdown-Liste mit kurzen, prägnanten Punkten.`,

  detailed: `Erstelle eine detaillierte Zusammenfassung mit Quellenangaben.
Strukturiere die Informationen logisch und nenne bei wichtigen Fakten die Quelle.
Format: Fließtext mit Zwischenüberschriften und [Quelle: URL] Angaben.`,

  steps: `Erstelle eine Schritt-für-Schritt Anleitung basierend auf den Quellen.
Extrahiere praktische Handlungsanweisungen und ordne sie in einer logischen Reihenfolge.
Format: Nummerierte Liste mit klaren Aktionsschritten.`,

  risks: `Analysiere die Quellen auf Risiken, Nachteile und wichtige Hinweise.
Hebe Warnungen, Einschränkungen und potenzielle Probleme hervor.
Format: Strukturierte Liste mit ⚠️ Markierungen für kritische Punkte.`,

  compare: `Erstelle einen Vergleich der Informationen aus den verschiedenen Quellen.
Zeige Gemeinsamkeiten und Unterschiede auf.
Format: Tabelle oder strukturierter Vergleich mit Pro/Contra wenn möglich.`,
};

interface OptimizeRequest {
  snippets: Array<{
    title: string;
    url: string;
    content: string;
  }>;
  preset: string;
  customPrompt?: string;
  model?: string;
  host?: string;
  numCtx?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OptimizeRequest;
    
    if (!body.snippets || body.snippets.length === 0) {
      return apiError('No snippets provided', 400);
    }

    const model = body.model || 'llama3';
    let host: string;
    try {
      host = resolveAndValidateOllamaHost(body.host);
    } catch (err) {
      return apiError(err instanceof Error ? err.message : 'Invalid Ollama host', 400);
    }
    const numCtx = body.numCtx || 8192;

    // Build the context from snippets (increased limit to ~1500 chars per snippet for up to 5 sources)
    const sourcesContext = body.snippets
      .slice(0, 5)
      .map((s, i) => {
        const snippet = s.content?.substring(0, 1500) || '';
        return `### Quelle ${i + 1}: ${s.title}\nURL: ${s.url}\n\n${snippet}`;
      })
      .join('\n\n---\n\n');

    // Get the optimization instruction
    let optimizationInstruction: string;
    if (body.preset === 'custom' && body.customPrompt?.trim()) {
      optimizationInstruction = body.customPrompt.trim();
    } else {
      optimizationInstruction = OPTIMIZATION_PRESETS[body.preset] || OPTIMIZATION_PRESETS.bullets;
    }

    const systemPrompt = `Du bist ein Experte für Informationssynthese. 
Deine Aufgabe ist es, Informationen aus mehreren Web-Quellen zu einem kohärenten, gut strukturierten Kontext zusammenzufassen.

WICHTIG:
- Kombiniere das Wissen aus ALLEN bereitgestellten Quellen
- Entferne Redundanzen und Wiederholungen
- Behalte wichtige Details und Fakten bei
- Schreibe in der Sprache der Quellen (meist Deutsch)
- Halte dich an das gewünschte Format
- Sei präzise und informativ`;

    const userPrompt = `${optimizationInstruction}

---

QUELLEN ZUM VERARBEITEN:

${sourcesContext}

---

Erstelle jetzt die optimierte Zusammenfassung basierend auf den obigen Quellen:`;

    // Call Ollama for synthesis
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: { num_ctx: numCtx },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return apiError(`Model error: ${text}`, 500);
    }

    // Stream the response to the client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n').filter((line) => line.trim());

            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                const content = json?.message?.content || '';
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: content })}\n\n`));
                }
                if (json.done) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('search/optimize error', error);
    return apiError('Optimization failed', 500);
  }
}
