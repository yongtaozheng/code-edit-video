import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  clearScreen: false,
  server: {
    host: host || 'localhost',
    port: 5173,
    strictPort: true,
    hmr: host ? { protocol: 'ws', host, port: 5174 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
