import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envTestPath = resolve(__dirname, '.env.test')
if (existsSync(envTestPath)) {
    for (const rawLine of readFileSync(envTestPath, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq === -1) continue
        const key = line.slice(0, eq).trim()
        let val = line.slice(eq + 1).trim()
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1)
        }
        if (process.env[key] === undefined) process.env[key] = val
    }
}

/**
 * DEV edge (Caddy) по умолчанию из гайда репозитория; в CI обычно переопределяют E2E_BASE_URL на Vite (например http://127.0.0.1:3000).
 * @see README.md — Edge proxy : http://localhost:19000
 */
const defaultBaseURL = 'http://127.0.0.1:19000'
const baseURL = process.env.E2E_BASE_URL ?? defaultBaseURL

function devServerPortFromBaseURL(url: string): string {
    try {
        const u = new URL(url)
        if (u.port) return u.port
        return u.protocol === 'https:' ? '443' : '80'
    } catch {
        return '3000'
    }
}

const devPort = devServerPortFromBaseURL(baseURL)

export default defineConfig({
    outputDir: './test-results',

    timeout: 30_000,
    expect: { timeout: 10_000 },

    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,

    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ...(process.env.CI ? [['github']] : []),
    ],

    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    webServer: {
        command: `npm run dev -- --host 0.0.0.0 --port ${devPort} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 120_000,
        env: {
            ...process.env,
            VITE_API_URL: process.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1',
        },
    },

    projects: [
        {
            name: 'chromium',
            testDir: './e2e',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile-android',
            testDir: './e2e',
            use: { ...devices['Pixel 7'] },
        },
        {
            name: 'mobile-ios',
            testDir: './e2e',
            use: { ...devices['iPhone 14'], browserName: 'chromium' },
        },
        {
            name: 'chromium-mvp-e2e',
            testDir: './tests/e2e',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})
