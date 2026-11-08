param(
    [Parameter(Mandatory)]
    [ValidateSet("staging", "production")]
    [string]$Environment,

    [Parameter(Mandatory)]
    [string]$SecretsFile,

    [string]$Repo = "nilsnavi/fit_trackerpro"
)

$ErrorActionPreference = "Stop"

$RequiredSecrets = @(
    "DEPLOY_HOST",
    "DEPLOY_USER",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "SECRET_KEY",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBAPP_URL",
    "ALLOWED_ORIGINS",
    "VITE_API_URL",
    "VITE_TELEGRAM_BOT_USERNAME"
)

function Read-DotEnv {
    param([string]$Path)

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) {
            continue
        }
        if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            throw "Invalid .env entry in $Path."
        }

        $name = $Matches[1]
        $value = $Matches[2]
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$name] = $value
    }
    return $values
}

function Test-HttpsUrl {
    param([string]$Value)

    $uri = $null
    return [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri) -and $uri.Scheme -eq "https" -and -not [string]::IsNullOrWhiteSpace($uri.Host)
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) is required."
}

$resolvedSecretsFile = Resolve-Path -LiteralPath $SecretsFile -ErrorAction Stop
$secrets = Read-DotEnv $resolvedSecretsFile
$missing = @($RequiredSecrets | Where-Object { [string]::IsNullOrWhiteSpace($secrets[$_]) })
if ($missing.Count -gt 0) {
    throw "Missing required secret names: $($missing -join ', ')."
}

if ([string]::IsNullOrWhiteSpace($secrets["SSH_PRIVATE_KEY_FILE"])) {
    throw "SSH_PRIVATE_KEY_FILE is required and must point to an unencrypted CI private key."
}

$sshKeyPath = $secrets["SSH_PRIVATE_KEY_FILE"]
if (-not [IO.Path]::IsPathRooted($sshKeyPath)) {
    $sshKeyPath = Join-Path (Split-Path -Parent $resolvedSecretsFile) $sshKeyPath
}
$sshKeyPath = Resolve-Path -LiteralPath $sshKeyPath -ErrorAction Stop
$sshPrivateKey = Get-Content -LiteralPath $sshKeyPath -Raw
if ([string]::IsNullOrWhiteSpace($sshPrivateKey)) {
    throw "SSH_PRIVATE_KEY_FILE is empty."
}

# CI cannot supply an interactive passphrase. This also rejects malformed keys.
& ssh-keygen -y -P "" -f $sshKeyPath 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "SSH_PRIVATE_KEY_FILE must contain a valid private key without a passphrase."
}

if ($secrets["DEPLOY_HOST"] -match '[\s/:@]') {
    throw "DEPLOY_HOST must be a hostname or IP address without a scheme, path, port, or user."
}
if ($secrets["DEPLOY_USER"] -match '\s') {
    throw "DEPLOY_USER must not contain whitespace."
}
if ($secrets["SECRET_KEY"].Length -lt 32) {
    throw "SECRET_KEY must be at least 32 characters."
}
if ($secrets["TELEGRAM_BOT_TOKEN"] -notmatch '^\d+:[A-Za-z0-9_-]+$') {
    throw "TELEGRAM_BOT_TOKEN has an invalid format."
}
if (-not (Test-HttpsUrl $secrets["TELEGRAM_WEBAPP_URL"])) {
    throw "TELEGRAM_WEBAPP_URL must be an absolute HTTPS URL."
}
if ($secrets["ALLOWED_ORIGINS"] -match '\*') {
    throw "ALLOWED_ORIGINS must not contain a wildcard."
}
$origins = @($secrets["ALLOWED_ORIGINS"] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($origins.Count -eq 0 -or @($origins | Where-Object { -not (Test-HttpsUrl $_) }).Count -gt 0) {
    throw "ALLOWED_ORIGINS must be a comma-separated list of HTTPS origins."
}
if (-not (Test-HttpsUrl $secrets["VITE_API_URL"]) -or ([Uri]$secrets["VITE_API_URL"]).AbsolutePath.TrimEnd('/') -ne '/api/v1') {
    throw "VITE_API_URL must be an HTTPS URL ending in /api/v1."
}
if ($secrets["VITE_TELEGRAM_BOT_USERNAME"] -notmatch '^@?[A-Za-z0-9_]{5,32}$') {
    throw "VITE_TELEGRAM_BOT_USERNAME has an invalid format."
}

foreach ($name in $RequiredSecrets) {
    $secrets[$name] | gh secret set $name --repo $Repo --env $Environment
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set environment secret '$name'."
    }
}
$sshPrivateKey | gh secret set SSH_PRIVATE_KEY --repo $Repo --env $Environment
if ($LASTEXITCODE -ne 0) {
    throw "Failed to set environment secret 'SSH_PRIVATE_KEY'."
}

Write-Host "Configured $($RequiredSecrets.Count + 1) secret names in '$Environment'. Values were not printed."
