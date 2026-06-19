# Provider Integration Guide

LocAI unterstützt mehrere LLM-Provider neben Ollama. Du kannst lokale Modelle, Claude, OpenAI, Gemini oder OpenRouter-Modelle nutzen. Credentials bleiben serverseitig oder im lokalen LocAI-Credential-Store.

## Setup

Erstelle eine `.env.local` Datei im Projekt-Root (wird von Git ignoriert):

```bash
# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
OPENAI_API_KEY=sk-...

# OpenAI Workload Identity / short-lived access token (optional)
# OPENAI_ACCESS_TOKEN=...

# OpenRouter (Zugang zu 100+ Modellen)
OPENROUTER_API_KEY=sk-or-...

# OpenRouter OAuth PKCE (optional; kann auch über /settings verbunden werden)
# OPENROUTER_OAUTH_KEY=...

# Google Gemini
GEMINI_API_KEY=AIza...

# Google Gemini OAuth / ADC access token (optional)
# GOOGLE_OAUTH_ACCESS_TOKEN=...
# GOOGLE_CLOUD_PROJECT=your-gcp-project-id

# Optional: Custom Base URLs
# ANTHROPIC_BASE_URL=https://...
# OPENAI_BASE_URL=https://...
# OPENROUTER_BASE_URL=https://...
# GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
# OLLAMA_HOST=http://localhost:11434
```

Restart den Dev-Server nach Änderungen an `.env.local`.

Credential-Priorität:

1. Request-Override aus API-Body.
2. Environment Variable aus `.env.local`.
3. Lokaler OAuth-Store unter `~/.locai/provider-credentials.json`.

Der lokale Store wird aktuell für OpenRouter OAuth PKCE genutzt. Echte Credential-Werte werden nicht an den Client gesendet; `/api/models` und `/api/providers/health` geben nur `authMode`, `source` und Status zurück.

## Provider wählen

### Per API

Sende `provider` und optional `model` im Request Body:

```bash
curl -X POST http://localhost:3000/api/chat/agent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Erkläre mir Quantencomputing",
    "provider": "anthropic",
    "model": "claude-sonnet-4-6"
  }'
```

### Default-Verhalten

Ohne `provider` im Request wird **Ollama** verwendet (kein API Key nötig). Alle bestehenden Integrationen funktionieren weiterhin unverändert.

## Verfügbare Provider & Modelle

### Ollama (Default)
- Alle lokal installierten Modelle
- Kein API Key nötig
- `provider: "ollama"` (oder einfach weglassen)

### Anthropic (Claude)
- `claude-fable-5` — aktuell stärkstes allgemein verfügbares Claude-Modell
- `claude-opus-4-8` — Opus-Tier für komplexe Reasoning-/Agent-Aufgaben
- `claude-sonnet-4-6` — ausgewogenes Claude-Modell
- `claude-haiku-4-5-20251001` — schnell & günstig
- `provider: "anthropic"`
- Auth: `ANTHROPIC_API_KEY`
- Hinweis: Claude.ai / Claude Code OAuth ist laut Anthropic nicht für Drittanbieter-Produkt-Routing gedacht. Nutze API Key oder unterstützte Cloud-Provider.

### OpenAI
- `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, etc.
- `provider: "openai"`
- Auth: `OPENAI_API_KEY` oder `OPENAI_ACCESS_TOKEN` aus Workload Identity Federation
- Hinweis: Für GPT-5.5-Reasoning/Tool-heavy Workflows ist ein dedizierter Responses-API-Adapter als nächster Slice geplant.

### OpenRouter
- Zugang zu OpenRouter-Modellen (GPT, Claude, Gemini, Llama, Mixtral, ...)
- `provider: "openrouter"`
- Auth: `OPENROUTER_API_KEY`, `OPENROUTER_OAUTH_KEY`, oder OAuth-Verbindung über `/settings`
- Empfohlen für LocAI-OAuth: OpenRouter PKCE, weil Localhost-Callbacks unterstützt werden.

### Google Gemini
- `gemini-3.1-pro-preview`
- `gemini-3.5-flash`
- `gemini-2.5-pro`
- `provider: "google"`
- Auth: `GEMINI_API_KEY` oder `GOOGLE_OAUTH_ACCESS_TOKEN` mit `GOOGLE_CLOUD_PROJECT`

## OpenRouter per OAuth verbinden

1. Öffne `/settings`.
2. Unter **AI Providers** bei OpenRouter auf **OAuth verbinden** klicken.
3. OpenRouter autorisieren.
4. LocAI speichert den resultierenden user-controlled API Key lokal unter `~/.locai/provider-credentials.json`.
5. Danach ist `provider: "openrouter"` in Chat, Notes und Flow Builder verfügbar.

## Claude über die API nutzen

1. Gehe zu [console.anthropic.com](https://console.anthropic.com)
2. Erstelle einen API Key unter **Settings → API Keys**
3. Trage ihn in `.env.local` ein:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```
4. Nutze in API Requests:
   ```json
   {
     "provider": "anthropic",
     "model": "claude-sonnet-4-6"
   }
   ```

## Modelle auflisten

```bash
# Alle konfigurierten Provider
GET /api/models

# Nur ein Provider
GET /api/models?provider=anthropic
```

Response:
```json
{
  "providers": ["ollama", "anthropic"],
  "providerAuth": {
    "anthropic": {
      "configured": true,
      "authMode": "api_key",
      "source": "env"
    }
  },
  "byProvider": {
    "ollama": [{"id": "llama3.2", "name": "llama3.2", ...}],
    "anthropic": [{"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", ...}]
  },
  "models": [...]
}
```

## Workflow Engine

Die Workflow Engine (`POST /api/chat/agent/workflow`) unterstützt ebenfalls den `provider` Parameter:

```json
{
  "message": "Analysiere diese Daten",
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "enableWorkflow": true
}
```

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| `Provider "anthropic" is not configured` | Credential in `.env.local` oder lokalem OAuth-Store prüfen, Server neu starten |
| `401 Unauthorized` | Credential ungültig oder abgelaufen — neuen Key/Token erstellen |
| `429 Rate Limited` | Zu viele Requests — warten oder Tier upgraden |
| Provider nicht in `/api/models` | `/api/providers/health` prüfen; `providerAuth` zeigt Credential-Quelle |
| Ollama-Fallback | Wenn kein Provider angegeben, wird immer Ollama verwendet |

## Architektur

```
Request (provider: "anthropic")
  → API Route (route.ts)
    → createServerProvider("anthropic")  // resolved env/local OAuth credentials
      → AnthropicProvider
        → executor.ts (provider-agnostischer Agent Loop)
```

- Credentials werden **nur serverseitig** gelesen (`src/lib/providers/server.ts`)
- Kein Credential-Wert wird jemals an den Client gesendet
- Jeder Provider implementiert das `ChatProvider` Interface
- Ollama bleibt immer als Fallback verfügbar
