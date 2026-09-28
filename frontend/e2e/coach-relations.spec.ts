import { expect, test } from '@playwright/test'
import { setupTelegramWebApp } from './helpers/telegram-mock'

test.describe('Coach Sprint 10.1 mocked frontend flow', () => {
    test('onboarding, create invite, resolve, accept and list client', async ({ page }) => {
        await setupTelegramWebApp(page)
        let accepted = false
        let currentAuthToken = 'coach-test'
        const clientListAuthHeaders: string[] = []
        const now = () => new Date().toISOString()
        const coachProfile = {
            id: 1,
            user_id: 10,
            display_name: 'Coach One',
            bio: null,
            specializations: [],
            avatar_url: null,
            timezone: 'UTC',
            public_slug: null,
            is_active: true,
            created_at: now(),
            updated_at: now(),
        }

        // Match API calls by parsed path: the production build uses an absolute API URL,
        // while the narrow globs below did not intercept it in the compose E2E run.
        await page.route('**/*', async (route) => {
            const request = route.request()
            const url = new URL(request.url())
            const method = request.method()
            const json = (status: number, body: unknown) =>
                route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

            if (url.pathname.endsWith('/health/ready')) {
                return json(200, { status: 'ready', dependencies: { database: { healthy: true } } })
            }
            if (!url.pathname.startsWith('/api/v1/')) return route.fallback()

            if (url.pathname.endsWith('/users/auth/telegram')) {
                return json(200, { success: true, message: 'ok', access_token: currentAuthToken, refresh_token: null, is_new_user: false, onboarding_required: false })
            }
            if (url.pathname.endsWith('/users/auth/me')) {
                const isClient = request.headers()['authorization'] === 'Bearer client-test'
                return json(200, { id: isClient ? 22 : 10, telegram_id: isClient ? 220 : 100, first_name: isClient ? 'Client Two' : 'Coach One', profile: { onboarding_completed: true }, settings: { theme: 'telegram', notifications: true, units: 'metric' }, created_at: now(), updated_at: now() })
            }
            if (url.pathname.endsWith('/coach/profile')) {
                return json(method === 'POST' ? 201 : 200, coachProfile)
            }
            if (url.pathname.endsWith('/coach/invitations/resolve')) {
                expect(method).toBe('POST')
                expect(request.postDataJSON()).toEqual({ token: 'mock-secret-token-123456789' })
                return json(200, { invitation_id: 'invite-1', coach: coachProfile, permissions: {}, expires_at: new Date(Date.now() + 86400000).toISOString() })
            }
            if (url.pathname.endsWith('/coach/invitations/accept')) {
                expect(request.headers()['authorization']).toBe('Bearer client-test')
                accepted = true
                return json(200, { client_id: 22, status: 'ACTIVE', permissions: {}, started_at: now(), ended_at: null, archived_at: null, created_at: now(), updated_at: now() })
            }
            if (url.pathname.endsWith('/coach/invitations')) {
                if (method === 'POST') {
                    return json(201, { id: 'invite-1', coach_id: 10, client_hint: null, status: 'PENDING', expires_at: new Date(Date.now() + 86400000).toISOString(), accepted_by_user_id: null, accepted_at: null, revoked_at: null, created_at: now(), token: 'mock-secret-token-123456789' })
                }
                return json(200, [])
            }
            if (url.pathname.endsWith('/coach/clients')) {
                clientListAuthHeaders.push(request.headers()['authorization'] ?? '')
                return json(200, accepted ? [{ client_id: 22, status: 'ACTIVE', permissions: {}, started_at: now(), ended_at: null, archived_at: null, created_at: now(), updated_at: now() }] : [])
            }
            return json(404, { detail: `Unhandled e2e API route: ${method} ${url.pathname}` })
        })

        await page.addInitScript(() => localStorage.setItem('auth_token', 'coach-test'))
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
        await page.evaluate(() => localStorage.setItem('auth_token', 'client-test'))
        await page.reload()
        await page.goto(invitationUrl)
        await expect(page.getByText('Coach One')).toBeVisible()
        await page.getByRole('button', { name: 'Принять приглашение' }).click()
        await expect(page.getByText('Вы подключены к тренеру')).toBeVisible()
        await expect(new URL(page.url()).searchParams.has('token')).toBe(false)
        currentAuthToken = 'coach-test'
        await page.evaluate(() => localStorage.setItem('auth_token', 'coach-test'))
        await page.reload()
        await page.goto('/coach/clients')
        await expect(page.getByText('Клиент 22')).toBeVisible()
        expect(clientListAuthHeaders).toContain('Bearer coach-test')
    })
})
