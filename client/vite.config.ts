import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pwaManifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'public/manifest.json'), 'utf-8')
) as Record<string, unknown>

export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: ['favicon.svg', 'pwa-192.svg', 'pwa-512.svg'],
      injectRegister: 'auto',
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,svg,woff2,woff,ttf,png,webmanifest,json}'
        ],
        globIgnores: ['**/*-stats.json', 'sw.js.map'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/health/, /^\/socket.io\//],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => {
              if (request.mode !== 'navigate') return false
              if (url.pathname.startsWith('/api/')) return false
              if (url.pathname === '/health' || url.pathname.startsWith('/health/'))
                return false
              return true
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fs-pages',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /\/(health|health\/db)(?:$|\?)/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/socket.io/'),
            handler: 'NetworkOnly'
          }
        ],
        // Precache the built app shell; avoid storing API or live state here.
        cleanupOutdatedCaches: true
      },
      manifest: pwaManifest,
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: { '@': path.join(__dirname, 'src') }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000' },
      '/health': { target: 'http://127.0.0.1:3000' },
      '/health/db': { target: 'http://127.0.0.1:3000' },
      '/socket.io': { target: 'http://127.0.0.1:3000', ws: true, changeOrigin: true }
    }
  }
})
