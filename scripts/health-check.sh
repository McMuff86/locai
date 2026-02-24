#!/usr/bin/env bash
# LocAI Health Check
# Usage: ./scripts/health-check.sh [port]

PORT="${1:-3000}"
URL="http://localhost:$PORT"

echo -n "🏥 Checking LocAI at $URL... "

HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 5 "$URL" 2>/dev/null)

if [[ "$HTTP_CODE" =~ ^(200|301|302|304)$ ]]; then
  echo "✅ Healthy (HTTP $HTTP_CODE)"
  exit 0
else
  echo "❌ Unhealthy (HTTP ${HTTP_CODE:-timeout})"
  exit 1
fi
