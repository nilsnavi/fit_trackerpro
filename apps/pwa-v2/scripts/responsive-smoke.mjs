// Standalone browser smoke runner; reuses the existing frontend's Playwright
// installation strictly in CI, not as a V2 runtime dependency.
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
    const page = await browser.newPage({ viewport: { width, height: 860 }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    for (const [role, heading] of [['athlete', 'Становись'], ['coach', 'Тренируй']]) {
      await page.goto('http://127.0.0.1:4174/' + role, { waitUntil: 'networkidle' })
      assert.equal(await page.locator('h1').count(), 1, role + ' heading count')
      assert.match(await page.locator('h1').innerText(), new RegExp(heading), role + ' heading text')
      const geometry = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth
      }))
      assert.ok(geometry.scroll <= geometry.viewport + 1,
        role + ': horizontal overflow at ' + width + ' (' + JSON.stringify(geometry) + ')')
      if (width <= 760) {
        assert.equal(await page.locator('nav.ftp-mobile-nav').isVisible(), true, 'mobile navigation')
      } else {
        assert.equal(await page.locator('aside.ftp-sidebar').isVisible(), true, 'desktop sidebar')
      }
      await page.screenshot({ path: resolve(outputDir, role + '-' + width + '.png'), fullPage: true })
    }
    // UI mode navigation must work, while no server role elevation is claimed.
    await page.locator('nav[aria-label="Режим интерфейса"] a[href="/athlete"]').click()
    assert.match(await page.locator('h1').innerText(), /Становись/)
    assert.deepEqual(errors, [], 'runtime errors at ' + width)
    console.log('PASS responsive ' + width + 'px; athlete/coach/switch; no horizontal overflow')
    await page.close()
  }
} finally {
  await browser.close()
}
