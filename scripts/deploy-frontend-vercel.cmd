@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0\.."

for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
  set "name=%%A"
  if /i "!name:~0,5!"=="VITE_" set "%%A=%%B"
)

set "VITE_API_URL=https://axis-api-teamtitanlink.vercel.app"
set "VITE_ARBITRUM_CHAIN_ID=42161"

echo Deploying frontend chain=!VITE_ARBITRUM_CHAIN_ID!
call vercel deploy --prod --yes --scope teamtitanlink ^
  -b "VITE_API_URL=!VITE_API_URL!" ^
  -b "VITE_MAGIC_PUBLISHABLE_KEY=!VITE_MAGIC_PUBLISHABLE_KEY!" ^
  -b "VITE_PARTICLE_PROJECT_ID=!VITE_PARTICLE_PROJECT_ID!" ^
  -b "VITE_PARTICLE_CLIENT_KEY=!VITE_PARTICLE_CLIENT_KEY!" ^
  -b "VITE_PARTICLE_APP_ID=!VITE_PARTICLE_APP_ID!" ^
  -b "VITE_ZERODEV_PROJECT_ID=!VITE_ZERODEV_PROJECT_ID!" ^
  -b "VITE_ZERODEV_RPC_URL=!VITE_ZERODEV_RPC_URL!" ^
  -b "VITE_GOOGLE_CLIENT_ID=!VITE_GOOGLE_CLIENT_ID!" ^
  -b "VITE_ARBITRUM_RPC_URL=!VITE_ARBITRUM_RPC_URL!" ^
  -b "VITE_ARBITRUM_CHAIN_ID=42161"

if errorlevel 1 exit /b 1
echo FRONTEND_DEPLOY_OK
exit /b 0
