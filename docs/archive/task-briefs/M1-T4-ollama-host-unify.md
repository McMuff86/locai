## Ticket: M1-T4 — Ollama Host “Single Source of Truth” (Client+Server)

### Ziel
Ollama Host konsistent über Settings steuern; keine hardcoded `localhost:11434` Drift.

### Scope (nur diese Dateien/Ordner)
- `src/lib/ollama.ts`
- `src/hooks/useModels.ts`
- `src/hooks/useOllamaStatus.ts`
- `src/components/OllamaStatus.tsx`
- `src/components/SystemMonitor.tsx`
- `src/components/GpuMonitorWidget.tsx`
- `src/components/GpuMonitorDialog.tsx`
- `src/app/api/system-stats/route.ts`
- `src/components/ModelPullDialog.tsx`
- `src/app/api/ollama/pull/route.ts`
- (Call sites) `src/app/(app)/chat/page.tsx`, `src/app/(app)/notes/layout.tsx`

### Kontext/Belege
- Hardcoded Base in `src/lib/ollama.ts`: `http://localhost:11434/api`
- Settings existieren: `ollamaHost` in `src/hooks/useSettings.ts`
- Status Hook nutzt env `NEXT_PUBLIC_OLLAMA_URL`: `src/hooks/useOllamaStatus.ts`
- system-stats ruft `http://localhost:11434/api/ps`: `src/app/api/system-stats/route.ts`
- Model Pull API nutzt env/default: `src/app/api/ollama/pull/route.ts`

### Vorgehen (Schritte)
1. `src/lib/ollama.ts`: alle Public-Funktionen akzeptieren optional `host` (oder via `createOllamaClient({host})`).
2. `useModels`: nimmt optional `host` Parameter an und reicht ihn an `getOllamaModels/getModelInfo` durch.
3. `OllamaStatus`: nimmt optional `host` Prop an und gibt ihn an `useOllamaStatus(host)` weiter.
4. `system-stats`: akzeptiert optional query `ollamaHost` und nutzt das statt hardcoded localhost.
5. Monitor-Components hängen `?ollamaHost=` an API Calls an (aus `useSettings()`).
6. Model Pull: Dialog sendet `host` an `/api/ollama/pull` POST; API nutzt `host` wenn gesetzt.

### Akzeptanzkriterien (DoD)
- [ ] Umstellen von `settings.ollamaHost` wirkt in: Models, Chat, OllamaStatus, system-stats, Model Pull.
- [ ] Defaults bleiben: ohne Settings weiterhin `http://localhost:11434`.
- [ ] Keine Breaking Changes für UI (nur additive Props/Optionen).

### Quality Gates (müssen grün)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

### Wenn unsicher
Markiere **UNSICHER** und verifiziere Call Sites via `rg "useModels\\("` und `rg "OllamaStatus"`.

