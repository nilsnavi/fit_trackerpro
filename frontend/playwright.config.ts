import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
    testDir: './e2e',
    outputDir: './test-results',
    timeout: 30_000,
    expect: { timeout: 10_000 },

    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,

    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ],

    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    webServer: {
        command: 'npm run dev -- --host 0.0.0.0 --port 3000',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 120_000,
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})

