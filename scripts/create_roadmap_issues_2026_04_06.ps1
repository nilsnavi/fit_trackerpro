param(
    [string]$Repo = "nilsnavi/fit_trackerpro"
)

$ErrorActionPreference = "Stop"

$gh = "gh"
if (-not (Get-Command $gh -ErrorAction SilentlyContinue)) {
    $portableGh = "C:\Users\Navitech-home\tools\gh\bin\gh.exe"
    if (Test-Path $portableGh) {
        $gh = $portableGh
    } else {
        throw "GitHub CLI (gh) is not available. Install it first."
    }
}

& $gh auth status | Out-Null

# Use only labels that actually exist in the repository to avoid create failures.
$existingLabels = @{}
& $gh label list --repo $Repo --limit 200 --json name | ConvertFrom-Json | ForEach-Object {
    $existingLabels[$_.name] = $true
}

$issues = @(
    @{
        title = "P0 - Implement Telegram auth onboarding UX"
        labels = @("roadmap","feature","auth","frontend","P0","estimate-M")
        body = @"
Implement a real onboarding/authentication user flow in frontend for Telegram Mini App.

Scope:
- Add auth entry flow from Telegram init data.
- Exchange init data with backend auth endpoint.
- Persist/refresh auth token with clear lifecycle handling.
- Add route guards for protected routes.
- Add clear unauthorized/re-auth UX state.

Acceptance Criteria:
- New user can sign in from Mini App without manual token injection.
- Protected routes are blocked for unauthorized users.
- Refresh flow is handled without random logout loops.
- Unauthorized state has actionable UX.

Definition of Done:
- Unit tests for guard/token lifecycle logic.
- One E2E happy path auth test.
- Docs updated for local auth test flow.

Dependencies:
- None.
"@
    }
    @{
        title = "P0 - Replace workout builder mock exercises with API catalog"
        labels = @("roadmap","feature","workouts","frontend","backend","P0","estimate-M")
        body = @"
Replace mock exercise data source in workout builder with real API-backed catalog integration.

Scope:
- Use real exercise catalog API in builder picker.
- Keep existing draft autosave behavior.
- Validate payload integrity using real exercise IDs.
- Handle loading/empty/error states in builder exercise picker.

Acceptance Criteria:
- Template creation works with real catalog exercises only.
- No mock exercise references remain in builder flow.
- Template can be started immediately after creation.

Definition of Done:
- Integration tests for builder payload mapping.
- Regression test for draft recovery with API-backed items.

Dependencies:
- Depends on: P0 - Implement Telegram auth onboarding UX.
"@
    }
    @{
        title = "P0 - Add explicit offline/retry status UX in active workout flow"
        labels = @("roadmap","feature","workouts","frontend","ux","P0","estimate-S")
        body = @"
Expose clear user-facing status for mutation outcomes in active workout session.

Scope:
- Show explicit states: success, queued offline, retrying, failed.
- Standardize error toasts/messages for complete/start/update actions.
- Add recovery actions in UI when operation fails.

Acceptance Criteria:
- User always knows if action was applied, queued, or failed.
- Retry action is available when relevant.
- Offline queue states are visible and understandable.

Definition of Done:
- UI tests for state rendering.
- Manual test checklist for offline mode and reconnect behavior.

Dependencies:
- Depends on: P0 - Replace workout builder mock exercises with API catalog.
"@
    }
    @{
        title = "P1 - Wire analytics page to live backend endpoints"
        labels = @("roadmap","feature","analytics","frontend","backend","P1","estimate-M")
        body = @"
Replace analytics mock generator with live API integration.

Scope:
- Connect analytics page to backend analytics endpoints.
- Align frontend filters/date ranges with backend contracts.
- Add per-widget loading, empty, and error handling.

Acceptance Criteria:
- Analytics reflects real user training data after workout completion.
- No mock-only data source remains on analytics page.
- Chart blocks handle error/empty states gracefully.

Definition of Done:
- Contract tests for analytics adapters.
- E2E check from completed workout to analytics update.

Dependencies:
- Depends on: P0 - Add explicit offline/retry status UX in active workout flow.
"@
    }
    @{
        title = "P1 - Add dependency-aware readiness checks"
        labels = @("roadmap","reliability","backend","devops","P1","estimate-M")
        body = @"
Improve service health strategy by introducing readiness behavior based on DB/Redis availability.

Scope:
- Keep liveness endpoint lightweight.
- Add readiness endpoint or readiness mode including DB/Redis dependency checks.
- Return non-success code for readiness when dependencies are unavailable.
- Update deploy and smoke checks accordingly.

Acceptance Criteria:
- Liveness and readiness semantics are clearly separated.
- Deployment validation uses readiness in production-like checks.
- Degraded dependencies are detectable by orchestrator and operators.

Definition of Done:
- Backend tests for readiness scenarios.
- Docs updated with endpoint semantics and runbook usage.

Dependencies:
- Depends on: P1 - Wire analytics page to live backend endpoints.
"@
    }
    @{
        title = "P1 - Harden rollback playbook for schema-evolving releases"
        labels = @("roadmap","reliability","database","devops","P1","estimate-S")
        body = @"
Create explicit rollback decision tree for app image rollback versus DB rollback/downgrade.

Scope:
- Document when image rollback alone is safe.
- Document when DB restore or alembic downgrade is required.
- Add first-deploy rollback caveat handling.
- Align manual runbook with CI deploy sequence.

Acceptance Criteria:
- On-call can choose rollback path in less than 5 minutes.
- Runbook includes migration compatibility checks.
- First deployment edge case is explicitly covered.

Definition of Done:
- Updated deployment and rollback docs reviewed by backend/devops.
- Dry-run tabletop scenario completed.

Dependencies:
- Depends on: P0 - Add explicit offline/retry status UX in active workout flow.
"@
    }
    @{
        title = "P1 - Create end-to-end regression for MVP golden path"
        labels = @("roadmap","test","e2e","ci","P1","estimate-M")
        body = @"
Add deterministic E2E regression covering core MVP path.

Scope:
- Cover flow: auth -> create template -> start workout -> complete workout -> analytics visible.
- Stabilize selectors and test data fixtures.
- Avoid flaky parallel suite contention for local and CI reliability.

Acceptance Criteria:
- Golden path test runs reliably in CI.
- Local execution guidance for stable runs is documented.
- Test blocks merges on regression.

Definition of Done:
- CI job added or updated with clear pass/fail gate.
- Flakiness tracked below agreed threshold.

Dependencies:
- Depends on: P1 - Wire analytics page to live backend endpoints.
"@
    }
    @{
        title = "P2 - Enhance workout session data depth (rest and intensity insights)"
        labels = @("roadmap","feature","workouts","analytics","P2","estimate-L")
        body = @"
Expand session model and UX to support richer rest/intensity tracking and post-session insights.

Scope:
- Confirm product contract for rest/intensity fields.
- Persist and surface richer session metrics.
- Keep backward compatibility for existing logs.
- Improve post-session summary UX based on new data.

Acceptance Criteria:
- New metrics are visible and meaningful in session summary/analytics.
- Historical records remain readable and stable.
- No regressions in complete workout flow.

Definition of Done:
- Migration plan validated.
- Backward compatibility tested on sample historical data.
- UX reviewed for clarity and usefulness.

Dependencies:
- Depends on: P1 - Add dependency-aware readiness checks.
- Depends on: P1 - Harden rollback playbook for schema-evolving releases.
"@
    }
)

foreach ($issue in $issues) {
    $labelArgs = @()
    $resolvedLabels = @()

    foreach ($label in $issue.labels) {
        if ($existingLabels.ContainsKey($label)) {
            $resolvedLabels += $label
        }
    }

    if ($resolvedLabels.Count -eq 0 -and $existingLabels.ContainsKey("enhancement")) {
        $resolvedLabels += "enhancement"
    }

    if ($existingLabels.ContainsKey("codex") -and -not ($resolvedLabels -contains "codex")) {
        $resolvedLabels += "codex"
    }

    foreach ($label in $resolvedLabels) {
        $labelArgs += "--label"
        $labelArgs += $label
    }

    Write-Host "Creating issue: $($issue.title)"
    & $gh issue create --repo $Repo --title $issue.title --body $issue.body @labelArgs | Write-Host
}

Write-Host "All roadmap issues created successfully in $Repo"
