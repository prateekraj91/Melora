import 'dotenv/config'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { loginSpotify, getCurrentlyPlaying } from './spotify.js'
import { getAlbumColor } from './color.js'
import { getLyricMeaning, getMood, getWeeklyDigest, warmOllama } from './llm.js'
import { startLyricsSync } from './lyrics.js'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 460,
    height: 120,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
