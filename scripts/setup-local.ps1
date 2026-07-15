# Local + Vercel-friendly one-command setup (Windows)
# Usage: powershell -ExecutionPolicy Bypass -File scripts\setup-local.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "AXIS local setup" -ForegroundColor Cyan
Write-Host "Branch tip: git checkout cursor/fix-google-login-d710; git pull"

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env — fill all VITE_* keys (see docs/KEYS_SETUP.md)" -ForegroundColor Yellow
} else {
  Write-Host ".env already exists"
}

if (-not (Test-Path "backend\.env")) {
  Copy-Item "backend\.env.example" "backend\.env"
  Write-Host "Created backend\.env — fill all keys (see docs/KEYS_SETUP.md)" -ForegroundColor Yellow
} else {
  Write-Host "backend\.env already exists"
}

Write-Host "Installing frontend deps..."
npm install

Write-Host "Installing backend deps..."
Push-Location backend
python -m pip install -r requirements.txt
Pop-Location

Write-Host ""
Write-Host "Next:" -ForegroundColor Green
Write-Host "  1. Edit .env and backend\.env with real keys"
Write-Host "  2. npm run dev:all"
Write-Host "  3. Open http://localhost:5173/onboard"
Write-Host "  4. Read docs/HANDOFF.md before a new chat"
Write-Host ""
Write-Host "Vercel:"
Write-Host "  Frontend: https://axis-teamtitanlink.vercel.app"
Write-Host "  API:      https://axis-api-teamtitanlink.vercel.app"
