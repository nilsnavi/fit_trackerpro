import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
    testDir: './e2e',
    outputDir: './test-results',
    
    // Default timeout: 30s for most tests
    timeout: 30_000,
    expect: { timeout: 10_000 },

    // Retries: 2x in CI to handle flakiness, 0 locally for faster feedback
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    // Workers: 2 in CI (sequential workout tests), undefined locally (auto)
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
        command: 'npm run dev -- --host 0.0.0.0 --port 3000 --strictPort',
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
        {
            name: 'mobile-android',
            use: { ...devices['Pixel 7'] },
        },
        {
            name: 'mobile-ios',
            // Use Chromium in CI (no WebKit dependency), but keep iPhone-like viewport/touch.
            use: { ...devices['iPhone 14'], browserName: 'chromium' },
        },
    ],
})

