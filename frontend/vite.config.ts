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
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            includeAssets: ['vite.svg'],
            manifest: {
                name: 'FitTracker Pro',
                short_name: 'FitTracker',
                description: 'FitTracker Pro - Track your fitness journey',
                theme_color: '#2481cc',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                lang: 'en',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: 'vite.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'any',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                globIgnores: ['**/config.js'],
                navigateFallback: 'index.html',
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
