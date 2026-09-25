import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // SSE stream endpoint — needs special handling to avoid ECONNRESET
      '/api/form-copilot/session': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Disable proxy buffering for streaming responses
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, _req, res) => {
            // Kill the socket timeout so SSE connections stay open
            (res as any).socket?.setTimeout(0);
          });
          proxy.on('error', (_err, _req, res) => {
            // Swallow SSE disconnect errors gracefully
            try { (res as any).end(); } catch {}
          });
        },
      },
      // All other API routes
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})

