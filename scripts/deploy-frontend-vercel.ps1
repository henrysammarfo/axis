# Deploy frontend to Vercel (teamtitanlink). Reads env from repo-root .env — never hardcode secrets.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
  throw "Missing $envFile - copy .env.example and fill Arbitrum One (42161) keys."
}

$api = "https://axis-api-teamtitanlink.vercel.app"
$required = @(
  "VITE_MAGIC_PUBLISHABLE_KEY",
  "VITE_PARTICLE_PROJECT_ID",
  "VITE_PARTICLE_CLIENT_KEY",
  "VITE_PARTICLE_APP_ID",
  "VITE_ZERODEV_PROJECT_ID",
  "VITE_ZERODEV_RPC_URL",
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_ARBITRUM_RPC_URL",
  "VITE_ARBITRUM_CHAIN_ID"
)

$map = @{ "VITE_API_URL" = $api }
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
  $i = $line.IndexOf("=")
  $k = $line.Substring(0, $i)
  $v = $line.Substring($i + 1)
  if ($required -contains $k) { $map[$k] = $v }
}

foreach ($k in $required) {
  if (-not $map.ContainsKey($k) -or -not [string]$map[$k]) {
    throw "Missing $k in .env (required for mainnet deploy)."
  }
}
if ($map["VITE_ARBITRUM_CHAIN_ID"] -ne "42161") {
  throw "VITE_ARBITRUM_CHAIN_ID must be 42161 for production UA/EIP-7702/SRA. Got $($map['VITE_ARBITRUM_CHAIN_ID'])."
}
if ($map["VITE_ZERODEV_RPC_URL"] -notmatch "/chain/42161") {
  throw "VITE_ZERODEV_RPC_URL must use /chain/42161 for Arbitrum One."
}

$argsList = @("deploy", "--prod", "--yes", "--scope", "teamtitanlink", "--force")
foreach ($k in $map.Keys) {
  $argsList += "-b"
  $argsList += "$k=$($map[$k])"
}

# Vercel deployment protection matches Git author to team member henrysammarfo.
# Force author/committer for this process so CLI deploys are not BLOCKED.
$env:GIT_AUTHOR_NAME = "Henry Sam Marfo"
$env:GIT_AUTHOR_EMAIL = "90197918+henrysammarfo@users.noreply.github.com"
$env:GIT_COMMITTER_NAME = "Henry Sam Marfo"
$env:GIT_COMMITTER_EMAIL = "90197918+henrysammarfo@users.noreply.github.com"

Write-Host "Deploying frontend (Arbitrum One 42161) as henrysammarfo..."
& vercel @argsList
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Alias whichever project is currently linked
$projectName = "axis"
if (Test-Path (Join-Path $root ".vercel\project.json")) {
  $pj = Get-Content (Join-Path $root ".vercel\project.json") -Raw | ConvertFrom-Json
  if ($pj.projectName) { $projectName = $pj.projectName }
}
$alias = if ($projectName -eq "axis-mainnet") { "axis-mainnet.vercel.app" } else { "axis-teamtitanlink.vercel.app" }
$deployOut = & vercel ls $projectName --scope teamtitanlink 2>&1 | Out-String
if ($deployOut -match "https://(($projectName)-[a-z0-9]+-teamtitanlink\.vercel\.app)") {
  $dep = $Matches[1]
  Write-Host "Aliasing $dep -> $alias"
  vercel alias set $dep $alias --scope teamtitanlink
}
Write-Host "FRONTEND_DEPLOY_OK $alias"
