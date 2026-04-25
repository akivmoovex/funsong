import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
  plugins: [
    tailwind({ config: path.join(__dirname, 'tailwind.config.js') }),
    autoprefixer()
  ]
}
