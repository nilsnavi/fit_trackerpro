$TOKEN = $env:CF_TUNNEL_TOKEN
$OUT = "d:\Project\fit_trackerpro\scripts\named_tunnel_result.txt"
$NET = "fit_trackerpro_fittracker-network"

"Starting named tunnel..." | Out-File $OUT

& docker rm -f fittracker-cloudflared-debug 2>$null
& docker rm -f fittracker-cloudflared 2>$null

$id = & docker run -d --name fittracker-cloudflared-debug --network $NET cloudflare/cloudflared:latest tunnel --no-autoupdate run --token $TOKEN
"Container ID: $id" | Out-File $OUT -Append

Start-Sleep 12

$status = & docker inspect fittracker-cloudflared-debug --format "{{.State.Status}} ExitCode={{.State.ExitCode}}" 2>&1
"Status: $status" | Out-File $OUT -Append

$logs = & docker logs fittracker-cloudflared-debug 2>&1
"=== LOGS ===" | Out-File $OUT -Append
$logs | Out-File $OUT -Append
