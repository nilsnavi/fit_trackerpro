param(
    [Parameter(Mandatory = $true)]
    [string]$Authtoken
)

$ErrorActionPreference = 'Stop'

$ngrokExe = 'C:\Users\Navitech-home\AppData\Roaming\npm\node_modules\ngrok\bin\ngrok.exe'
if (-not (Test-Path $ngrokExe)) {
    throw "ngrok.exe not found at $ngrokExe"
}

$configPath = Join-Path $PSScriptRoot '..\ngrok.fittracker.yml'
if (-not (Test-Path $configPath)) {
    throw "ngrok config not found at $configPath"
}

# Start a single agent that serves multiple tunnels. ngrok API will be on 127.0.0.1:4040.
$args = @(
    'start', '--all',
    '--config', $configPath,
    '--authtoken', $Authtoken,
    '--log', 'false'
)

Start-Process -FilePath $ngrokExe -ArgumentList $args -WindowStyle Hidden | Out-Null

function Get-Url([string]$tunnelName) {
    $data = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2
    $t = $data.tunnels | Where-Object { $_.name -eq $tunnelName } | Select-Object -First 1
    if (-not $t) { return $null }
    $https = $t.public_url
    if ($https -like 'https://*') { return $https }
    return $https
}

$frontend = $null
$backend = $null

for ($i=0; $i -lt 30; $i++) {
    try {
        if (-not $frontend) { $frontend = Get-Url 'fittracker-frontend' }
        if (-not $backend) { $backend = Get-Url 'fittracker-backend' }
        if ($frontend -and $backend) { break }
    } catch {
        Start-Sleep -Seconds 1
        continue
    }
    Start-Sleep -Seconds 1
}

if (-not $frontend -or -not $backend) {
    throw "ngrok started, but tunnel URLs not found yet. Is web UI up at http://127.0.0.1:4040 ?"
}

Write-Output ("FRONTEND_URL=" + $frontend)
Write-Output ("BACKEND_URL=" + $backend)

