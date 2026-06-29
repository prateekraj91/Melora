import 'dotenv/config'
import { app, shell, BrowserWindow, ipcMain, screen, globalShortcut } from 'electron'
import { loginSpotify, getCurrentlyPlaying, seekTo } from './spotify.js'
import { getAlbumColor } from './color.js'
import { getLyricMeaning, getMood, getWeeklyDigest, warmOllama } from './llm.js'
import { startLyricsSync, applySeek } from './lyrics.js'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Overlay dimensions. Taller than before to fit the karaoke stack: 1 previous
// line, the active line, and several upcoming lines.
const WIN_W = 360
const WIN_H = 300
const EDGE_MARGIN = 12

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
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Float above full-screen apps and other always-on-top windows.
  mainWindow.setAlwaysOnTop(true, 'floating')

  mainWindow.on('ready-to-show', () => {
    // showInactive so the overlay never steals focus from whatever you're using.
    mainWindow.showInactive()
  })

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
// macOS exposes no reliable signal for "Control Center opened" (it isn't an app
// activation and posts no public notification), so rather than fake it we give
// two dependable controls:
//   • ⌥⌘L  — hard toggle. Tap it to get the pill out of the way (e.g. before
//            reaching into Control Center), tap again to bring it back. This
//            overrides auto-hide and is never undone by mouse movement.
//   • idle — auto-hide after 5s with no cursor movement; reappears the moment
//            you move the mouse. Polls the global cursor (no extra permissions).
const IDLE_MS = 5000
const CURSOR_POLL_MS = 700

function setupOverlayBehavior(win) {
  let userHidden = false // hard toggle (⌥⌘L)
  let idleHidden = false // auto-hidden by inactivity
  let lastActive = Date.now()
  let lastPos = screen.getCursorScreenPoint()

  const apply = () => {
    const shouldShow = !userHidden && !idleHidden
    if (shouldShow && !win.isVisible()) win.showInactive()
    else if (!shouldShow && win.isVisible()) win.hide()
  }

  const idleTimer = setInterval(() => {
    if (win.isDestroyed()) return
    const p = screen.getCursorScreenPoint()
    if (p.x !== lastPos.x || p.y !== lastPos.y) {
      lastPos = p
      lastActive = Date.now()
      if (idleHidden) {
        idleHidden = false
        apply()
      }
    } else if (!idleHidden && Date.now() - lastActive > IDLE_MS) {
      idleHidden = true
      apply()
    }
  }, CURSOR_POLL_MS)

  globalShortcut.register('Alt+Command+L', () => {
    userHidden = !userHidden
    // Reset the idle baseline so an un-hide doesn't instantly auto-hide again.
    idleHidden = false
    lastActive = Date.now()
    lastPos = screen.getCursorScreenPoint()
    apply()
  })

  win.on('closed', () => clearInterval(idleTimer))
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  const mainWindow = createWindow()

  // Top-right placement + ⌥⌘L toggle + idle auto-hide.
  setupOverlayBehavior(mainWindow)

  // Pre-load the local model so the first request isn't a cold start.
  // No-ops safely if Ollama isn't running.
  warmOllama()

  // Start the LRCLIB sync engine. It polls Spotify for the active track +
  // position and pushes prev/active/next lines to the renderer via
  // 'lyrics:update'. No-ops harmlessly until the user has connected Spotify.
  startLyricsSync(mainWindow)

  ipcMain.handle('spotify:login', async () => {
    return await loginSpotify(mainWindow)
  })

  ipcMain.handle('spotify:currently-playing', async () => {
    return await getCurrentlyPlaying()
  })

  // Click-to-seek: jump Spotify playback to a lyric line's timestamp, then
  // re-anchor the sync engine so the active line snaps to it immediately instead
  // of waiting for the next 3s Spotify poll.
  ipcMain.handle('spotify:seek', async (_event, positionMs) => {
    const ok = await seekTo(positionMs)
    if (ok) applySeek(positionMs)
    return ok
  })

  ipcMain.handle('color:album', async (_event, imageUrl) => {
    return await getAlbumColor(imageUrl)
  })

  ipcMain.handle('llm:lyric-meaning', async (_event, song, artist, lyric) => {
    return await getLyricMeaning(song, artist, lyric)
  })

  ipcMain.handle('llm:mood', async (_event, song, artist) => {
    return await getMood(song, artist)
  })

  ipcMain.handle('llm:weekly-digest', async (_event, log) => {
    return await getWeeklyDigest(log)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Release the global ⌥⌘L shortcut when quitting.
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
