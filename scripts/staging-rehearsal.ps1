param(
    [string]$Repo = "nilsnavi/fit_trackerpro",
    [string]$Environment = "staging",
    [string]$Ref = "main",
    [string]$ImageTag = "",
    [switch]$Dispatch,
    [switch]$Wait,
    [string]$ApiBaseUrl = "",
    [string]$FrontendBaseUrl = "",
    [switch]$Smoke,
    [switch]$CheckServer
)

$ErrorActionPreference = "Stop"

$RequiredSecrets = @(
    "DEPLOY_HOST",
    "DEPLOY_USER",
    "SSH_PRIVATE_KEY",
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

function Get-Token {
    if ($env:GITHUB_TOKEN) { return $env:GITHUB_TOKEN }
    if ($env:GH_TOKEN) { return $env:GH_TOKEN }
    throw "GITHUB_TOKEN or GH_TOKEN is required. Token needs repo Actions and Environment secrets read access."
}

function Invoke-GitHubApi {
    param(
        [ValidateSet("GET", "POST")]
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )

    $token = Get-Token
    $headers = @{
        Authorization          = "Bearer $token"
        Accept                 = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
        "User-Agent"           = "fittracker-staging-rehearsal"
    }
    $uri = "https://api.github.com$Path"

    try {
        if ($null -eq $Body) {
            return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
        }
        $json = $Body | ConvertTo-Json -Depth 10
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json -ContentType "application/json"
    }
    catch {
        $response = $_.Exception.Response
        if ($response -and $response.StatusCode) {
            $statusCode = [int]$response.StatusCode
            throw "GitHub API $Method $Path failed with HTTP $statusCode. $($_.Exception.Message)"
        }
        throw
    }
}

function Assert-ImageTag {
    param([string]$Tag)

    if ([string]::IsNullOrWhiteSpace($Tag)) {
        $shortSha = (git rev-parse --short HEAD).Trim()
        $Tag = "main-$shortSha"
    }

    if ($Tag -eq "latest") {
        throw "image_tag must be versioned and must not be 'latest'."
    }

    return $Tag
}

function Test-JsonEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [scriptblock]$Predicate
    )

    Write-Host "Checking $Name -> $Url"
    $response = Invoke-RestMethod -Method GET -Uri $Url
    if (-not (& $Predicate $response)) {
        throw "Smoke check failed: $Name returned unexpected JSON."
    }
    Write-Host "OK: $Name"
}

function Test-HttpEndpoint {
    param(
        [string]$Name,
        [string]$Url
    )

    Write-Host "Checking $Name -> $Url"
    $response = Invoke-WebRequest -Method GET -Uri $Url -UseBasicParsing
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
        throw "Smoke check failed: $Name returned HTTP $($response.StatusCode)."
    }
    Write-Host "OK: $Name"
}

$ImageTag = Assert-ImageTag $ImageTag
Write-Host "Repository: $Repo"
Write-Host "Environment: $Environment"
Write-Host "Ref: $Ref"
Write-Host "Image tag: $ImageTag"

$repoPath = "/repos/$Repo"

Write-Host "Checking GitHub Environment..."
$environmentInfo = Invoke-GitHubApi -Method GET -Path "$repoPath/environments/$Environment"
Write-Host "OK: Environment '$($environmentInfo.name)' exists."

Write-Host "Checking Environment secrets..."
$secretsResponse = Invoke-GitHubApi -Method GET -Path "$repoPath/environments/$Environment/secrets"
$presentSecrets = @($secretsResponse.secrets | ForEach-Object { $_.name })
$missingSecrets = @($RequiredSecrets | Where-Object { $presentSecrets -notcontains $_ })

if ($missingSecrets.Count -gt 0) {
    Write-Host "Missing required Environment secrets:"
    $missingSecrets | ForEach-Object { Write-Host " - $_" }
    throw "Cannot continue until missing staging secrets are configured."
}
Write-Host "OK: all required Environment secrets are present."

$workflow = Invoke-GitHubApi -Method GET -Path "$repoPath/actions/workflows/deploy.yml"
if ($workflow.state -ne "active") {
    throw "deploy.yml workflow is not active. Current state: $($workflow.state)"
}
Write-Host "OK: deploy.yml is active."

if ($Dispatch) {
    Write-Host "Dispatching deploy.yml..."
    $body = @{
        ref    = $Ref
        inputs = @{
            environment         = $Environment
            image_tag           = $ImageTag
            rollback_restore_db = "false"
        }
    }
    Invoke-GitHubApi -Method POST -Path "$repoPath/actions/workflows/deploy.yml/dispatches" -Body $body | Out-Null
    Write-Host "OK: workflow_dispatch submitted."

    if ($Wait) {
        Start-Sleep -Seconds 10
        $run = $null
        for ($i = 1; $i -le 120; $i++) {
            $runs = Invoke-GitHubApi -Method GET -Path "$repoPath/actions/workflows/deploy.yml/runs?event=workflow_dispatch&branch=$Ref&per_page=5"
            $run = @($runs.workflow_runs | Where-Object { $_.head_branch -eq $Ref } | Select-Object -First 1)
            if ($null -ne $run) {
                Write-Host "Run $($run.id): status=$($run.status), conclusion=$($run.conclusion), url=$($run.html_url)"
                if ($run.status -eq "completed") {
                    if ($run.conclusion -ne "success") {
                        throw "Deploy workflow completed with conclusion=$($run.conclusion)."
                    }
                    Write-Host "OK: deploy workflow completed successfully."
                    break
                }
            }
            Start-Sleep -Seconds 15
        }
        if ($null -eq $run -or $run.status -ne "completed") {
            throw "Timed out waiting for deploy workflow completion."
        }
    }
}
else {
    Write-Host "Dispatch skipped. Re-run with -Dispatch to start deploy.yml."
}

if ($Smoke) {
    if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
        throw "-ApiBaseUrl is required for smoke checks, for example https://staging.example.com/api/v1."
    }
    $api = $ApiBaseUrl.TrimEnd("/")
    if ([string]::IsNullOrWhiteSpace($FrontendBaseUrl)) {
        $FrontendBaseUrl = $api -replace "/api/v1$", ""
    }
    $frontend = $FrontendBaseUrl.TrimEnd("/")

    Test-JsonEndpoint "backend health" "$api/system/health" { param($json) $json.status -eq "healthy" }
    Test-JsonEndpoint "backend readiness" "$api/system/ready" { param($json) $json.status -eq "ready" -and $json.checks.postgres -eq "ok" -and $json.checks.redis -eq "ok" }
    Test-JsonEndpoint "backend version" "$api/system/version" { param($json) $null -ne $json.version }
    Test-HttpEndpoint "frontend healthz" "$frontend/healthz"
    Write-Host "OK: smoke checks passed."
}

if ($CheckServer) {
    if (-not $env:DEPLOY_HOST -or -not $env:DEPLOY_USER) {
        throw "DEPLOY_HOST and DEPLOY_USER environment variables are required for -CheckServer."
    }
    $server = "$($env:DEPLOY_USER)@$($env:DEPLOY_HOST)"
    $remoteCommand = "cd ~/fittracker-pro && test -f backups/.last_pre_migrate_backup_path && DB_BACKUP_PATH=`$(tr -d '\r\n' < backups/.last_pre_migrate_backup_path) && test -n `"$DB_BACKUP_PATH`" && test -f `"$DB_BACKUP_PATH`" && grep -E '^DB_BACKUP_PATH=' .rollback-meta.env"
    ssh $server $remoteCommand
    if ($LASTEXITCODE -ne 0) {
        throw "Server backup/rollback metadata check failed."
    }
    Write-Host "OK: server backup metadata exists."
}

Write-Host "Manual Telegram golden path is still required: login, create/start/finish workout, verify analytics."
