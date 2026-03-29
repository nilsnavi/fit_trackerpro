import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Same roots as `compilerOptions.paths` in tsconfig.json */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')

export default defineConfig({
    plugins: [
        react(),
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
