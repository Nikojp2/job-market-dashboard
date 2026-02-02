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
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Ensure JSON responses are not treated as downloads
            if (proxyRes.headers['content-type']?.includes('json')) {
              delete proxyRes.headers['content-disposition'];
            }
          });
        },
      },
    },
  },
})
