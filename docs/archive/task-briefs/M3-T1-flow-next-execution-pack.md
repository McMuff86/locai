## Ticket Pack: M3-T1 - Flow MVP Hardening and Phase-1 Completion

## Status

- Completed: 2026-02-19
- Result: All 5 subtasks implemented
- Validation: `typecheck`, `lint`, `build` pass; `test` has pre-existing Windows-incompatible `run_command` cases

### Ziel
Flow MVP von "funktioniert" auf "team-ready" bringen: bessere UX, klare Wire-Regeln, Keyboard-Produktivitaet und Testabdeckung.

### Reihenfolge (ausfuehren in dieser Reihenfolge)
1. M3-T1.1 Palette Drag and Drop
2. M3-T1.2 Wire Typing + Validierung
3. M3-T1.3 Cmd+K Node Command Palette
4. M3-T1.4 Run History Panel
5. M3-T1.5 Compiler + Runtime Tests

---

## M3-T1.1 - Palette Drag and Drop

### Scope
- `src/components/flow/NodePalette.tsx`
- `src/components/flow/FlowCanvas.tsx`
- `src/stores/flowStore.ts`

### Schritte
1. Palette-Items als draggable markieren (`application/locai-flow-node` payload mit `kind`).
2. In Canvas Drop-Handler implementieren und Screen->Flow Position korrekt mappen.
3. Bestehendes Click-to-add beibehalten (fallback).
4. Kurzes visuelles Feedback waehrend Drag ueber Canvas.

### DoD
- [x] Node kann aus Palette in Canvas gedroppt werden.
- [x] Position entspricht Drop-Punkt (kein Off-by-offset).
- [x] Click-to-add funktioniert unveraendert.

### Quality Gates
- `npm run typecheck`
- `npm run lint`

---

## M3-T1.2 - Wire Typing + Validierung

### Scope
- `src/lib/flow/types.ts`
- `src/lib/flow/registry.ts`
- `src/components/flow/FlowCanvas.tsx`
- `src/stores/flowStore.ts`

### Schritte
1. Port-Types pro Node definieren (`string`, `json`, `any`, `stream`).
2. `isValidConnection` in React Flow hinterlegen.
3. Edge-Style nach Typ (Farbe) setzen.
4. Bei inkompatiblen Verbindungen: blockieren oder Warnstate markieren (MVP: blockieren + Toast).

### DoD
- [x] Inkompatible Verbindungen werden nicht erstellt.
- [x] Edge-Farbe zeigt den Datentyp.
- [x] Existing graph bleibt ladefaehig.

### Quality Gates
- `npm run typecheck`
- `npm run lint`

---

## M3-T1.3 - Cmd+K Node Command Palette

### Scope
- `src/app/(app)/flow/page.tsx`
- `src/components/flow/NodePalette.tsx`
- optional: neues UI component in `src/components/flow/`

### Schritte
1. Cmd/Ctrl+K Shortcut in `/flow` registrieren.
2. Suchdialog fuer Node-Typen bauen.
3. Enter fuegt selektierten Node in Viewport-Mitte ein.
4. ESC schliesst sauber, ohne Fokus-Bugs.

### DoD
- [x] Cmd/Ctrl+K oeffnet Palette.
- [x] Suche filtert Node-Typen live.
- [x] Enter fuegt Node ein.

### Quality Gates
- `npm run typecheck`
- `npm run lint`

---

## M3-T1.4 - Run History Panel

### Scope
- `src/app/(app)/flow/page.tsx`
- `src/stores/flowStore.ts`
- optional neues UI component `src/components/flow/RunHistoryPanel.tsx`

### Schritte
1. Run summaries (bereits im Store) als Liste unten oder rechts darstellen.
2. Status-Badge, Dauer, Startzeit und Fehlertext anzeigen.
3. Klick auf Run markiert relevante Nodes mit letztem Status (read-only replay light).
4. Begrenzung auf letzte 30 Runs beibehalten.

### DoD
- [x] Historie ist sichtbar und nachvollziehbar.
- [x] Fehler-Runs sind klar unterscheidbar.
- [x] UI bleibt bei laufendem Run responsiv.

### Quality Gates
- `npm run typecheck`
- `npm run lint`

---

## M3-T1.5 - Compiler + Runtime Tests

### Scope
- `src/lib/flow/engine.ts`
- `src/lib/flow/__tests__/engine.test.ts` (neu)
- optional runtime mapping helper in `src/lib/flow/`

### Schritte
1. Unit-Tests fuer Compiler:
   - linear graph
   - cycle detection
   - missing agent error
   - dependsOn mapping
2. Optional helper fuer stream->nodeStatus mapping extrahieren und testen.
3. Windows-unabhaengige Testdaten verwenden.

### DoD
- [x] Compiler-Faelle sind durch automatisierte Tests abgesichert.
- [x] Keine neuen flakes.

### Quality Gates
- `npm run test`
- `npm run typecheck`

---

## Abschlusskriterium fuer dieses Ticket Pack

- [x] Alle 5 Subtickets erledigt
- [x] `npm run build` erfolgreich
- [x] `CONTEXT-HANDOFF.md` aktualisiert
