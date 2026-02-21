## Ticket: M1-T6 — Security Hardening v1 (dangerous APIs)

### Ziel
Minimale Härtung für “dangerous” API-Endpunkte (Exec/Spawn/Kill/Dialogs), ohne normale lokale Nutzung zu brechen.

### Scope (nur diese Dateien/Ordner)
- `src/app/api/_utils/security.ts` (neu)
- `src/app/api/gpu/kill-process/route.ts`
- `src/app/api/folder-picker/route.ts`
- `src/app/api/comfyui/launch/route.ts`
- (optional, wenn Write-Aktionen abgesichert werden sollen)
  - `src/app/api/comfyui/gallery/delete/route.ts`
  - `src/app/api/comfyui/gallery/copy-to-input/route.ts`

### Kontext/Belege
- Kill Process: `src/app/api/gpu/kill-process/route.ts` nutzt OS commands.
- Folder Picker: `src/app/api/folder-picker/route.ts` nutzt OS Dialog via exec.
- ComfyUI Launch: `src/app/api/comfyui/launch/route.ts` spawnt Prozesse.

### Vorgehen (Schritte)
1. Helper `assertLocalRequest(req)`:
   - Erlaubt `localhost`, `127.0.0.1`, `::1` anhand `Origin`/`Host` (best-effort).
   - Override per env `LOCAI_ALLOW_REMOTE=1`.
2. Optional Token: wenn env `LOCAI_API_TOKEN` gesetzt ist → require Header `x-locai-token` oder `Authorization: Bearer`.
3. In den genannten Endpoints am Anfang prüfen und bei Fail `403` zurückgeben.

### Akzeptanzkriterien (DoD)
- [ ] Default lokal funktioniert ohne zusätzliche Client-Änderungen.
- [ ] Remote Requests werden best-effort geblockt (sofern nicht override).
- [ ] Wenn `LOCAI_API_TOKEN` gesetzt: ohne Token keine Operation.

### Quality Gates (müssen grün)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

### Wenn unsicher
Markiere **UNSICHER** bzgl. Proxy/Host Header; verifiziere indem du die Header in den Routes loggst (temporär) oder via lokaler curl/Invoke-WebRequest.

