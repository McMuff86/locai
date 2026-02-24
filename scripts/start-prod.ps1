$ErrorActionPreference = "Stop"

# LocAI Production Start Script (Windows)
# Usage: .\scripts\start-prod.ps1 [-SkipOllama] [-Port XXXX]

param(
  [switch]$SkipOllama,
  [int]$Port = 3000
)

$projectRoot = Split-Path $PSScriptRoot -Parent
$ollamaHost = "172.31.96.1:11434"

Write-Host "`n🚀 LocAI Production Start" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# 1. Node.js version check (>=18)
Write-Host -NoNewline "📋 Node.js version... "
try {
  $nodeVer = (node -v) -replace '^v', ''
  $major = [int]($nodeVer.Split('.')[0])
  if ($major -lt 18) {
    Write-Host "❌ v$nodeVer found, but >= 18 required." -ForegroundColor Red
    exit 1
  }
  Write-Host "✅ v$nodeVer" -ForegroundColor Green
} catch {
  Write-Host "❌ Node.js not found." -ForegroundColor Red
  exit 1
}

# 2. npm check
Write-Host -NoNewline "📋 npm... "
try {
  $npmVer = npm -v
  Write-Host "✅ $npmVer" -ForegroundColor Green
} catch {
  Write-Host "❌ npm not found." -ForegroundColor Red
  exit 1
}

# 3. Ollama check
if (-not $SkipOllama) {
  Write-Host -NoNewline "📋 Ollama ($ollamaHost)... "
  try {
    $null = Invoke-WebRequest -Uri "http://$ollamaHost" -TimeoutSec 3 -UseBasicParsing
    Write-Host "✅ reachable" -ForegroundColor Green
  } catch {
    Write-Host "❌ Ollama not reachable at $ollamaHost" -ForegroundColor Red
    Write-Host "   Use -SkipOllama to skip this check." -ForegroundColor Yellow
    exit 1
  }
} else {
  Write-Host "📋 Ollama check... ⏭️  skipped" -ForegroundColor Yellow
}

# 4. Port check
Write-Host -NoNewline "📋 Port $Port... "
$portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
  Write-Host "❌ Port $Port is already in use." -ForegroundColor Red
  Write-Host "   Use -Port XXXX to specify a different port." -ForegroundColor Yellow
  exit 1
}
Write-Host "✅ free" -ForegroundColor Green

# 5. Build
Push-Location $projectRoot
try {
  Write-Host "`n🔨 Building production bundle..." -ForegroundColor Cyan
  $env:PORT = $Port
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed" }
  Write-Host "✅ Build complete" -ForegroundColor Green

  # 6. Start
  Write-Host "`n▶️  Starting LocAI on port $Port..." -ForegroundColor Cyan
  npm start
} catch {
  Write-Host "❌ $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally {
  Pop-Location
}
