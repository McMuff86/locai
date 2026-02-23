# Code-Optimierung Plan

Stand: 2026-02-23

## Bereits umgesetzt

1. Chat-Route in mehrere dynamic imports aufgeteilt (schwere UI-Teile nur bei Bedarf laden).
2. Dokument-Polling in Chat deaktiviert (`useDocuments({ pollIntervalMs: 0 })`).
3. `useDocuments` um Optionen erweitert (`pollIntervalMs`, `autoFetch`).
4. GPU-Float-Widget pollt nur noch, wenn das Widget offen ist.
5. Chat-Nachrichten mit `React.memo` stabilisiert, um Re-Renders im Stream zu reduzieren.
6. Documents-Route weiter entkoppelt:
   - `DocumentManager` lazy geladen
   - `FileCanvas` lazy geladen
   - Canvas nur rendern, wenn Fenster offen sind

## Messbare Effekte (Build)

1. `/chat` First Load JS: 599 kB -> 248 kB
2. `/documents` First Load JS: 582 kB -> 533 kB
3. Route-Chunk-Summe:
   - `/chat/page`: 1835.5 kB -> 790.7 kB
   - `/documents/page`: 1789.5 kB -> 1615.6 kB

## Naechste Schritte (priorisiert)

### P0 - Hoher Hebel, niedriges Risiko

1. Chat-Verlauf virtualisieren
   - Ziel: Nur sichtbare Nachrichten rendern.
   - Erfolgskriterium: Spuerbar fluessiger bei langen Verlaeufen (500+ Messages).

2. Filebrowser-Liste virtualisieren
   - Ziel: Weniger DOM-Knoten bei grossen Ordnern.
   - Erfolgskriterium: Scrollen bleibt flach bei 1000+ Eintraegen.

3. Markdown/Code-Highlighting weiter splitten
   - Ziel: Syntax-Highlighting erst laden, wenn wirklich ein Codeblock sichtbar ist.
   - Erfolgskriterium: Noch kleinerer Chat-Initial-Load und weniger CPU bei Antworten ohne Code.

4. Polling vereinheitlichen und tab-sichtbar machen
   - Ziel: Ein zentraler Polling-Takt statt vieler einzelner `setInterval`.
   - Erfolgskriterium: Weniger Hintergrund-Requests/CPU im Idle.

### P1 - Mittlerer Aufwand

1. FileWindow nach Dateityp haerter splitten
   - Bildeditor/PDF/Audio jeweils spaeter laden.

2. API-Antworten cachen (wo sinnvoll)
   - Kandidaten: Modelle, System-Stats, Dokument-Metadaten.

3. Performance-Budget als Guardrail
   - Build-Check fuer Route-Groessen (Warnung bei Regression).

## Empfohlener Ablauf fuer weitere Optimierung

1. Baseline messen (`npm run build`).
2. Eine Massnahme umsetzen.
3. Wieder messen und dokumentieren.
4. Erst danach naechste Massnahme starten.

## Notizen

1. `npm run typecheck` hat aktuell bestehende Test-Typfehler in `src/lib/agents/workflow*.test.ts` (nicht aus diesen Optimierungen).
2. Vor jeder groesseren Performance-Runde zuerst Route-Fokus festlegen (`/chat`, `/documents`, etc.), damit der Effekt eindeutig messbar bleibt.
