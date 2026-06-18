import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8001',
      '/users': 'http://localhost:8001',
      '/radio/status': 'http://localhost:8001',
      '/radio/audio': 'http://localhost:8001',
      '/radio/live': 'http://localhost:8001',
      '/radio/playlist': 'http://localhost:8001',
      '/radio/segment': 'http://localhost:8001',
      '/chat': 'http://localhost:8001',
      '/messages': 'http://localhost:8001',
      '/admin/drafts': 'http://localhost:8001',
      '/admin/announcements': 'http://localhost:8001',
      '/admin/points': 'http://localhost:8001',
      '/admin/users': 'http://localhost:8001',
      '/cities': 'http://localhost:8001',
      '/health': 'http://localhost:8001',
    },
  },
})
