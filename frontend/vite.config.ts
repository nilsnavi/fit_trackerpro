import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Same roots as `compilerOptions.paths` in tsconfig.json */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            /** New SW waits until user confirms via PwaUpdatePrompt — avoids mid-session chunk/SW mismatch. */
            registerType: 'prompt',
            injectRegister: 'auto',
            manifest: false,
            includeAssets: ['vite.svg', 'icons/**/*.png', 'manifest.webmanifest'],
            workbox: {
                /** Precache = app shell (HTML, hashed JS/CSS, icons). Runtime API stays uncached here. */
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
                globIgnores: ['**/config.js'],
                navigateFallback: 'index.html',
                /** Same-origin API must not fall back to SPA HTML. */
                navigateFallbackDenylist: [/^\/api\//],
                cleanupOutdatedCaches: true,
                cacheId: 'fittracker-shell',
                skipWaiting: false,
                clientsClaim: false,
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },
            devOptions: {
                enabled: false,
            },
        }),
    ],
    resolve: {
        alias: {
            '@': srcDir,
            '@app': path.join(srcDir, 'app'),
            '@features': path.join(srcDir, 'features'),
            '@shared': path.join(srcDir, 'shared'),
        },
    },
    server: {
        port: 3000,
        host: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'telegram-sdk': ['@telegram-apps/sdk-react', '@telegram-apps/sdk'],
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'charts': ['recharts'],
                },
            },
        },
    },
})
