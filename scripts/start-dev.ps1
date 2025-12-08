$ErrorActionPreference = "Stop"

# Configuration: list services to ensure running before dev server
$servicesToStart = @("searxng")
$composeFile = Join-Path $PSScriptRoot ".." "docker-compose.yml"
$projectRoot = Split-Path $PSScriptRoot -Parent

Write-Host "==> Checking Docker availability..." -ForegroundColor Cyan
try {
  docker info | Out-Null
} catch {
  Write-Error "Docker ist nicht verfügbar. Bitte Docker Desktop starten."
  exit 1
}

if (-not (Test-Path $composeFile)) {
  Write-Error "docker-compose.yml nicht gefunden: $composeFile"
  exit 1
}

Write-Host "==> Ensuring services are running: $($servicesToStart -join ', ')" -ForegroundColor Cyan
Push-Location $projectRoot
try {
  docker compose -f $composeFile up -d @servicesToStart
} catch {
  Pop-Location
  Write-Error "Fehler beim Starten der Services: $($_.Exception.Message)"
  exit 1
}
Pop-Location

Write-Host "==> Starting LocAI dev server (npm run dev)..." -ForegroundColor Cyan
Push-Location $projectRoot
try {
  npm run dev
} finally {
  Pop-Location
}

