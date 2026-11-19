import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const currentDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)))
const fromFrontend = createRequire(new URL('../../../frontend/package.json', import.meta.url))
const { chromium } = fromFrontend('@playwright/test')
const browser = await chromium.launch({ headless: true })
const outputDir = resolve(currentDirectory, '../visual-results')
await mkdir(outputDir, { recursive: true })

try {
  for (const width of [375, 390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 860 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    for (const role of ['athlete', 'coach']) {
      await page.goto('http://127.0.0.1:4174/' + role, { waitUntil: 'networkidle' })
      await page.waitForURL('**/login?from=*')
      await page.getByRole('heading', { name: 'С возвращением.' }).waitFor()
      const geometry = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }))
      assert.ok(geometry.scroll <= geometry.viewport + 1,
        role + ': horizontal overflow at ' + width + ' (' + JSON.stringify(geometry) + ')')
      assert.equal(await page.getByLabel('Электронная почта').isVisible(), true)
      assert.equal(await page.locator('aside.ftp-sidebar').count(), 0, 'private navigation must stay hidden')
      await page.screenshot({ path: resolve(outputDir, role + '-login-' + width + '.png'), fullPage: true })
    }
    if (width === 390 || width === 1280) {
      const access = 'a'.repeat(24)
      const refresh = 'r'.repeat(48)
      let requestedCode = false
      const seenRequests = []
      page.on('request', request => { if (request.url().includes('/api/v1/users/auth')) seenRequests.push(request.method() + ' ' + request.url()) })
      await page.route('**/api/v1/users/auth/**', async route => {
        const url = new URL(route.request().url())
        let response
        if (url.pathname.endsWith('/email/request')) { requestedCode = true; response = { challenge_id: 'c'.repeat(32) } }
        else if (url.pathname.endsWith('/email/verify')) response = {
          access_token: access, refresh_token: refresh, token_type: 'bearer', expires_in: 900,
        }
        else if (url.pathname.endsWith('/me')) response = {
          id: 9, telegram_id: null, email: 'qa@example.test', username: null,
          first_name: 'QA', is_admin: false, profile: {}, settings: {},
          created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        }
        else if (url.pathname.endsWith('/logout')) response = { message: 'Successfully logged out' }
        else return route.fulfill({ status: 404, body: '{}' })
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) })
      })
      let athleteStatsCalls = 0
      let athleteHistoryCalls = 0
      await page.route('**/api/v1/users/me/stats', async route => {
        athleteStatsCalls++
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ active_days: 3, total_workouts: 7, current_streak: 2,
            longest_streak: 4, total_duration: 310 }) })
      })
      await page.route('**/api/v1/workouts/history?*', async route => {
        athleteHistoryCalls++
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ items: [{
            id: 77, date: '2026-11-18', status: 'COMPLETED', duration: 42,
            tags: ['strength'], glucose_before: 9.8, private_health_field: 'SECRET-NEVER-RENDER',
          }], total: 1, page: 1, page_size: 5 }) })
      })
      await page.getByLabel('Электронная почта').fill('qa@example.test')
      await page.getByRole('button', { name: 'Получить код' }).click()
      try {
        await page.getByLabel('Код подтверждения').waitFor({ timeout: 7000 })
      } catch (error) {
        console.error('OTP DEBUG', JSON.stringify({ requestedCode, seenRequests, alerts: await page.getByRole('alert').allTextContents(), page: (await page.locator('main').innerText()).slice(0, 700), location: page.url(), browserErrors: errors }))
        throw error
      }
      assert.equal(requestedCode, true, 'email/request was not intercepted by browser test')
      await page.getByLabel('Код подтверждения').fill('123456')
      await page.getByRole('button', { name: 'Подтвердить и войти' }).click()
      await page.waitForURL('**/athlete')
      await page.getByRole('heading', { level: 1, name: /Становись/ }).waitFor()
      await page.getByText('Активность за 30 дней').waitFor()
      await page.getByText('Тренировок', { exact: true }).first().waitFor()
      await page.getByText('2026-11-18').waitFor()
      assert.equal(await page.getByText('SECRET-NEVER-RENDER').count(), 0, 'health details must not reach Athlete overview')
      assert.ok(athleteStatsCalls > 0, 'Athlete stats must be requested from server')
      assert.ok(athleteHistoryCalls > 0, 'Athlete workout history must be requested from server')
      console.log('PASS Athlete live-data contracts and no health leakage at ' + width + 'px')

      await page.screenshot({ path: resolve(outputDir, 'athlete-auth-' + width + '.png'), fullPage: true })
      let clientCalls = 0
      await page.route('**/api/v1/coach/**', async route => {
        const pathname = new URL(route.request().url()).pathname
        if (width === 1280) return route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })
        let result
        if (pathname.endsWith('/profile')) result = {
          id: 10, user_id: 9, is_active: true, display_name: 'QA Coach',
        }
        else if (pathname.endsWith('/subscription')) result = {
          plan: 'TRAINER_PRO', status: 'TRIAL', upgrade_required: false,
          trial_days_remaining: 6, grace_days_remaining: null,
          active_clients: { used: 3, limit: 20, remaining: 17 },
          active_programs: { used: 4, limit: 50, remaining: 46 },
          features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: false },
        }
        else if (pathname.endsWith('/clients')) {
          clientCalls++
          result = [
            { client_id: 101, status: 'ACTIVE', permissions: {}, secret_health: 'must never render' },
            { client_id: 102, status: 'REVOKED', permissions: {} },
            { client_id: 103, status: 'PAUSED', permissions: {} },
          ]
        }
        else return route.fulfill({ status: 404, body: '{}' })
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
      })
      await page.evaluate(() => { history.pushState(null, '', '/coach'); dispatchEvent(new PopStateEvent('popstate')) })
      if (width === 1280) {
        await page.getByText('Доступ тренера не подтверждён').waitFor()
        assert.equal(clientCalls, 0, 'denied user must not fetch clients')
        console.log('PASS Coach server 403 denied before clients query at 1280px')
      } else {
        await page.getByRole('heading', { level: 1, name: /Тренируй/ }).waitFor()
        await page.getByText('QA Coach').waitFor()
        await page.getByText('Дней пробного периода: 6').waitFor()
        await page.getByText('Лимит программ').waitFor()
        await page.getByText('Клиент №101').waitFor()
        assert.equal(await page.getByText('Клиент №102').count(), 0, 'revoked client must not appear')
        assert.equal(await page.getByText('must never render').count(), 0, 'private data must not appear')
        console.log('PASS Coach dashboard server-derived profile subscription quotas and clients ' + width + 'px')

        await page.getByRole('link', { name: 'Клиенты' }).first().click()
        await page.getByRole('heading', { name: 'Мои клиенты' }).waitFor()
        await page.getByText('Клиент №101 · активная связь').waitFor()
        assert.equal(await page.getByText('Клиент №102 · активная связь').count(), 0)
        assert.equal(await page.getByText('Клиент №103 · активная связь').count(), 0)
        assert.equal(await page.getByText('must never render').count(), 0)
        assert.equal(clientCalls, 1, 'Coach client metadata fetched only after role verification')
        console.log('PASS Coach role + active-only client relationships at 390px')
      }
      await page.evaluate(() => { history.pushState(null, '', '/athlete'); dispatchEvent(new PopStateEvent('popstate')) })
      await page.getByRole('button', { name: 'Выйти' }).click()
      await page.waitForURL('**/login?from=*')
      console.log('PASS mocked email OTP /me, Coach fail-closed and logout at ' + width + 'px')
    }
    assert.deepEqual(errors, [], 'runtime errors at ' + width)
    console.log('PASS auth guard + responsive login ' + width + 'px')
    await page.close()
  }
} finally {
  await browser.close()
}
