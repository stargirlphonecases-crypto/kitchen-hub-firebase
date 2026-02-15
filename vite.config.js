import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Svarīgi: Šī konfigurācija nodrošina, ka Netlify saprot import.meta.env
export default defineConfig({
  plugins: [react()],
  // Šī daļa ļauj lokāli (uz datora) simulēt to pašu, ko dara Netlify
  server: {
    proxy: {
      '/api/notion': {
        target: 'https://api.notion.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/notion/, '')
      }
    }
  },
  build: {
    // Iestatām 'esnext', lai atbalstītu modernās funkcijas un import.meta
    target: 'esnext' 
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  }
})