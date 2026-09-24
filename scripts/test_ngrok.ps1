$url = "https://postcardiac-uneruptive-dung.ngrok-free.dev"
$out = "d:\Project\fit_trackerpro\scripts\ngrok_test_result.txt"

"Testing ngrok tunnel..." | Out-File $out

# Test 1: local frontend
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:18080" -UseBasicParsing -TimeoutSec 5
    "Local 18080: Status $($r.StatusCode)" | Out-File $out -Append
} catch {
    "Local 18080: ERROR - $($_.Exception.Message)" | Out-File $out -Append
}

# Test 2: ngrok with skip header
try {
    $r = Invoke-WebRequest -Uri "$url/api/v1/system/ready" -UseBasicParsing -Headers @{"ngrok-skip-browser-warning"="true"} -TimeoutSec 20
    "Ngrok API: Status $($r.StatusCode) - $($r.Content)" | Out-File $out -Append
} catch {
    "Ngrok API: ERROR - $($_.Exception.Message)" | Out-File $out -Append
}

# Test 3: ngrok tunnel status
try {
    $t = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 5
    "Tunnel: $($t.tunnels[0].public_url) -> $($t.tunnels[0].config.addr)" | Out-File $out -Append
} catch {
    "Tunnel API: ERROR - $($_.Exception.Message)" | Out-File $out -Append
}

"Done." | Out-File $out -Append
