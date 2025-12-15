## Ticket: M1-T5 — Unified Search → Chat Deep-Link `?load=` fixen

### Ziel
Search-Ergebnisse für Chats öffnen den Chat und laden die gespeicherte Konversation.

### Scope (nur diese Dateien/Ordner)
- `src/app/(app)/search/page.tsx`
- `src/app/(app)/chat/page.tsx`
- `src/lib/storage.ts`

### Kontext/Belege
- Search verlinkt Chats via `href="/chat?load=<id>"`: `src/app/(app)/search/page.tsx`
- Chat page nutzt `useSearchParams`, lädt aber kein `load` param (nur `analyzeImage`): `src/app/(app)/chat/page.tsx`
- Chat Storage liegt in localStorage: `src/lib/storage.ts` (`getSavedConversations`)

### Vorgehen (Schritte)
1. In `src/app/(app)/chat/page.tsx` `load` Param lesen.
2. Wenn `load` gesetzt: Konversation aus `getSavedConversations()` suchen, `loadConversation()` aufrufen, Toast anzeigen.
3. Param nach erfolgreichem Load aus URL entfernen (replace), damit Reload stabil ist.
4. Fehlerfälle: id nicht gefunden → Toast.

### Akzeptanzkriterien (DoD)
- [ ] Klick auf Chat-Suchergebnis lädt Chat und zeigt Nachrichten.
- [ ] Kein Konflikt mit `?analyzeImage=true` Flow.

### Quality Gates (müssen grün)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

### Wenn unsicher
Markiere **UNSICHER** und verifiziere Link-Format in `src/app/(app)/search/page.tsx`.

