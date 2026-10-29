import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/** Runs the /api functions (server/) inside the dev server, with keys from .env.local. */
function devApi() {
  return {
    name: 'mix-planner-dev-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const { handleNodeRequest } = await server.ssrLoadModule('/server/devAdapter.ts')
          await handleNodeRequest(req, res, env)
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApi()],
  server: {
    watch: {
      usePolling: true
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
