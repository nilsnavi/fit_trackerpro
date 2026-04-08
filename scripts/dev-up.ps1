param(
    [switch]$WithNgrok = $false,
    [switch]$Build = $true
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

$upArgs = @('compose') + $composeFiles + @('up', '-d')
if ($Build) {
    $upArgs += '--build'
}

Write-Host 'Starting FitTracker Pro in DEV mode (auto-reload)...' -ForegroundColor Cyan
& docker @upArgs

Write-Host ''
Write-Host 'Services:' -ForegroundColor Cyan
& docker compose @composeFiles ps

$migratorState = (& docker inspect fittracker-migrator --format "{{.State.Status}} {{.State.ExitCode}}" 2>$null)
if ($migratorState) {
    $parts = $migratorState -split ' '
    $status = $parts[0]
    $exitCode = if ($parts.Length -gt 1) { $parts[1] } else { '' }
    Write-Host ''
    if ($status -eq 'exited' -and $exitCode -eq '0') {
        Write-Host 'Migrator status: completed successfully (one-shot job).' -ForegroundColor Green
    } else {
        Write-Host ("Migrator status: " + $status + " (exit code " + $exitCode + ")") -ForegroundColor Yellow
        Write-Host 'Check logs: docker logs fittracker-migrator' -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'DEV endpoints:' -ForegroundColor Green
Write-Host '  Frontend HMR: http://localhost:18081'
Write-Host '  Edge proxy   : http://localhost:19000'
Write-Host '  Backend API  : http://localhost:18000/api/v1'

if ($WithNgrok) {
    Write-Host ''
    Write-Host 'Ngrok public URL: check logs with' -ForegroundColor Yellow
    Write-Host '  docker logs fittracker-ngrok'
}
