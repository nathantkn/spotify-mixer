import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The browser calls /reccobeats/*, which is forwarded to the API, so CORS can't get in the way.
const proxy = {
  '/reccobeats': {
    target: 'https://api.reccobeats.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/reccobeats/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true
    },
    proxy,
  },
  preview: { proxy },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
