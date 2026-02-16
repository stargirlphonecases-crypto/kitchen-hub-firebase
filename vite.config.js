import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Šī konfigurācija atrisina "import.meta" brīdinājumu,
// iestatot modernu mērķa vidi (esnext) ES2015 vietā.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    outDir: 'dist'
  },
  server: {
    port: 5173
  }
})