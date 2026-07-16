$ErrorActionPreference = "Stop"
Set-Location "C:\Users\RICHEY_SON\Desktop\axis\backend"

$argsList = @("deploy", "--prod", "--yes", "--scope", "teamtitanlink", "--force")

Get-Content .env | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
  $i = $line.IndexOf("=")
  $k = $line.Substring(0, $i)
  $v = $line.Substring($i + 1)
  switch ($k) {
    "DATABASE_URL" { $v = "sqlite+aiosqlite:////tmp/axis.db" }
    "FRONTEND_URL" { $v = "https://axis-teamtitanlink.vercel.app" }
    "CORS_ORIGINS" { $v = "https://axis-mainnet.vercel.app,https://axis-teamtitanlink.vercel.app,https://axis-three-phi.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000" }
    "ENVIRONMENT" { $v = "development" }
  }
  $argsList += "-e"
  $argsList += "${k}=${v}"
}

Write-Host "env count:" (($argsList | Where-Object { $_ -eq "-e" }).Count)
& vercel @argsList
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Capture latest deployment URL from vercel ls and alias
$ls = vercel ls axis-api --scope teamtitanlink 2>&1 | Out-String
if ($ls -match "https://(axis-[a-z0-9]+-teamtitanlink\.vercel\.app)") {
  $dep = "https://$($Matches[1])"
  Write-Host "Alias $dep -> axis-api-teamtitanlink.vercel.app"
  vercel alias set $dep axis-api-teamtitanlink.vercel.app --scope teamtitanlink
  vercel alias set $dep axis-api-beta.vercel.app --scope teamtitanlink
}
