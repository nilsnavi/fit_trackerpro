param(
    [Parameter(Mandatory = $true)]
    [string]$Authtoken
)

$ErrorActionPreference = 'Stop'

$ngrokExe = 'C:\Users\Navitech-home\AppData\Roaming\npm\node_modules\ngrok\bin\ngrok.exe'
if (-not (Test-Path $ngrokExe)) {
    throw "ngrok.exe not found at $ngrokExe"
}

$frontendConfig = Join-Path $PSScriptRoot '..\ngrok.frontend.yml'
$backendConfig = Join-Path $PSScriptRoot '..\ngrok.backend.yml'

foreach ($p in @($frontendConfig, $backendConfig)) {
    if (-not (Test-Path $p)) { throw "Missing ngrok config: $p" }
}

# Kill any old agents to avoid port conflicts (4040/4041).
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Process -FilePath $ngrokExe -ArgumentList @(
    'start', 'fittracker-frontend',
    '--config', $frontendConfig,
    '--authtoken', $Authtoken,
    '--log', 'false'
) -WindowStyle Hidden | Out-Null

Start-Process -FilePath $ngrokExe -ArgumentList @(
    'start', 'fittracker-backend',
    '--config', $backendConfig,
    '--authtoken', $Authtoken,
    '--log', 'false'
) -WindowStyle Hidden | Out-Null

function Get-PublicUrl([int]$port, [string]$tunnelName) {
    $data = Invoke-RestMethod "http://127.0.0.1:$port/api/tunnels" -TimeoutSec 2
    return ($data.tunnels | Where-Object { $_.name -eq $tunnelName } | Select-Object -First 1).public_url
}

$frontendUrl = $null
$backendUrl = $null

for ($i=0; $i -lt 30; $i++) {
    try { if (-not $frontendUrl) { $frontendUrl = Get-PublicUrl 4040 'fittracker-frontend' } } catch {}
    try { if (-not $backendUrl) { $backendUrl = Get-PublicUrl 4041 'fittracker-backend' } } catch {}
    if ($frontendUrl -and $backendUrl) { break }
    Start-Sleep -Seconds 1
}

if (-not $frontendUrl -or -not $backendUrl) {
    throw "ngrok URLs not ready. Frontend=$frontendUrl Backend=$backendUrl"
}

Write-Output ("FRONTEND_URL=" + $frontendUrl)
Write-Output ("BACKEND_URL=" + $backendUrl)

