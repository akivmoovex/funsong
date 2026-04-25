import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src', '**', '*.{js,ts,jsx,tsx}')
  ],
  theme: {
    extend: {
      minHeight: {
        touch: '3.25rem'
      },
      borderRadius: {
        card: '1.5rem',
        'card-lg': '1.75rem'
      },
      boxShadow: {
        'fs-card': '0 12px 40px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.12)'
      }
    }
  },
  plugins: []
}
