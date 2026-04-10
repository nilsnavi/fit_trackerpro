# E2E Testing Quick Reference

## 🚀 Quick Start

```bash
# First time
npm run e2e:install

# Run all tests
npm run e2e

# Run specific test
npx playwright test golden-path.spec.ts

# Interactive mode (best for debugging)
npm run e2e:ui

# Only golden path
npx playwright test --grep @golden-path

# Only regression
npx playwright test --grep @regression
```

## 📝 Common Import Patterns

```typescript
// ✓ Using standard test + expect
import { test, expect } from '@playwright/test'

// ✓ Using fixtures
import { test, expect } from '../fixtures'

// ✓ Using helpers
import { setupTelegramWebApp, getTelegramUser } from './helpers/telegram-mock'
import { buildWorkoutState, seedAuth, mockWorkoutApi } from './helpers/workout-api-mock'
```

## 🎯 Common Test Patterns

### Setup Telegram + Auth + API Mock
```typescript
test('my test', async ({ page }) => {
    const state = buildWorkoutState()
    
    // Setup Telegram
    await page.addInitScript(() => {
        window.Telegram = { WebApp: { ... } }
    })
    
    // Setup auth
    await seedAuth(page)
    
    // Setup API
    await mockWorkoutApi(page, state)
    
    // Now test
    await page.goto('/')
})
```

### Using Fixtures (Simpler)
```typescript
import { test, expect } from '../fixtures'

test('my test', async ({ authenticatedPage, workoutState }) => {
    // Page is already authenticated + has Telegram mock
    await authenticatedPage.goto('/')
})
```

### Wait for API Call
```typescript
const state = buildWorkoutState()
await mockWorkoutApi(page, state)

// Make request...

// Wait for API call to complete
await expect.poll(() => state.startRequests.length).toBeGreaterThan(0)
```

### Handle Dialog
```typescript
// Open dialog
await page.getByRole('button', { name: 'Add' }).click()

// Reference last (topmost) dialog
const dialog = page.locator('[role="dialog"]').last()

// Interact with dialog
await dialog.getByLabel('Name').fill('Test')
await dialog.getByRole('button', { name: 'Submit' }).click()

// Optional: wait for it to close
await expect(dialog).toBeHidden()
```

### Mark Test for Specific Run
```typescript
test('my test @golden-path @regression', async ({ page }) => {
    // Will run with: npx playwright test --grep @golden-path
})
```

## 🔍 Selectors Priority

| Priority | Method | Example |
|----------|--------|---------|
| 1️⃣ Best | `getByRole()` | `page.getByRole('button', { name: 'Click' })` |
| 2️⃣ Good | `getByLabel()` | `page.getByLabel('Email')` |
| 3️⃣ Good | `getByPlaceholder()` | `page.getByPlaceholder('Search')` |
| 4️⃣ OK | `data-testid` | `page.locator('[data-testid="btn"]')` |
| 5️⃣ Avoid | CSS selector | `page.locator('.button.primary')` |
| 🚫 Never | XPath | `page.locator('//button[@type="submit"]')` |

## 🧵 Assertion Patterns

```typescript
// Page navigation
await expect(page).toHaveURL(/\/workouts/)

// Element visibility
await expect(element).toBeVisible()
await expect(element).toBeHidden()

// Element state
await expect(element).toBeEnabled()
await expect(element).toBeChecked()
await expect(element).toHaveFocus()

// Content
await expect(element).toContainText('text')
await expect(page).toHaveTitle('title')

// Count
await expect(page.getByRole('button')).toHaveCount(5)

// Eventual consistency (important!)
await expect.poll(() => state.requests.length).toBe(1)
```

## ⚡ Performance Tips

```typescript
// ✓ Fast - no sleep
await page.getByRole('button').click()

// ✗ Slow - unnecessary sleep
await page.waitForTimeout(1000)
await page.getByRole('button').click()

// ✓ Fast - wait for actual condition
await expect(element).toBeVisible()
await element.click()

// ✓ Parallel independent operations
await Promise.all([
    page.goto('/'),
    page.locator('[role="dialog"]').isHidden(),
])
```

## 🐛 Debugging Commands

```bash
# Run with UI mode (step through)
npm run e2e:ui

# Run with headed browser (see it happening)
npm run e2e:headed

# Run one test in debug mode
npx playwright test golden-path.spec.ts --debug

# Show report
npx playwright show-report

# Show trace from last run
npx playwright show-trace trace.zip
```

## 🚨 Common Errors & Quick Fixes

| Error | Quick Fix |
|-------|-----------|
| "locator.click: Timeout" | Add `await expect(el).toBeVisible()` first |
| "Target page, context or browser has been closed" | Check if test closes page prematurely |
| "Telegram is not defined" | Call `addInitScript()` BEFORE `goto()` |
| "API mock not working" | Check method (POST vs GET) and path regex |
| "Element does not exist" | Use `getByRole()` instead of XPath |
| "Tests are flaky" | Replace sleeps with `.poll()` waits |

## 📊 Test Categories

| Tag | Use Case | Example |
|-----|----------|---------|
| `@golden-path` | Main user flow | Create → Add ex. → Complete |
| `@regression` | Ensure no breakage | All critical paths |
| `@workout-flows` | Workout CRUD ops | Create, edit, delete |
| `@mobile` | Mobile UI tests | Responsive layout |
| `@smoke` | Quick sanity check | Just navigation |

## 🔄 CI/CD Pipeline

```
Push to branch
    ↓
GitLab CI starts
    ↓
e2e_frontend (all tests with @regression)
e2e_frontend_workout_flows (@workout-flows only)
e2e_frontend_regression (@regression only)
    ↓
Any failure? → Build FAILS (no allow_failure)
All pass? → Build SUCCEEDS
    ↓
Artifacts: playwright-report/ + test-results/
```

## 📖 Documentation Links

- **Full Guide:** `frontend/e2e/README.md`
- **Implementation Details:** `docs/testing/golden-path-e2e-implementation.md`
- **Fixtures Reference:** `frontend/e2e/fixtures.ts`
- **Telegram Mock:** `frontend/e2e/helpers/telegram-mock.ts`

## ⏱️ Timeouts

| Context | Timeout |
|---------|---------|
| Test | 30s (default), 60s (golden-path) |
| Expect | 10s |
| Web Server | 120s |
| Playwright Install | 5min |

## 🎓 Learning Resources

1. **Start here:** `npm run e2e:ui` to see tests run interactively
2. **Read guide:** `frontend/e2e/README.md`
3. **Check examples:** `frontend/e2e/critical-path.workout.spec.ts`
4. **Try fixtures:** `frontend/e2e/fixtures.ts`

---

**Last Updated:** April 8, 2026  
**Playwright Version:** Latest (from package.json)

