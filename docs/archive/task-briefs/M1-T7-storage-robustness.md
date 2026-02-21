## Ticket: M1-T7 — Storage Robustness v1 (Bild-Chats/Quota)

### Ziel
localStorage Quota/Crash-Risiken reduzieren, wenn Chats Bilder enthalten.

### Scope (nur diese Dateien/Ordner)
- `src/lib/storage.ts`
- (optional) `src/types/chat.ts` nur falls Typen erweitert werden müssen

### Kontext/Belege
- `compressImage()` ist Stub und reduziert aktuell nichts: `src/lib/storage.ts`
- Bilder werden als Data URLs in localStorage gespeichert → Quota-Risiko.

### Vorgehen (Schritte)
1. Implementiere robustes Fallback bei QuotaExceeded:
   - Versuch `localStorage.setItem(...)`
   - Wenn Quota exceeded: ersetze Bildinhalte durch Platzhaltertext und retry 1x.
2. Zusätzlich: pro Bild harte Größenlimit-Policy (z.B. >200KB → placeholder).
3. Verhalten muss abwärtskompatibel sein (alte Daten laden weiterhin).

### Akzeptanzkriterien (DoD)
- [ ] Große Bilder verhindern nicht das Speichern des restlichen Chats.
- [ ] Nutzer sieht im Chat/History einen klaren Platzhalter statt broken state.
- [ ] Keine Endlosschleifen; Retry maximal 1x.

### Quality Gates (müssen grün)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

### Wenn unsicher
Markiere **UNSICHER** und verifiziere in Browser: großen Bild-Upload, dann Save/Reload, und prüfe localStorage Eintraggröße.

