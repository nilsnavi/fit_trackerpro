# E2E Tests Documentation

## Overview

Playwright-based E2E tests for FitTracker Pro covering the complete user workflow (golden path):

1. Open app
2. Authenticate (Telegram mock or token)
3. Create workout
4. Add exercises
5. Log sets
6. Complete workout
7. Verify in history

## Test Structure

```
frontend/e2e/
├── fixtures.ts                    # Reusable Playwright fixtures
├── golden-path.spec.ts           # Golden path (main user flow)
├── critical-path.workout.spec.ts # Critical path (existing test)
├── telegram-auth-onboarding.spec.ts
├── workout-mode-flows.spec.ts
├── helpers/
│   ├── telegram-mock.ts          # Telegram WebApp mock
│   ├── workout-api-mock.ts       # Workout API mocking harness
│   └── auth.ts                   # Auth helpers (password, Telegram, token)
└── utils/
    └── auth.ts                    # Auth utilities
```

## Running Tests Locally

### Run all E2E tests
```bash
npm run e2e
```

### Run specific test file
```bash
npx playwright test frontend/e2e/golden-path.spec.ts
```

### Run with UI mode (interactive)
```bash
npm run e2e:ui
```

### Run in headed mode (see browser)
```bash
npm run e2e:headed
```

### Run only golden path tests
```bash
npx playwright test --grep @golden-path
```

### Run only regression tests
```bash
npx playwright test --grep @regression
```

## Running Tests in CI

Tests run automatically on push/merge request via GitLab CI:

```bash
npm run e2e:ci                    # All E2E tests
npm run e2e:ci:workout-flows      # Workout-specific flows
npm run e2e:ci:regression         # Regression suite
```

CI jobs:
- `e2e_frontend` - Full E2E suite (no retry)
- `e2e_frontend_workout_flows` - Workout creation/editing
- `e2e_frontend_regression` - Regression tests

**Build fails if any E2E test fails** (no `allow_failure` set).

## Using Fixtures

### Basic Usage

```typescript
import { test, expect } from '../fixtures'

test('example test with fixtures', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    // Page is already authenticated with test token
})
```

### Available Fixtures

#### `authenticatedPage`
Pre-authenticated page with Telegram WebApp mock.
```typescript
test('using authenticated page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    // Already has auth token + Telegram mock
})
```

#### `workoutPage`
Page with workout API mocking.
```typescript
test('with workout mocking', async ({ workoutPage, workoutState }) => {
    await mockWorkoutApi(workoutPage, workoutState)
    // All API calls are mocked
})
```

#### `workoutAuthPage`
Combined: authentication + workout API mocking.
```typescript
test('complete setup', async ({ workoutAuthPage }) => {
    await workoutAuthPage.goto('/')
    // Ready for full workout flow
})
```

## Using Telegram Mock

### Setup basic Telegram context
```typescript
import { setupTelegramWebApp } from './helpers/telegram-mock'

test('with Telegram', async ({ page }) => {
    await setupTelegramWebApp(page)
    // Window.Telegram.WebApp is now mocked
})
```

### Setup with custom user data
```typescript
import { setupTelegramWebApp } from './helpers/telegram-mock'

test('with custom user', async ({ page }) => {
    await setupTelegramWebApp(page, {
        user: {
            id: 12345,
            first_name: 'John',
            username: 'john_doe',
            is_premium: true,
        },
    })
})
```

### Check Telegram availability
```typescript
import { isTelegramAvailable, getTelegramUser } from './helpers/telegram-mock'

test('verify Telegram', async ({ page }) => {
    await setupTelegramWebApp(page)
    
    const available = await isTelegramAvailable(page)
    expect(available).toBe(true)
    
    const user = await getTelegramUser(page)
    expect(user?.id).toBeDefined()
})
```

## Using Workout API Mock

### Setup with state tracking
```typescript
import { buildWorkoutState, mockWorkoutApi } from './helpers/workout-api-mock'

test('mock workout API', async ({ page }) => {
    const state = buildWorkoutState()
    await mockWorkoutApi(page, state)
    
    // Make requests...
    
    // Assert on API calls
    expect(state.createTemplateRequests.length).toBeGreaterThan(0)
    expect(state.startRequests.length).toBe(1)
})
```

### Customize mock state
```typescript
import { buildWorkoutState } from './helpers/workout-api-mock'

test('with custom exercises', async ({ page }) => {
    const state = buildWorkoutState({
        exercises: [
            buildExercise(1, 'Custom Exercise 1'),
            buildExercise(2, 'Custom Exercise 2'),
        ],
    })
    
    await mockWorkoutApi(page, state)
})
```

## Test Tags

Tests are tagged for selective execution:

- `@golden-path` - Complete user journey
- `@regression` - Regression suite
- `@workout-flows` - Workout creation/editing
- `@smoke` - Quick smoke tests

Run specific tag:
```bash
npx playwright test --grep @golden-path
npx playwright test --grep @regression
```

## Common Patterns

### Wait for API call
```typescript
const state = buildWorkoutState()
await mockWorkoutApi(page, state)

// Wait for create template request
await expect.poll(() => state.createTemplateRequests.length).toBe(1)
```

### Mock nested dialog
```typescript
// First dialog
await page.locator('[role="dialog"]').last().click()

// Second dialog (nested)
const dialog = page.locator('[role="dialog"]').last()
await dialog.getByRole('button').click()
```

### Navigate and verify URL
```typescript
await page.getByRole('link', { name: 'Тренировки' }).click()
await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
```

### Handle optional elements
```typescript
const element = page.getByText('Optional text')
const count = await element.count()

if (count > 0) {
    await element.click()
}
```

## Debugging

### Take screenshot on failure
```typescript
await page.screenshot({ path: 'debug.png' })
```

### View test report
```bash
npx playwright show-report
```

### Enable trace (debug log)
```bash
TRACE=on npm run e2e
npx playwright show-trace trace.zip
```

### Print to console
```typescript
await page.evaluate(() => console.log('Debug message'))
```

## Troubleshooting

### Test is flaky

1. Check for race conditions with `.poll()` waits:
```typescript
await expect.poll(() => state.requests.length).toBe(1)
```

2. Verify element visibility before interaction:
```typescript
await expect(element).toBeVisible()
await element.click()
```

3. Use explicit waits:
```typescript
await page.waitForLoadState('networkidle')
```

### API mock not working

1. Verify route pattern:
```typescript
await page.route('**/api/v1/**', (route) => {
    console.log('Route matched:', route.request().url())
})
```

2. Check request method (GET vs POST):
```typescript
if (req.method() === 'POST' && path.endsWith('/start')) {
    // Handle start request
}
```

### Telegram mock not detected

1. Verify setup was called before navigation:
```typescript
await setupTelegramWebApp(page)
await page.goto('/')  // Navigate AFTER setup
```

2. Check if context is cleared:
```typescript
const iAvailable = await isTelegramAvailable(page)
console.log('Telegram available:', available)
```

## CI Configuration

Tests fail the build if:
- Any E2E test fails
- Timeout (30s per test, 60s for critical path)
- Browser crash or connection loss

Test configuration:
```yaml
e2e_frontend:
  stage: test
  image: node:20-bookworm
  script:
    - npm ci
    - npx playwright install --with-deps chromium
    - npm run e2e:ci
  # No allow_failure - build fails on test failure
```

## Best Practices

### ✅ Do

- Use `expect.poll()` for eventual consistency
- Separate test setup (fixtures) from test logic
- Tag tests appropriately (`@golden-path`, `@regression`)
- Mock external dependencies (Telegram, API)
- Clear localStorage/sessionStorage before sensitive tests
- Use data attributes for reliable selectors

### ❌ Don't

- Use hardcoded sleeps (`await page.waitForTimeout(1000)`)
- Mock at page.route() without proper CORS headers
- Mix test data generation with assertions
- Rely on timing-dependent selectors
- Run multiple parallel test suites in same workspace

## Performance

- Tests run with 2 workers in CI for speed
- Single worker for stability in local dev
- Each test: ~10-15s execution time
- Full suite: ~60-90s with retries

## Continuous Integration

GitLab CI runs tests on:
- Every push to `main` and branches
- Every merge request
- Scheduled daily at 2 AM

Results available in:
- Pipeline logs
- Artifact: `frontend/playwright-report/`
- Artifact: `frontend/test-results/`

View HTML report:
```bash
# Download from CI artifacts
# Open: frontend/playwright-report/index.html
```

## Contributing

When adding new E2E tests:

1. Use fixtures for common setup
2. Add test tags (`@regression`, `@golden-path`, etc.)
3. Document non-obvious mocking logic
4. Use semantic selectors (roles, labels, placeholders)
5. Handle optional UI elements gracefully
6. Add assertions for critical steps

## Auth Flow Unit Tests

In addition to E2E tests, the auth layer is covered by Jest unit tests at
`frontend/src/__tests__/auth/`:

| File | Coverage |
|------|----------|
| `authStore.test.ts` | Token CRUD, localStorage sync, `isAuthenticated` derivation |
| `routeGuard.test.tsx` | `ProtectedRoute` redirect, `RouteGuard` with `isPublic` |
| `TelegramAuthBootstrapGate.test.tsx` | All bootstrap states (loading, ready, error, no_telegram, expired), onboarding, session recovery via `auth:session-expired` |
| `authFlow.test.tsx` | Happy-path login via Telegram + redirect |

Run:
```bash
npm test -- --testPathPattern=auth
```

### Local Telegram Auth Testing

To test the auth flow locally without a real Telegram Mini App:

1. **Backend**: start with `TELEGRAM_BOT_TOKEN` matching a real BotFather token.
2. **Frontend**: the `TelegramAuthBootstrapGate` falls back to `/login` outside Telegram.
   For quick dev access, set a valid token in localStorage:
   ```js
   localStorage.setItem('auth_token', '<jwt-from-backend-test>')
   ```
3. **E2E**: use `setupTelegramWebApp(page)` from `helpers/telegram-mock.ts` which injects
   a full mock of `window.Telegram.WebApp` including `initData`. The backend `/auth/telegram`
   endpoint is mocked via `page.route()`.

### Session Expiry Flow

When an API request returns 401 and token refresh fails:
- **Inside Telegram**: the API client dispatches `auth:session-expired`, and
  `TelegramAuthBootstrapGate` re-authenticates using fresh `initData` — no redirect.
- **Outside Telegram**: hard redirect to `/login?from=<returnUrl>`.

Example template:
```typescript
test('clear description @regression', async ({ authenticatedPage }) => {
    // Setup
    const state = buildWorkoutState()
    await mockWorkoutApi(authenticatedPage, state)

    // Action
    await authenticatedPage.goto('/workouts')

    // Assert
    await expect(authenticatedPage.getByRole('heading', { name: 'История' })).toBeVisible()
})
```
