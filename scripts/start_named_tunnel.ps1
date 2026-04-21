$TOKEN = $env:CF_TUNNEL_TOKEN

# Stop old container if exists
docker rm -f fittracker-cloudflared 2>$null

# Start named tunnel with token
$id = docker run --rm -d `
    --name fittracker-cloudflared `
    --network fit_trackerpro_fittracker-network `
    cloudflare/cloudflared:latest `
    tunnel --no-autoupdate run --token $TOKEN

if (-not $id) {
    Write-Host "ERROR: container failed to start"
    exit 1
}

Write-Host "Container ID: $id"
Start-Sleep 8

$logs = docker logs fittracker-cloudflared 2>&1
Write-Host "=== LOGS ==="
$logs | ForEach-Object { Write-Host $_ }
