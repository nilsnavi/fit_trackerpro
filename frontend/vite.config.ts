import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

/** Same roots as `compilerOptions.paths` in tsconfig.json */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')

function bundleStatsPlugin(): Plugin {
    return {
        name: 'fittracker-bundle-stats',
        apply: 'build',
        generateBundle(_outputOptions, bundle) {
            const chunks = []
            const assets = []

            for (const [fileName, item] of Object.entries(bundle)) {
                if (item.type === 'chunk') {
                    const nodeModulesBytes = Object.entries(item.modules).reduce((acc, [id, m]) => {
                        if (id.includes('/node_modules/')) return acc + (m.renderedLength ?? 0)
                        return acc
                    }, 0)
                    const totalModuleBytes = Object.values(item.modules).reduce(
                        (acc, m) => acc + (m.renderedLength ?? 0),
                        0,
                    )

                    chunks.push({
                        fileName,
                        name: item.name,
                        isEntry: item.isEntry,
                        isDynamicEntry: item.isDynamicEntry,
                        facadeModuleId: item.facadeModuleId,
                        imports: item.imports,
                        dynamicImports: item.dynamicImports,
                        moduleCount: Object.keys(item.modules).length,
                        nodeModulesBytes,
                        totalModuleBytes,
                        nodeModulesRatio:
                            totalModuleBytes > 0 ? nodeModulesBytes / totalModuleBytes : 0,
                    })
                } else if (item.type === 'asset') {
                    assets.push({
                        fileName,
                        name: item.name ?? null,
                    })
                }
            }

            const stats = {
                formatVersion: 1,
                generatedAt: new Date().toISOString(),
                chunks: chunks.sort((a, b) => a.fileName.localeCompare(b.fileName)),
                assets: assets.sort((a, b) => a.fileName.localeCompare(b.fileName)),
            }

            this.emitFile({
                type: 'asset',
                fileName: 'bundle-stats.json',
                source: JSON.stringify(stats, null, 2) + '\n',
            })
        },
    }
}

export default defineConfig({
    plugins: [
        react(),
        ...(process.env.BUNDLE_STATS ? [bundleStatsPlugin()] : []),
        VitePWA({
            /** Prompt-based updates avoid mixed old/new chunks within one active session. */
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
        port: 5173,
        host: true,
        allowedHosts: true,
        /**
         * Docker on Windows + large repo can exhaust watcher memory.
         * Ignore heavy non-runtime folders to prevent ENOMEM crashes.
         */
        watch: {
            ignored: [
                /(^|\/)e2e(\/|$)/,
                /(^|\/)\.husky(\/|$)/,
                /(^|\/)node_modules(\/|$)/,
                /(^|\/)dist(\/|$)/,
            ],
        },
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
