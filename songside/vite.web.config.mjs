// Browser-only dev server for the renderer (no Electron). Used to develop and
// check the v2 fullscreen visuals with the dev mock player:
//   npm run dev:web  →  http://localhost:5174/?mock#/fullscreen
// The real app still builds with electron.vite.config.mjs.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve('src/renderer'),
  resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
  plugins: [react()],
  server: { port: 5174, strictPort: true }
})
