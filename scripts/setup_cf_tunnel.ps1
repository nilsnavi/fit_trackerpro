$ACCOUNT_ID = $env:CF_ACCOUNT_ID
$API_TOKEN = $env:CF_API_TOKEN

# Генерируем 32-байтный секрет в Base64
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$secret_bytes = New-Object byte[] 32
$rng.GetBytes($secret_bytes)
$tunnel_secret = [Convert]::ToBase64String($secret_bytes)

Write-Host "Creating named tunnel 'fittracker-dev'..."

$body = @{
    name = "fittracker-dev"
    tunnel_secret = $tunnel_secret
} | ConvertTo-Json

$resp = Invoke-RestMethod `
    -Uri "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $API_TOKEN"
        "Content-Type"  = "application/json"
    } `
    -Body $body

if (-not $resp.success) {
    Write-Host "ERROR: $($resp.errors | ConvertTo-Json)"
    exit 1
}

$TUNNEL_ID   = $resp.result.id
$TUNNEL_NAME = $resp.result.name

Write-Host "Tunnel created: $TUNNEL_NAME  (ID: $TUNNEL_ID)"

# Сохраняем credentials файл для cloudflared
$credentials = @{
    AccountTag   = $ACCOUNT_ID
    TunnelID     = $TUNNEL_ID
    TunnelName   = $TUNNEL_NAME
    TunnelSecret = $tunnel_secret
} | ConvertTo-Json

$creds_dir = "d:\Project\fit_trackerpro\.cloudflared"
New-Item -ItemType Directory -Force -Path $creds_dir | Out-Null
$credentials | Out-File -FilePath "$creds_dir\$TUNNEL_ID.json" -Encoding utf8

Write-Host "Credentials saved to $creds_dir\$TUNNEL_ID.json"
Write-Host "TUNNEL_ID=$TUNNEL_ID"
Write-Host "TUNNEL_SECRET=$tunnel_secret"
