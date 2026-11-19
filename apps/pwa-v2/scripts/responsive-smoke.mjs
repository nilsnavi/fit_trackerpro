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
    assert.deepEqual(errors, [], 'runtime errors at ' + width)
    console.log('PASS auth guard + responsive login ' + width + 'px')
    await page.close()
  }
} finally {
  await browser.close()
}
