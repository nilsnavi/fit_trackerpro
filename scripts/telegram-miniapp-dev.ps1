param(
    [switch]$WithTunnel = $true,
    [ValidateSet('localtunnel', 'ngrok')]
    [string]$TunnelProvider = 'localtunnel',
    [string]$NgrokAuthtoken = $env:NGROK_AUTHTOKEN
)

$ErrorActionPreference = 'Stop'

Write-Host "Starting FitTracker Pro (docker compose)..." -ForegroundColor Cyan

if ($WithTunnel) {
    if ($TunnelProvider -eq 'localtunnel') {
        docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.localtunnel.yml up -d --build
    } elseif ($TunnelProvider -eq 'ngrok') {
        docker compose up -d --build
        if (-not $NgrokAuthtoken) {
            throw "NgrokAuthtoken is required. Pass -NgrokAuthtoken <token> or set env: NGROK_AUTHTOKEN."
        }
        $ngrokOut = powershell -ExecutionPolicy Bypass -File .\scripts\ngrok-start.ps1 -Authtoken $NgrokAuthtoken
        $ngrokOut | Write-Host
        $frontendUrl = ($ngrokOut | Where-Object { $_ -like 'FRONTEND_URL=*' } | Select-Object -First 1) -replace '^FRONTEND_URL=', ''
        $backendUrl = ($ngrokOut | Where-Object { $_ -like 'BACKEND_URL=*' } | Select-Object -First 1) -replace '^BACKEND_URL=', ''
    }
} else {
    docker compose up -d --build
}

Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
docker compose ps

if (-not $WithTunnel) {
    Write-Host ""
    Write-Host "Tunnel disabled. Frontend: http://localhost:5173  API: http://localhost:18000/api/v1" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Waiting for tunnel URLs (trycloudflare.com)..." -ForegroundColor Cyan

function Get-LocaltunnelUrl([string]$containerName) {
    $logs = docker logs --tail 120 $containerName 2>$null
    $m = $logs | Select-String -Pattern 'https://[a-zA-Z0-9.-]+\.loca\.lt' -AllMatches | Select-Object -Last 1
    if ($m -and $m.Matches.Count -gt 0) { return $m.Matches[0].Value }
    return $null
}

if (-not (Get-Variable -Name frontendUrl -Scope Local -ErrorAction SilentlyContinue)) { $frontendUrl = $null }
if (-not (Get-Variable -Name backendUrl -Scope Local -ErrorAction SilentlyContinue)) { $backendUrl = $null }

for ($i = 0; $i -lt 45; $i++) {
    if ($TunnelProvider -eq 'localtunnel') {
        if (-not $frontendUrl) { $frontendUrl = Get-LocaltunnelUrl "fittracker-tunnel-frontend" }
        if (-not $backendUrl) { $backendUrl = Get-LocaltunnelUrl "fittracker-tunnel-backend" }
    }
    if ($frontendUrl -and $backendUrl) { break }
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "Tunnel URLs:" -ForegroundColor Green
if ($frontendUrl) {
    Write-Host ("  FRONTEND: " + $frontendUrl)
} else {
    Write-Host "  FRONTEND: <not found yet; run: docker compose logs tunnel-frontend -f>"
}
if ($backendUrl) {
    Write-Host ("  BACKEND : " + $backendUrl)
} else {
    Write-Host "  BACKEND : <not found yet; run: docker compose logs tunnel-backend -f>"
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1) In @BotFather -> Bot Settings -> Menu Button set Mini App URL = FRONTEND URL (HTTPS)."
Write-Host "2) Apply URLs to runtime config and backend .env:"
Write-Host "   powershell -ExecutionPolicy Bypass -File .\scripts\set-telegram-miniapp-urls.ps1 -FrontendUrl `"$frontendUrl`" -ApiUrl `"$backendUrl/api/v1`""

