import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { config as loadDotenv } from 'dotenv'

// Inline the env vars the main process needs at BUILD time. The packaged app
// excludes .env (see electron-builder.yml's files list), yet the main process
// reads these via process.env at runtime — so without inlining, SPOTIFY_CLIENT_ID
// and the LLM keys are undefined in production and Spotify token refresh / LLM
// calls fail silently (the overlay then never sees a playing track). Inlining
// here keeps a single source of truth (.env) working for both dev and packaged
// builds without shipping the raw .env file.
//
// Note: this embeds the values (including GEMINI_KEY) into the app bundle. Fine
// for a personal, locally-installed build that is never published.
const env = loadDotenv().parsed || {}
const MAIN_ENV_KEYS = [
  'SPOTIFY_CLIENT_ID',
  'LLM_PROVIDER',
  'GEMINI_KEY',
  'GEMINI_MODEL',
  'OLLAMA_MODEL',
  'OLLAMA_URL'
]
const mainDefine = Object.fromEntries(
  MAIN_ENV_KEYS.map((k) => [`process.env.${k}`, JSON.stringify(env[k] ?? process.env[k] ?? '')])
)

export default defineConfig({
  // Externalize node deps so native modules (sharp, used by colorthief) load
  // from node_modules at runtime instead of being bundled — .node binaries
  // can't be bundled by Rollup.
  main: {
    define: mainDefine,
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
