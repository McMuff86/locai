# Provider Integration Guide

LocAI unterstützt mehrere LLM-Provider neben Ollama. Du kannst Claude, GPT-4o oder beliebige OpenRouter-Modelle nutzen — mit deinen eigenen API Keys.

## Setup

Erstelle eine `.env.local` Datei im Projekt-Root (wird von Git ignoriert):

```bash
# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
OPENAI_API_KEY=sk-...

# OpenRouter (Zugang zu 100+ Modellen)
OPENROUTER_API_KEY=sk-or-...

# Optional: Custom Base URLs
# ANTHROPIC_BASE_URL=https://...
# OPENAI_BASE_URL=https://...
# OPENROUTER_BASE_URL=https://...
# OLLAMA_HOST=http://localhost:11434
```

Restart den Dev-Server nach Änderungen an `.env.local`.

## Provider wählen

### Per API

Sende `provider` und optional `model` im Request Body:

```bash
curl -X POST http://localhost:3000/api/chat/agent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Erkläre mir Quantencomputing",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
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
- `claude-opus-4-20250514` — Claude Opus 4
- `claude-sonnet-4-20250514` — Claude Sonnet 4
- `claude-3-5-haiku-20241022` — Claude 3.5 Haiku (schnell & günstig)
- `provider: "anthropic"`

### OpenAI
- `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, etc.
- `provider: "openai"`

### OpenRouter
- Zugang zu allen OpenRouter-Modellen (Claude, GPT, Llama, Mixtral, ...)
- `provider: "openrouter"`

## Claude mit eigener Subscription nutzen

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
     "model": "claude-sonnet-4-20250514"
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
  "byProvider": {
    "ollama": [{"id": "llama3.2", "name": "llama3.2", ...}],
    "anthropic": [{"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", ...}]
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
  "model": "claude-sonnet-4-20250514",
  "enableWorkflow": true
}
```

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| `Provider "anthropic" is not configured` | API Key in `.env.local` prüfen, Server neu starten |
| `401 Unauthorized` | API Key ungültig oder abgelaufen — neuen Key erstellen |
| `429 Rate Limited` | Zu viele Requests — warten oder Tier upgraden |
| Provider nicht in `/api/models` | `.env.local` prüfen, Dev-Server neu starten |
| Ollama-Fallback | Wenn kein Provider angegeben, wird immer Ollama verwendet |

## Architektur

```
Request (provider: "anthropic")
  → API Route (route.ts)
    → createServerProvider("anthropic")  // liest ANTHROPIC_API_KEY aus env
      → AnthropicProvider
        → executor.ts (provider-agnostischer Agent Loop)
```

- API Keys werden **nur serverseitig** gelesen (`src/lib/providers/server.ts`)
- Kein Key wird jemals an den Client gesendet
- Jeder Provider implementiert das `ChatProvider` Interface
- Ollama bleibt immer als Fallback verfügbar
