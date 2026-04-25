import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))
const client = path.join(root, 'client')

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: { '@': path.join(client, 'src') }
  },
  test: {
    include: ['server/**/*.test.mjs', 'client/src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [
      ['server/**', 'node'],
      ['client/**', 'jsdom']
    ]
  }
})
