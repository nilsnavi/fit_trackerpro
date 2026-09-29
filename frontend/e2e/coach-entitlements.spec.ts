import { expect, test } from '@playwright/test'
import { setupTelegramWebApp } from './helpers/telegram-mock'

test.use({ serviceWorkers: 'block' })

test('coach sees current Trainer Pro trial and actual quota catalog', async ({ page }) => {
    await setupTelegramWebApp(page)
    const now = new Date().toISOString()
    await page.route('**/health/ready', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', dependencies: {} }) }))
    await page.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const path = url.pathname
        const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
        if (!path.startsWith('/api/v1/')) return route.fallback()
        if (path.endsWith('/health/ready')) return json({ status: 'ready', dependencies: {} })
        if (path.endsWith('/users/auth/telegram')) return json({ success: true, message: 'ok', access_token: 'coach-entitlement', refresh_token: null, is_new_user: false, onboarding_required: false })
        if (path.endsWith('/users/auth/me')) return json({ id: 10, telegram_id: 10, first_name: 'Coach', profile: { onboarding_completed: true }, settings: { theme: 'telegram', notifications: true, units: 'metric' }, created_at: now, updated_at: now })
        if (path.endsWith('/coach/profile')) return json({ id: 1, user_id: 10, display_name: 'Coach One', bio: null, specializations: [], avatar_url: null, timezone: 'UTC', public_slug: null, is_active: true, created_at: now, updated_at: now })
        if (path.endsWith('/coach/subscription')) return json({ plan: 'TRAINER_PRO', status: 'TRIAL', trial_started_at: now, trial_ends_at: now, trial_days_remaining: 9, grace_ends_at: null, grace_days_remaining: null, period_started_at: null, period_ends_at: null, activated_at: now, cancelled_at: null, cancel_at_period_end: false, active_clients: { used: 0, limit: null, remaining: null }, active_programs: { used: 0, limit: null, remaining: null }, features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: true }, upgrade_required: false })
        if (path.endsWith('/coach/plans')) return json([{ plan: 'FREE', display_name: 'Бесплатный', limits: { active_clients: 3, active_programs: 2 }, available_features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: false } }, { plan: 'TRAINER_PRO', display_name: 'Trainer Pro', limits: { active_clients: null, active_programs: null }, available_features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: true } }])
        if (path.endsWith('/coach/invitations') && request.method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'trial-invite', coach_id: 10, client_hint: null, status: 'PENDING', expires_at: now, created_at: now, token: 'trial-token' }) })
        if (path.endsWith('/workouts/templates')) return json({ items: [{ id: 41, user_id: 10, name: 'Trial template', version: 1, type: 'strength', is_archived: false }], total: 1, page: 1, page_size: 50 })
        if (path.endsWith('/coach/programs') && request.method() === 'POST') return json({ id: 81, coach_id: 10, name: 'Trial program', description: null, status: 'DRAFT', version: 1, days: [{ id: 82, day_number: 1, name: 'Day 1', workout_template_id: 41, workout_template_name: 'Trial template', template_version: 1, notes: null, position: 0 }], created_at: now, updated_at: now }, 201)
        if (path.endsWith('/coach/programs/81')) return json({ id: 81, coach_id: 10, name: 'Trial program', description: null, status: 'DRAFT', version: 1, days: [{ id: 82, day_number: 1, name: 'Day 1', workout_template_id: 41, workout_template_name: 'Trial template', template_version: 1, notes: null, position: 0 }], created_at: now, updated_at: now })
        return json([])
    })
    await page.addInitScript(() => localStorage.setItem('auth_token', 'coach-entitlement'))
    await page.goto('/coach/subscription', { waitUntil: 'commit' })
    await expect(page.getByText(/Пробный период Trainer Pro · 9 дн. осталось/)).toBeVisible()
    await expect(page.getByText(/Клиенты: 3/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Оплата скоро появится' })).toHaveCount(0)
    await page.screenshot({ path: test.info().outputPath('trainer-pro-subscription.png') })
})

test('free plan client limit opens code-specific paywall', async ({ page }) => {
    await setupTelegramWebApp(page)
    const now = new Date().toISOString()
    await page.route('**/health/ready', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', dependencies: {} }) }))
    await page.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const path = url.pathname
        const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
        if (!path.startsWith('/api/v1/')) return route.fallback()
        if (path.endsWith('/health/ready')) return json({ status: 'ready', dependencies: {} })
        if (path.endsWith('/users/auth/telegram')) return json({ success: true, message: 'ok', access_token: 'coach-free', refresh_token: null, is_new_user: false, onboarding_required: false })
        if (path.endsWith('/users/auth/me')) return json({ id: 10, telegram_id: 10, first_name: 'Coach', profile: { onboarding_completed: true }, settings: { theme: 'telegram', notifications: true, units: 'metric' }, created_at: now, updated_at: now })
        if (path.endsWith('/coach/profile')) return json({ id: 1, user_id: 10, display_name: 'Coach One', bio: null, specializations: [], avatar_url: null, timezone: 'UTC', public_slug: null, is_active: true, created_at: now, updated_at: now })
        if (path.endsWith('/coach/clients')) return json([])
        if (path.endsWith('/coach/invitations')) return json({ error: { code: 'CLIENT_LIMIT_REACHED', message: 'Limit', details: { limit: 3 } } }, 403)
        if (path.endsWith('/workouts/templates')) return json({ items: [{ id: 41, user_id: 10, name: 'Coach template', version: 1, type: 'strength', is_archived: false }], total: 1, page: 1, page_size: 50 })
        if (path.endsWith('/coach/programs')) return request.method() === 'POST'
            ? json({ error: { code: 'PROGRAM_LIMIT_REACHED', message: 'Limit', details: { limit: 2 } } }, 403)
            : json([])
        if (path.endsWith('/coach/subscription')) return json({ plan: 'FREE', status: 'ACTIVE', trial_started_at: null, trial_ends_at: null, trial_days_remaining: null, grace_ends_at: null, grace_days_remaining: null, period_started_at: null, period_ends_at: null, activated_at: null, cancelled_at: null, cancel_at_period_end: false, active_clients: { used: 3, limit: 3, remaining: 0 }, active_programs: { used: 2, limit: 2, remaining: 0 }, features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: false }, upgrade_required: true })
        return json([])
    })
    await page.addInitScript(() => localStorage.setItem('auth_token', 'coach-free'))
    await page.goto('/coach/invite', { waitUntil: 'commit' })
    await expect(page.getByRole('heading', { name: 'Пригласить клиента' })).toBeVisible()
    await page.getByRole('button', { name: 'Создать приглашение' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Лимит клиентов достигнут' })).toBeVisible()
    await expect(dialog.getByText('На бесплатном тарифе можно вести до 3 активных и приостановленных клиентов.')).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Узнать о Trainer Pro' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Позже' })).toBeVisible()
    const layout = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]')?.getBoundingClientRect()
        return {
            viewportWidth: document.documentElement.clientWidth,
            documentWidth: document.documentElement.scrollWidth,
            viewportHeight: document.documentElement.clientHeight,
            dialogLeft: dialog?.left ?? -1,
            dialogRight: dialog?.right ?? Number.MAX_SAFE_INTEGER,
            dialogTop: dialog?.top ?? -1,
            dialogBottom: dialog?.bottom ?? Number.MAX_SAFE_INTEGER,
        }
    })
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.dialogLeft).toBeGreaterThanOrEqual(0)
    expect(layout.dialogRight).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.dialogTop).toBeGreaterThanOrEqual(0)
    expect(layout.dialogBottom).toBeLessThanOrEqual(layout.viewportHeight)
    await page.screenshot({ path: test.info().outputPath('client-limit-paywall.png') })
    await dialog.getByRole('button', { name: 'Позже' }).click()
    await expect(dialog).toHaveCount(0)
})

test('free plan program limit opens code-specific paywall', async ({ page }) => {
    await setupTelegramWebApp(page)
    const now = new Date().toISOString()
    await page.route('**/health/ready', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', dependencies: {} }) }))
    await page.route('**/*', async (route) => {
        const request = route.request()
        const path = new URL(request.url()).pathname
        const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
        if (!path.startsWith('/api/v1/')) return route.fallback()
        if (path.endsWith('/users/auth/telegram')) return json({ success: true, message: 'ok', access_token: 'coach-free-program', refresh_token: null, is_new_user: false, onboarding_required: false })
        if (path.endsWith('/users/auth/me')) return json({ id: 10, telegram_id: 10, first_name: 'Coach', profile: { onboarding_completed: true }, settings: { theme: 'telegram', notifications: true, units: 'metric' }, created_at: now, updated_at: now })
        if (path.endsWith('/coach/profile')) return json({ id: 1, user_id: 10, display_name: 'Coach One', bio: null, specializations: [], avatar_url: null, timezone: 'UTC', public_slug: null, is_active: true, created_at: now, updated_at: now })
        if (path.endsWith('/workouts/templates')) return json({ items: [{ id: 41, user_id: 10, name: 'Coach template', version: 1, type: 'strength', is_archived: false }], total: 1, page: 1, page_size: 50 })
        if (path.endsWith('/coach/programs') && request.method() === 'POST') return json({ error: { code: 'PROGRAM_LIMIT_REACHED', message: 'Limit', details: { limit: 2 } } }, 403)
        return json([])
    })
    await page.addInitScript(() => localStorage.setItem('auth_token', 'coach-free-program'))
    await page.goto('/coach/programs/new', { waitUntil: 'commit' })
    await expect(page.getByLabel('Название').first()).toBeVisible({ timeout: 20_000 })
    await page.getByLabel('Название').first().fill('Third program')
    await page.getByLabel('WorkoutTemplate').selectOption('41')
    await page.getByRole('button', { name: 'Сохранить программу' }).click()
    await expect(page.getByRole('heading', { name: 'Лимит программ достигнут' })).toBeVisible()
})
