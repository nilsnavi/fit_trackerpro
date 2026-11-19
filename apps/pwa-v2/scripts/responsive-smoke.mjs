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
      await page.getByLabel('Электронная почта').fill('qa@example.test')
      await page.getByRole('button', { name: 'Получить код' }).click()
      await page.getByLabel('Код подтверждения').waitFor({ timeout: 10000 })
      assert.equal(requestedCode, true, 'email/request was not intercepted by browser test')
      await page.getByLabel('Код подтверждения').fill('123456')
      await page.getByRole('button', { name: 'Подтвердить и войти' }).click()
      await page.waitForURL('**/athlete')
      await page.getByRole('heading', { level: 1, name: /Становись/ }).waitFor()
      await page.screenshot({ path: resolve(outputDir, 'athlete-auth-' + width + '.png'), fullPage: true })
      await page.evaluate(() => { history.pushState(null, '', '/coach'); dispatchEvent(new PopStateEvent('popstate')) })
      await page.getByText('Доступ тренера пока недоступен').waitFor()
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
