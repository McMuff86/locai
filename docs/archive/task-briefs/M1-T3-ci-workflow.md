## Ticket: M1-T3 — CI Workflow (GitHub Actions) für Gates

### Ziel
Automatische Validierung von lint/typecheck/test/build in CI.

### Scope (nur diese Dateien/Ordner)
- `.github/workflows/ci.yml` (neu)
- `package.json` (nur falls Scripts fehlen)

### Kontext/Belege
- Es existiert aktuell kein `.github/` Ordner.

### Vorgehen (Schritte)
1. GitHub Actions Workflow erstellen:
   - Node 20
   - `npm ci`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
2. npm Cache aktivieren.
3. `NEXT_TELEMETRY_DISABLED=1` setzen.

### Akzeptanzkriterien (DoD)
- [ ] Workflow läuft auf `push` und `pull_request`.
- [ ] Keine OS-/GPU-/Dialog-Abhängigkeiten in CI.

### Quality Gates (müssen grün)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

### Wenn unsicher
Markiere **UNSICHER** und verifiziere lokal mit `npm run preflight` (falls vorhanden).

