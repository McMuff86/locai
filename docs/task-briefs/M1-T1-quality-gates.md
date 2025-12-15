## Ticket: M1-T1 — Quality-Gates als Scripts (lint/typecheck/test/build)

### Ziel
Standardisierte Scripts für lokale/CI Quality Gates einführen.

### Scope (nur diese Dateien/Ordner)
- `package.json`

### Kontext/Belege
- `package.json` enthält aktuell nur `dev/build/start/lint`, kein `typecheck/test`.

### Vorgehen (Schritte)
1. `typecheck` Script hinzufügen (z.B. `tsc --noEmit`).
2. `test` Script hinzufügen (z.B. `vitest run`).
3. Optional: `preflight` Script (lint + typecheck + test + build).

### Akzeptanzkriterien (DoD)
- [ ] `npm run typecheck` existiert und läuft deterministisch.
- [ ] `npm run test` existiert und läuft (auch wenn zunächst nur wenige Tests existieren).
- [ ] `npm run preflight` (falls hinzugefügt) läuft in einem Rutsch.

### Quality Gates (müssen grün)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

### Wenn unsicher
Markiere **UNSICHER** und verifiziere via `package.json` Scripts + `npm run <script>`.

