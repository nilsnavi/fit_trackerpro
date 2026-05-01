Write-Host "Waiting for Docker Engine..."
$maxWait = 120
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $null = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Docker Engine is ready!"
            break
        }
    } catch {}
    Start-Sleep 5
    $waited += 5
    Write-Host "  waiting... ($waited s)"
}

if ($waited -ge $maxWait) {
    Write-Host "ERROR: Docker Engine did not start within ${maxWait}s"
    exit 1
}

Write-Host "Building backend and frontend images..."
docker compose -f d:\Project\fit_trackerpro\docker-compose.yml build --no-cache backend frontend 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker image build failed"
    exit 1
}

Write-Host "Starting all containers with env file..."
docker compose -f d:\Project\fit_trackerpro\docker-compose.yml --env-file d:\Project\fit_trackerpro\.env.ngrok up -d --force-recreate 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Containers failed to start"
    exit 1
}

Write-Host "Waiting for services to be healthy..."
Start-Sleep 15

$containers = docker ps --format "{{.Names}} {{.Status}}" 2>&1
Write-Host "=== Containers ==="
$containers | ForEach-Object { Write-Host $_ }

Write-Host "=== Backend health ==="
try {
    $r = Invoke-RestMethod -Uri "http://localhost:18000/api/v1/system/ready" -TimeoutSec 10
    $r | ConvertTo-Json
} catch {
    Write-Host "Backend not ready yet: $($_.Exception.Message)"
}

Write-Host "=== Frontend health ==="
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:18080" -UseBasicParsing -TimeoutSec 5
    Write-Host "Frontend: Status $($r.StatusCode)"
} catch {
    Write-Host "Frontend not ready: $($_.Exception.Message)"
}

Write-Host "Done!"
