import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/statfin': {
        target: 'https://pxdata.stat.fi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/statfin/, '/PXWeb/api/v1/fi/StatFin'),
      },
    },
  },
})
