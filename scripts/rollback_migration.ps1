#Requires -Version 5.1
<#
.SYNOPSIS
    Zero-downtime DB rollback helper for FitTracker Pro (Windows / PowerShell).

.DESCRIPTION
    Safely rolls back one or more Alembic database migrations with validation
    gates, confirmation prompts, and post-rollback guidance.

.PARAMETER Target
    Alembic revision ID or special value to downgrade to.
    Default: "-1" (one step back).
    Examples: "c3a9d7e11f2b", "-1", "base"

.PARAMETER Confirm
    Switch that must be provided to execute the rollback (safety gate).

.EXAMPLE
    # Roll back one step
    .\scripts\rollback_migration.ps1 -Confirm

.EXAMPLE
    # Roll back to a specific revision
    .\scripts\rollback_migration.ps1 -Target c3a9d7e11f2b -Confirm
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [string] $Target = "-1",
    [switch] $Confirm
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot      = Split-Path -Parent $PSScriptRoot
$MigrationsDir = Join-Path $RepoRoot "database\migrations"
$ToolsDir      = Join-Path $RepoRoot "backend\tools"

function Write-Info  ($msg) { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok    ($msg) { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn  ($msg) { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err   ($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Exit-Err    ($msg) { Write-Err $msg; exit 1 }

# ─── Gate 1: explicit -Confirm flag ────────────────────────────────────────
if (-not $Confirm) {
    Exit-Err @"
Safety gate: pass -Confirm to execute the rollback.

  .\scripts\rollback_migration.ps1 [-Target <revision>] -Confirm
"@
}

# ─── Gate 2: DATABASE_URL must be set ──────────────────────────────────────
$dbUrl = [System.Environment]::GetEnvironmentVariable("DATABASE_URL")
if (-not $dbUrl) {
    Exit-Err "DATABASE_URL environment variable is not set."
}
if ($dbUrl -notmatch "^postgresql") {
    Exit-Err "DATABASE_URL does not look like a PostgreSQL URL:`n  $dbUrl"
}

# ─── Gate 3: prerequisite tools ────────────────────────────────────────────
foreach ($cmd in @("alembic", "python")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Exit-Err "$cmd not found in PATH. Activate the Python virtualenv."
    }
}

# ─── Step 1: validate chain integrity ──────────────────────────────────────
Write-Info "Step 1/4 — Validating migration chain integrity…"
python "$ToolsDir\test_migrations.py" --validate-chain
if ($LASTEXITCODE -ne 0) {
    Exit-Err "Migration chain validation failed. Fix errors before rolling back."
}
Write-Ok "Chain validation passed."

# ─── Step 2: current revision ──────────────────────────────────────────────
Write-Info "Step 2/4 — Checking current DB revision…"
Push-Location $MigrationsDir
try {
    $current = alembic current 2>&1
    Write-Host $current

    # ─── Step 3: plan & confirm ────────────────────────────────────────────
    Write-Info "Step 3/4 — Target revision: $Target"
    Write-Warning "This operation cannot be undone automatically. Ensure you have a DB backup."
    Write-Host ""
    alembic history --indicate-current 2>$null | Select-Object -First 20

    Write-Host ""
    $reply = Read-Host "Proceed with downgrade to '$Target'? [yes/n]"
    if ($reply -ne "yes") {
        Write-Warn "Rollback aborted by user."
        exit 0
    }

    # ─── Step 4: execute ───────────────────────────────────────────────────
    Write-Info "Step 4/4 — Running: alembic downgrade $Target"
    alembic downgrade $Target
    if ($LASTEXITCODE -ne 0) {
        Exit-Err "alembic downgrade failed (exit code $LASTEXITCODE)."
    }

    $newCurrent = alembic current 2>&1
    Write-Ok "Rollback complete. Current revision: $newCurrent"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  1. Verify application health: curl -f https://your-app/api/health"
    Write-Host "  2. Check logs for schema-related errors."
    Write-Host "  3. To re-apply: cd database\migrations && alembic upgrade head"
}
finally {
    Pop-Location
}
