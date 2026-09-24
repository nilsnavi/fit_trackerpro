$TOKEN = $env:CF_TUNNEL_TOKEN

docker rm -f fittracker-cloudflared-debug 2>$null

# Without --rm so we can read logs after exit
$id = docker run -d `
    --name fittracker-cloudflared-debug `
    --network fit_trackerpro_fittracker-network `
    cloudflare/cloudflared:latest `
    tunnel --no-autoupdate run --token $TOKEN

Write-Host "Container ID: $id"
Start-Sleep 10

Write-Host "=== Status ==="
docker inspect fittracker-cloudflared-debug --format "{{.State.Status}} ExitCode={{.State.ExitCode}}"

Write-Host "=== Logs ==="
docker logs fittracker-cloudflared-debug 2>&1
