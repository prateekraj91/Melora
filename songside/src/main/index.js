import 'dotenv/config'
import { app, shell, BrowserWindow, ipcMain, screen, globalShortcut, components } from 'electron'
import { loginSpotify, getCurrentlyPlaying, seekTo, isConnected } from './spotify.js'
import { getAlbumColor } from './color.js'
import { getLyricMeaning, getMood, getWeeklyDigest, ensureOllama } from './llm.js'
import { startLyricsSync, applySeek, onPlaybackState } from './lyrics.js'
import { createTray } from './tray.js'
import store, { clearSpotifyTokens } from './store.js'
import * as playerStore from './state/playerStore.js'
import { createFullscreenController } from './windows/fullscreen.js'
import { appWebPreferences } from './windows/webPreferences.js'
import { INVOKE, SEND } from '../shared/ipc.js'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Overlay dimensions. Taller than before to fit the karaoke stack: 1 previous
// line, the active line, and several upcoming lines.
const WIN_W = 360
const WIN_H = 300
const EDGE_MARGIN = 12

// Module-level handle so the menu-bar Tray is never garbage-collected (a
// collected Tray vanishes from the menu bar). Retained, not read.
// eslint-disable-next-line no-unused-vars
let tray = null

function createWindow() {
  // Park the pill in the top-right of the work area — beside the menu-bar /
  // notch / Control Center corner. workArea already excludes the menu bar.
  const { workArea } = screen.getPrimaryDisplay()

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: workArea.x + workArea.width - WIN_W - EDGE_MARGIN,
    y: workArea.y + EDGE_MARGIN,
    show: false,
    frame: false,
    alwaysOnTop: true,
    // No card: a fully transparent, shadowless window so the lyrics and album
    // art appear to float directly on the desktop. The only "background" is a
    // soft album-tinted glow drawn in CSS that fades to transparent at the edges.
    transparent: true,
    hasShadow: false,
    resizable: false,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: appWebPreferences()
  })

  // Float above full-screen apps and other always-on-top windows.
  mainWindow.setAlwaysOnTop(true, 'floating')

  // Start fully click-through so the overlay never steals clicks from whatever
  // app is behind it. `forward: true` keeps mousemove events flowing into the
  // renderer even while clicks pass through, so the renderer can detect when the
  // cursor is over an actual lyric line / button and ask us (via the
  // 'overlay:set-interactive' IPC below) to momentarily capture clicks there.
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  // Make the overlay follow you everywhere: join every Space and stay visible
  // even over another app in native fullscreen. Without this a default window is
  // pinned to the single Space it was created on, so the overlay would only
  // appear there — defeating "show whenever I play Spotify" the moment you're on
  // another desktop or watching something fullscreen.
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Visibility is owned entirely by the overlay controller, which shows/hides
  // based on Spotify playback (see setupOverlayBehavior). We deliberately do NOT
  // show on ready-to-show: that would flash the overlay on launch before the
  // first playback poll decides whether it should actually be up.

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

// Overlay hide/show behavior.
//
// The overlay fully auto-shows and auto-hides off Spotify playback:
//   • playing                  → visible (lyrics)
//   • paused / idle / Spotify quit → hidden
//   • not connected            → visible (so the Connect button is reachable)
//
// On top of that, ⌥⌘L and the tray's Show/Hide are a manual override (e.g. to
// tuck the overlay away before reaching into Control Center). The override is
// intentionally cleared the moment a new track starts playing, so hitting play
// always brings the overlay back with no manual step.
//
// `override`:
//   'auto' — follow playback
//   'show' — forced visible (manual)
//   'hide' — forced hidden (manual)
function createOverlayController(win) {
  let override = 'auto'
  let playbackWantsVisible = false

  // Notified after every visibility evaluation so the tray menu can re-label
  // ("Show overlay" ↔ "Hide overlay").
  let onChange = null

  const shouldShow = () => {
    if (override === 'show') return true
    if (override === 'hide') return false
    return playbackWantsVisible
  }

  const apply = () => {
    const show = shouldShow()
    const was = win.isVisible()
    if (show && !was)
      win.showInactive() // never steal focus
    else if (!show && was) win.hide()
    if (show !== was) {
      console.log(`[overlay] ${show ? 'shown' : 'hidden'} (override=${override})`)
    }
    onChange?.()
  }

  return {
    // Playback state from the lyrics engine: 'playing' | 'paused' | 'none' | 'disconnected'.
    onPlayback(state) {
      playbackWantsVisible = state === 'playing' || state === 'disconnected'
      // A fresh "play" always reveals the overlay, clearing any manual hide.
      if (state === 'playing') override = 'auto'
      apply()
    },
    // Hard manual toggle (⌥⌘L / tray). Locks visibility until the next play.
    toggle() {
      override = win.isVisible() ? 'hide' : 'show'
      apply()
    },
    isVisible: () => win.isVisible(),
    setOnChange(cb) {
      onChange = cb
    }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await components.whenReady()
  console.log('[drm]', components.status())
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Auto-start at login — enabled by default on first run of a packaged build.
  // Only on first run: after that we respect whatever the user set via the
  // tray's "Start at login" toggle, instead of forcing it back on every launch.
  // Dev is skipped because the running bundle there is the Electron helper in
  // node_modules — registering it would launch bare Electron on next login.
  if (app.isPackaged && !store.get('loginItemInitialized')) {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })
    store.set('loginItemInitialized', true)
  }

  // macOS: live in the menu bar only — no Dock icon, no app-switcher entry — so
  // the always-on overlay stays out of the way. Control is via the tray.
  if (process.platform === 'darwin') app.dock?.hide()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on(SEND.PING, () => console.log('pong'))

  const mainWindow = createWindow()

  // Click-through toggle. The renderer hit-tests the cursor against interactive
  // content and flips this: interactive=true → capture clicks (lyric seek, hover
  // meaning, buttons); interactive=false → ignore mouse events so clicks fall
  // through to the app behind the overlay. Kept on the lightweight `.send`
  // channel so toggling on every hover boundary stays cheap.
  ipcMain.on(SEND.OVERLAY_SET_INTERACTIVE, (_event, interactive) => {
    if (!mainWindow.isDestroyed()) mainWindow.setIgnoreMouseEvents(!interactive, { forward: true })
  })

  // Overlay visibility controller: auto show/hide off playback + manual override.
  const overlay = createOverlayController(mainWindow)

  // ⌥⌘L hard toggle (e.g. tuck the overlay away before opening Control Center).
  globalShortcut.register('Alt+Command+L', () => overlay.toggle())

  // ---- v2 foundation -------------------------------------------------------
  // Player store: renderers fetch its state/lyrics doc over these handlers and
  // then follow the player:state / lyrics:doc broadcasts.
  playerStore.registerPlayerStoreIpc()

  // Album colour lives in the store so every window tints from the same value.
  // Recomputed only when the art URL changes; a stale result (track moved on
  // while extracting) is dropped.
  playerStore.subscribe(async (next, prev) => {
    const art = next.track?.art ?? null
    if (art === (prev.track?.art ?? null)) return
    if (!art) {
      playerStore.update({ color: null, palette: [] })
      return
    }
    const color = await getAlbumColor(art)
    if ((playerStore.getState().track?.art ?? null) !== art) return
    playerStore.update({ color, palette: color ? [color] : [] })
  })

  // Fullscreen listening mode (windows/fullscreen.js).
  const fullscreen = createFullscreenController()
  ipcMain.on(SEND.WINDOW_FULLSCREEN_TOGGLE, () => fullscreen.toggle())
  ipcMain.on(SEND.WINDOW_FULLSCREEN_CLOSE, () => fullscreen.close())
  globalShortcut.register('Alt+Space', () => fullscreen.toggle())

  // Drive visibility from the lyrics engine's playback state. Registered BEFORE
  // startLyricsSync so we don't miss the engine's very first emit.
  onPlaybackState((state) => overlay.onPlayback(state))

  // Menu-bar tray: Show/Hide overlay, Start-at-login toggle, Quit.
  const trayHandle = createTray(icon, {
    getVisible: () => overlay.isVisible(),
    onToggleOverlay: () => overlay.toggle(),
    getLoginEnabled: () => app.getLoginItemSettings().openAtLogin,
    onToggleLogin: () => {
      const enabled = app.getLoginItemSettings().openAtLogin
      app.setLoginItemSettings({ openAtLogin: !enabled, openAsHidden: true })
    },
    // Wipe the stored token and re-run OAuth — the escape hatch if auth ever
    // breaks. Clearing first means the next poll reports 'disconnected' (overlay
    // shows the Connect state) until the new login lands. focus(steal) brings the
    // modal forward since we're a Dock-less accessory app.
    onReconnect: async () => {
      clearSpotifyTokens()
      app.focus({ steal: true })
      await loginSpotify(mainWindow)
    },
    onQuit: () => app.quit()
  })
  tray = trayHandle.tray
  // Keep the tray's "Show/Hide" label in sync with auto visibility changes.
  overlay.setOnChange(trayHandle.refresh)

  // Make sure the local model is actually available for the lyric-meaning
  // tooltip: start the Ollama daemon if it's installed but not running, then
  // warm the model so the first hover isn't a cold start. No-ops safely if
  // Ollama isn't installed (the app falls back to Gemini).
  ensureOllama()

  // Start the LRCLIB sync engine. It polls Spotify for the active track +
  // position and pushes prev/active/next lines to the renderer via
  // 'lyrics:update'. No-ops harmlessly until the user has connected Spotify.
  startLyricsSync(mainWindow)

  ipcMain.handle(INVOKE.SPOTIFY_LOGIN, async () => {
    return await loginSpotify(mainWindow)
  })

  ipcMain.handle(INVOKE.SPOTIFY_CURRENTLY_PLAYING, async () => {
    return await getCurrentlyPlaying()
  })

  ipcMain.handle(INVOKE.SPOTIFY_IS_CONNECTED, () => {
    return isConnected()
  })

  // Click-to-seek: jump Spotify playback to a lyric line's timestamp, then
  // re-anchor the sync engine so the active line snaps to it immediately instead
  // of waiting for the next 3s Spotify poll.
  ipcMain.handle(INVOKE.SPOTIFY_SEEK, async (_event, positionMs) => {
    const ok = await seekTo(positionMs)
    if (ok) applySeek(positionMs)
    return ok
  })

  ipcMain.handle(INVOKE.COLOR_ALBUM, async (_event, imageUrl) => {
    return await getAlbumColor(imageUrl)
  })

  ipcMain.handle(INVOKE.LLM_LYRIC_MEANING, async (_event, song, artist, lyric) => {
    return await getLyricMeaning(song, artist, lyric)
  })

  ipcMain.handle(INVOKE.LLM_MOOD, async (_event, song, artist) => {
    return await getMood(song, artist)
  })

  ipcMain.handle(INVOKE.LLM_WEEKLY_DIGEST, async (_event, log) => {
    return await getWeeklyDigest(log)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Release the global shortcuts (⌥⌘L, ⌥Space) when quitting.
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
