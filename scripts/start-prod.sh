#!/usr/bin/env bash
set -euo pipefail

# LocAI Production Start Script
# Usage: ./scripts/start-prod.sh [--skip-ollama] [--port XXXX]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PORT=3000
SKIP_OLLAMA=false
OLLAMA_HOST="172.31.96.1:11434"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-ollama) SKIP_OLLAMA=true; shift ;;
    --port) PORT="$2"; shift 2 ;;
    *) echo "❌ Unknown option: $1"; echo "Usage: $0 [--skip-ollama] [--port XXXX]"; exit 1 ;;
  esac
done

echo "🚀 LocAI Production Start"
echo "========================="

# 1. Node.js version check (>=18)
echo -n "📋 Node.js version... "
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [[ -z "$NODE_VERSION" ]]; then
  echo "❌ Node.js not found. Please install Node.js >= 18."
  exit 1
fi
if [[ "$NODE_VERSION" -lt 18 ]]; then
  echo "❌ Node.js v${NODE_VERSION} found, but >= 18 required."
  exit 1
fi
echo "✅ v$(node -v)"

# 2. npm check
echo -n "📋 npm... "
if ! command -v npm &>/dev/null; then
  echo "❌ npm not found."
  exit 1
fi
echo "✅ $(npm -v)"

# 3. Ollama check
if [[ "$SKIP_OLLAMA" == "false" ]]; then
  echo -n "📋 Ollama ($OLLAMA_HOST)... "
  if curl -sf --connect-timeout 3 "http://$OLLAMA_HOST" >/dev/null 2>&1; then
    echo "✅ reachable"
  else
    echo "❌ Ollama not reachable at $OLLAMA_HOST"
    echo "   Use --skip-ollama to skip this check."
    exit 1
  fi
else
  echo "📋 Ollama check... ⏭️  skipped"
fi

# 4. Port check
echo -n "📋 Port $PORT... "
if ss -tlnp 2>/dev/null | grep -q ":${PORT} " || lsof -i ":${PORT}" >/dev/null 2>&1; then
  echo "❌ Port $PORT is already in use."
  echo "   Use --port XXXX to specify a different port."
  exit 1
fi
echo "✅ free"

# 5. Build
cd "$PROJECT_ROOT"
echo ""
echo "🔨 Building production bundle..."
PORT=$PORT npm run build
echo "✅ Build complete"

# 6. Start
echo ""
echo "▶️  Starting LocAI on port $PORT..."
PORT=$PORT npm start
