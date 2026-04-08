#!/usr/bin/env pwsh
<#
.SYNOPSIS
    E2E Test Runner Script for FitTracker Pro

.DESCRIPTION
    Quick setup and execution script for Playwright E2E tests.

.PARAMETER Mode
    Test execution mode. Options:
    - all (default): Run all E2E tests
    - golden-path: Run only golden path tests
    - regression: Run only regression tests
    - workout-flows: Run only workout flow tests
    - ui: Interactive UI mode
    - headed: Run with visible browser
    - debug: Debug mode with inspector

.EXAMPLE
    .\e2e-test.ps1
    .\e2e-test.ps1 -Mode golden-path
    .\e2e-test.ps1 -Mode ui
#>

param(
    [ValidateSet('all', 'golden-path', 'regression', 'workout-flows', 'ui', 'headed', 'debug')]
    [string]$Mode = 'all'
)

# Helper functions
function Write-Header {
    param([string]$Text)
    Write-Host "▶ $Text" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Text)
    Write-Host "⚠ $Text" -ForegroundColor Yellow
}

# Change to project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Push-Location $projectRoot

# Check if we're in the right location
if (-not (Test-Path 'frontend/package.json')) {
    Write-Warning "package.json not found in frontend/. Changing to frontend directory..."
    Set-Location frontend
}

Write-Header "FitTracker Pro E2E Test Runner"
Write-Host "Current directory: $(Get-Location)"
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path 'node_modules')) {
    Write-Header "Installing dependencies..."
    npm ci --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Install Playwright browsers if needed
$browserPath1 = ".cache/ms-playwright"
$browserPath2 = "../.cache/ms-playwright"
if (-not (Test-Path $browserPath1) -and -not (Test-Path $browserPath2)) {
    Write-Header "Installing Playwright browsers..."
    npx playwright install chromium
}

Write-Header "Running E2E tests (mode: $Mode)"
Write-Host ""

switch ($Mode) {
    'golden-path' {
        Write-Header "Running golden path tests only..."
        npx playwright test --grep "@golden-path"
        Write-Success "Golden path tests completed!"
    }
    'regression' {
        Write-Header "Running regression tests..."
        npx playwright test --grep "@regression"
        Write-Success "Regression tests completed!"
    }
    'workout-flows' {
        Write-Header "Running workout flow tests..."
        npx playwright test --grep "@workout-flows"
        Write-Success "Workout flow tests completed!"
    }
    'ui' {
        Write-Header "Starting UI mode (interactive)..."
        npx playwright test --ui
    }
    'headed' {
        Write-Header "Running with visible browser..."
        npx playwright test --headed
        Write-Success "Tests with browser visibility completed!"
    }
    'debug' {
        Write-Header "Running in debug mode..."
        npx playwright test --debug
    }
    'all' {
        Write-Header "Running all E2E tests..."
        npx playwright test
        Write-Success "All E2E tests completed!"
    }
    default {
        Write-Host "Unknown mode: $Mode" -ForegroundColor Red
        exit 1
    }
}

# Generate and open report
if (Test-Path 'playwright-report/index.html') {
    Write-Success "Test report generated: playwright-report/"
    Write-Host "To view report, run: npx playwright show-report"
}

Write-Success "Done!"
Pop-Location
