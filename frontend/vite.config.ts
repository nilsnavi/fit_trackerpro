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
                /**
                 * Precache: immutable hashed bundles under /assets, shell HTML, PWA icons, fonts.
                 * Runtime rules below apply when a request is not precached (lazy edges, cache miss).
                 */
                globPatterns: [
                    '**/*.{js,css,html,ico,png,svg,webp,avif,woff,woff2,ttf,otf,webmanifest}',
                ],
                globIgnores: ['**/config.js'],
                navigateFallback: 'index.html',
                /** Same-origin API must not fall back to SPA HTML. */
                navigateFallbackDenylist: [/^\/api\//],
                cleanupOutdatedCaches: true,
                cacheId: 'fittracker-shell',
                skipWaiting: false,
                clientsClaim: false,
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                /**
                 * Static asset strategies (same-origin, production URLs).
                 * Order matters: first match wins. Fonts before /assets/* so *.woff2 is not treated as JS.
                 */
                runtimeCaching: [
                    {
                        urlPattern: /^https?:\/\/[^/]+\/.*\.(?:woff2?|ttf|otf)(?:\?.*)?$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'pwa-fonts',
                            expiration: {
                                maxEntries: 32,
                                maxAgeSeconds: 60 * 60 * 24 * 365,
                            },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        urlPattern: /^https?:\/\/[^/]+\/assets\/.*\.(?:m?js)(?:\?.*)?$/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'pwa-js',
                            expiration: {
                                maxEntries: 64,
                                maxAgeSeconds: 60 * 60 * 24 * 7,
                            },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        urlPattern: /^https?:\/\/[^/]+\/assets\/.*\.css(?:\?.*)?$/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'pwa-css',
                            expiration: {
                                maxEntries: 32,
                                maxAgeSeconds: 60 * 60 * 24 * 7,
                            },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        urlPattern:
                            /^https?:\/\/[^/]+\/(?:icons\/.*|vite\.svg|assets\/.*\.(?:png|svg|ico|webp|avif))(?:\?.*)?$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'pwa-icons-images',
                            expiration: {
                                maxEntries: 128,
                                maxAgeSeconds: 60 * 60 * 24 * 30,
                            },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
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
