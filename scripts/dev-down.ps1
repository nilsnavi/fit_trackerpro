param(
    [switch]$WithNgrok = $false,
    [switch]$PruneVolumes = $false
)

$ErrorActionPreference = 'Stop'

$composeFiles = @(
    '-f', 'docker-compose.yml',
    '-f', 'docker-compose.override.yml',
    '-f', 'docker-compose.dev.yml'
)

if ($WithNgrok) {
    $composeFiles += @('-f', 'docker-compose.tunnel.yml')
}

$downArgs = @('compose') + $composeFiles + @('down')
if ($PruneVolumes) {
    $downArgs += '-v'
}

Write-Host 'Stopping FitTracker Pro DEV stack...' -ForegroundColor Cyan
& docker @downArgs

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host 'Tip: start again with:' -ForegroundColor Yellow
Write-Host '  powershell -ExecutionPolicy Bypass -File .\scripts\dev-up.ps1'
