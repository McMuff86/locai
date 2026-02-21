## Ticket: M1-T2 — Test-Harness + erste Unit Tests (pure libs)

### Ziel
Regression-Schutz für kritische Pure-Logic ohne OS/Netz/GUI-Abhängigkeiten.

### Scope (nur diese Dateien/Ordner)
- `package.json`
- `package-lock.json`
- `vitest.config.ts` (neu)
- `src/lib/notes/parser.ts`
- `src/lib/notes/embeddings.ts`
- `src/lib/webSearch/resultSelector.ts` (nur falls nötig für testbare pure Funktion)
- Tests neu unter:
  - `src/lib/notes/parser.test.ts`
  - `src/lib/notes/embeddings.test.ts`
  - `src/lib/webSearch/resultSelector.test.ts`

### Kontext/Belege
- Pure Funktionen vorhanden:
  - `extractLinksAndTags` in `src/lib/notes/parser.ts`
  - `chunkText`, `cosineSimilarity` in `src/lib/notes/embeddings.ts`
  - Ergebnis-Parsing ist aktuell intern in `src/lib/webSearch/resultSelector.ts` (ggf. exportieren).

### Vorgehen (Schritte)
1. Testframework integrieren (präferiert: `vitest` als devDependency) und `npm run test` bereitstellen.
2. Schreibe 10–15 Unit Tests:
   - Tags/Wikilinks Parsing (inkl. Edge Cases).
   - Chunking: kurze Texte, Overlap, Limits, Progress-Safety.
   - Cosine Similarity: identische Vektoren ~1, orthogonal ~0.
   - Result Selection Parsing: "NUMBER|REASON" + fallback number.
3. Tests müssen CI-safe sein (kein `fetch`, kein GPU, kein OS Dialog).

### Akzeptanzkriterien (DoD)
- [ ] `npm run test` läuft stabil.
- [ ] Mind. 10 Tests decken Kernlogik + Edge Cases ab.
- [ ] Keine Tests greifen auf Netzwerk/Ollama/ComfyUI/OS zu.

### Quality Gates (müssen grün)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

### Wenn unsicher
Markiere **UNSICHER** und prüfe:
- Ob `parseSelection` in `src/lib/webSearch/resultSelector.ts` exportiert werden muss (nur additive Änderung).

