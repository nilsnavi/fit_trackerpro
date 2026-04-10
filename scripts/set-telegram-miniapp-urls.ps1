param(
    [Parameter(Mandatory = $true)]
    [string]$FrontendUrl,

    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [string]$BotUsername = ""
)

$ErrorActionPreference = 'Stop'

function Normalize-Url([string]$u) {
    $t = $u.Trim()
    if ($t.EndsWith('/')) { return $t.TrimEnd('/') }
    return $t
}

$FrontendUrl = Normalize-Url $FrontendUrl
$ApiUrl = Normalize-Url $ApiUrl

Write-Host "Writing frontend/public/config.js ..." -ForegroundColor Cyan
$configJsPath = Join-Path $PSScriptRoot "..\frontend\public\config.js"
$configJs = @"
window.__APP_CONFIG__ = {
  API_URL: '$ApiUrl',
  TELEGRAM_BOT_USERNAME: '$BotUsername',
  TELEGRAM_WEBAPP_URL: '$FrontendUrl',
  SENTRY_DSN: '',
  SENTRY_ENVIRONMENT: 'development',
  SENTRY_RELEASE: '',
    SENTRY_DIST: '',
};
"@
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $configJsPath), $configJs, $utf8NoBom)

Write-Host "Patching backend/.env (TELEGRAM_WEBAPP_URL, ALLOWED_ORIGINS) ..." -ForegroundColor Cyan
$backendEnvPath = Join-Path $PSScriptRoot "..\backend\.env"
if (-not (Test-Path $backendEnvPath)) {
    throw "backend/.env not found at $backendEnvPath. Create it from backend/.env.example first."
}

$backendEnv = Get-Content $backendEnvPath -Raw

function Upsert-EnvLine([string]$text, [string]$key, [string]$value) {
    $pattern = "(?m)^$([regex]::Escape($key))=.*$"
    if ($text -match $pattern) {
        return [regex]::Replace($text, $pattern, "$key=$value")
    }
    if (-not $text.EndsWith("`n")) { $text += "`n" }
    return $text + "$key=$value`n"
}

$backendEnv = Upsert-EnvLine $backendEnv "TELEGRAM_WEBAPP_URL" $FrontendUrl

# Ensure CORS includes the Telegram Mini App HTTPS origin.
$allowedOrigins = $null
if ($backendEnv -match "(?m)^ALLOWED_ORIGINS=(.*)$") {
    $allowedOrigins = $Matches[1]
}

if (-not $allowedOrigins) {
    $allowedOrigins = $FrontendUrl
} else {
    $parts = $allowedOrigins.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
    if ($parts -notcontains $FrontendUrl) {
        $parts += $FrontendUrl
    }
    $allowedOrigins = ($parts -join ',')
}

$backendEnv = Upsert-EnvLine $backendEnv "ALLOWED_ORIGINS" $allowedOrigins

[System.IO.File]::WriteAllText((Resolve-Path $backendEnvPath), $backendEnv, $utf8NoBom)

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Frontend URL: $FrontendUrl"
Write-Host "API URL     : $ApiUrl"
Write-Host ""
Write-Host "Restart containers to apply backend .env changes:" -ForegroundColor Yellow
Write-Host "  docker compose restart backend"

