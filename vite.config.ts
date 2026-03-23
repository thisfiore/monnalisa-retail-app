/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3100,
    proxy: {
      // Proxy real API calls to the backend, avoiding CORS.
      // Use /api prefix to avoid colliding with frontend routes like /customers/:email
      '/api': {
        target: 'https://monnalisa-mid-dev-api-gw-1lcvs0vu.ew.gateway.dev',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 15000,
  },
})
