import { expect, test } from '@playwright/test'
import { setupTelegramWebApp } from './helpers/telegram-mock'

test.describe('Coach Sprint 10.1 mocked frontend flow', () => {
    test('onboarding, create invite, resolve, accept and list client', async ({ page }) => {
        await setupTelegramWebApp(page)
        let accepted = false
        let currentAuthToken = 'coach-test'
        const clientListAuthHeaders: string[] = []
        await page.route('**/health/ready', async (route) => {
            await route.fulfill({ status: 200, json: { status: 'ready', dependencies: { database: { healthy: true } } } })
        })
        await page.route('**/api/v1/users/auth/me', async (route) => {
            const isClient = route.request().headers().authorization === 'Bearer client-test'
            await route.fulfill({ status: 200, json: { id: isClient ? 22 : 10, telegram_id: isClient ? 220 : 100, first_name: isClient ? 'Client Two' : 'Coach One', profile: { onboarding_completed: true }, settings: { theme: 'telegram', notifications: true, units: 'metric' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } })
        })
        await page.route('**/api/v1/users/auth/telegram', async (route) => {
            await route.fulfill({ status: 200, json: { success: true, message: 'ok', access_token: currentAuthToken, refresh_token: null, is_new_user: false, onboarding_required: false } })
        })
        await page.route('**/api/v1/coach/profile', async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({ status: 201, json: { id: 1, user_id: 10, display_name: 'Coach One', bio: null, specializations: [], avatar_url: null, timezone: 'UTC', public_slug: null, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } })
                return
            }
            await route.fulfill({ status: 200, json: { id: 1, user_id: 10, display_name: 'Coach One', bio: null, specializations: [], avatar_url: null, timezone: 'UTC', public_slug: null, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } })
        })
        await page.route('**/api/v1/coach/invitations', async (route) => {
            if (route.request().method() === 'POST') await route.fulfill({ status: 201, json: { id: 'invite-1', coach_id: 10, client_hint: null, status: 'PENDING', expires_at: new Date(Date.now() + 86400000).toISOString(), accepted_by_user_id: null, accepted_at: null, revoked_at: null, created_at: new Date().toISOString(), token: 'mock-secret-token-123456789' } })
            else await route.fulfill({ status: 200, json: [] })
        })
        await page.route('**/api/v1/coach/invitations/resolve**', async (route) => {
            await route.fulfill({ status: 200, json: { invitation_id: 'invite-1', coach: { id: 1, user_id: 10, display_name: 'Coach One', bio: null, specializations: [], avatar_url: null, timezone: 'UTC', public_slug: null, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, permissions: {}, expires_at: new Date(Date.now() + 86400000).toISOString() } })
        })
        await page.route('**/api/v1/coach/invitations/accept', async (route) => {
            expect(route.request().headers().authorization).toBe('Bearer client-test')
            accepted = true
            await route.fulfill({ status: 200, json: { client_id: 22, status: 'ACTIVE', permissions: {}, started_at: new Date().toISOString(), ended_at: null, archived_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } })
        })
        await page.route('**/api/v1/coach/clients', async (route) => {
            clientListAuthHeaders.push(route.request().headers().authorization ?? '')
            await route.fulfill({ status: 200, json: accepted ? [{ client_id: 22, status: 'ACTIVE', permissions: {}, started_at: new Date().toISOString(), ended_at: null, archived_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] : [] })
        })

        await page.goto('/coach/onboarding')
        await page.getByLabel('Имя тренера').fill('Coach One')
        await page.getByRole('button', { name: 'Создать профиль' }).click()
        await expect(page).toHaveURL(/\/coach$/)
        await page.getByRole('link', { name: /Пригласить клиента/ }).click()
        await page.getByRole('button', { name: 'Создать приглашение' }).click()
        await expect(page.getByText(/mock-secret-token/)).toBeVisible()
        const url = page.url()
        const invitationUrl = new URL('/coach/invitations/accept?token=mock-secret-token-123456789', url).toString()
        // Simulate a distinct client identity against mocked API contracts. This verifies frontend flow only;
        // authorization/owner-scope guarantees are covered by backend tests, not this browser mock.
        currentAuthToken = 'client-test'
        await page.reload()
        await page.goto(invitationUrl)
        await expect(page.getByText('Coach One')).toBeVisible()
        await page.getByRole('button', { name: 'Принять приглашение' }).click()
        await expect(page.getByText('Вы подключены к тренеру')).toBeVisible()
        await expect(new URL(page.url()).searchParams.has('token')).toBe(false)
        currentAuthToken = 'coach-test'
        await page.reload()
        await page.goto('/coach/clients')
        await expect(page.getByText('Клиент 22')).toBeVisible()
        expect(clientListAuthHeaders).toContain('Bearer coach-test')
    })
})
