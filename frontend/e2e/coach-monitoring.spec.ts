import { expect, test } from '@playwright/test'
import { setupTelegramWebApp } from './helpers/telegram-mock'

test('coach monitoring pages through clients, filters and opens paused detail', async ({ page }) => {
    await setupTelegramWebApp(page)
    const now = new Date().toISOString()
    const clients = [
        { client_id: 21, display_name: 'Client A', relationship_status: 'ACTIVE', active_assignment: null,
            last_completed_workout_at: now, days_since_last_workout: 1, active_workout: null,
            attention_status: 'OK', signals: [], signal_count: 0, sort_priority: 0 },
        { client_id: 22, display_name: 'Client B', relationship_status: 'PAUSED', active_assignment: null,
            last_completed_workout_at: null, days_since_last_workout: null, active_workout: null,
            attention_status: 'ATTENTION', signals: [{ code: 'NO_RECENT_WORKOUT', severity: 'ATTENTION',
                title: 'Нет недавних тренировок', description: 'Нет завершённых тренировок 7 дней',
                occurred_at: now, source_type: 'workout_log', source_id: null, metadata: {} }], signal_count: 1, sort_priority: 200 },
    ]
    for (let id = 100; id < 149; id += 1) clients.push({
        client_id: id, display_name: `Client ${id}`, relationship_status: 'ACTIVE', active_assignment: null,
        last_completed_workout_at: now, days_since_last_workout: 1, active_workout: null,
        attention_status: 'OK', signals: [], signal_count: 0, sort_priority: 0,
    })
    await page.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const path = url.pathname
        const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
        if (path.endsWith('/health/ready')) return json({ status: 'ready', dependencies: {} })
        if (!path.startsWith('/api/v1/')) return route.fallback()
        if (path.endsWith('/users/auth/telegram')) return json({ success: true, message: 'ok', access_token: 'monitor-coach', refresh_token: null, is_new_user: false, onboarding_required: false })
        if (path.endsWith('/users/auth/me')) return json({ id: 10, telegram_id: 100, first_name: 'Coach', profile: { onboarding_completed: true }, settings: { theme: 'telegram', notifications: true, units: 'metric' }, created_at: now, updated_at: now })
        if (path.endsWith('/coach/profile')) return json({ id: 1, user_id: 10, display_name: 'Coach One', bio: null, specializations: [], avatar_url: null, timezone: 'UTC', public_slug: null, is_active: true, created_at: now, updated_at: now })
        if (path.endsWith('/coach/clients')) return json([])
        if (path.endsWith('/coach/monitoring/22')) return json(clients[1])
        if (path.endsWith('/coach/monitoring')) {
            const status = url.searchParams.get('status')
            const filtered = status === 'attention' ? [clients[1]] : status === 'ok' ? [clients[0]] : clients
            const offset = Number(url.searchParams.get('offset') ?? 0)
            const limit = Number(url.searchParams.get('limit') ?? 50)
            return json({ items: filtered.slice(offset, offset + limit), total: filtered.length, attention_count: 1, ok_count: 50 })
        }
        return json([])
    })
    await page.addInitScript(() => localStorage.setItem('auth_token', 'monitor-coach'))
    await page.goto('/coach/monitoring')
    await expect(page.getByRole('heading', { name: 'Мониторинг клиентов' })).toBeVisible()
    await expect(page.getByText('Client B')).toBeVisible()
    await expect(page.getByText('Client A')).toBeVisible()
    await page.getByRole('button', { name: 'Показать ещё' }).click()
    await expect(page.getByText('Client 148')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Показать ещё' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Требуют внимания' }).click()
    await expect(page.getByText('Client B')).toBeVisible()
    await expect(page.getByText('Client A')).toHaveCount(0)
    await page.getByRole('link', { name: 'Открыть клиента' }).click()
    await expect(page).toHaveURL(/\/coach\/monitoring\/22$/)
    await expect(page.getByText('Нет завершённых тренировок 7 дней')).toBeVisible()
    await expect(page.getByText('Статус связи: PAUSED')).toBeVisible()
})
