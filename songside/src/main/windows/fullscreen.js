// Fullscreen listening-mode window controller (v2 task 1.3).
//
// One BrowserWindow, created lazily on first open() and then reused with
// show/hide — never destroyed, so reopening is instant and the renderer keeps
// its state. It is NOT native macOS fullscreen (no Space switch / animation):
// it is a frameless black window sized to the bounds of the display under the
// cursor, at the 'screen-saver' level so it sits above the menu bar, the Dock,
// other apps' fullscreen Spaces and the v1 overlay (which stays at 'floating'
// underneath and keeps its own auto show/hide).
//
// The renderer loads the '#/fullscreen' hash route and draws purely from the
// playerStore broadcasts (player:state, lyrics:doc), which reach this window
// because the store broadcasts to every BrowserWindow. Esc in the renderer
// sends window:fullscreen-close; ⌥Space toggles (main/index.js).

import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { appWebPreferences } from './webPreferences.js'

function cursorDisplayBounds() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds
}

function createWindow() {
  const win = new BrowserWindow({
    ...cursorDisplayBounds(),
    show: false,
    frame: false,
    backgroundColor: '#000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // Let the window cover the menu-bar strip too.
    enableLargerThanScreen: true,
    webPreferences: appWebPreferences()
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Never destroy: a close (e.g. ⌘W) just hides it.
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/fullscreen`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/fullscreen' })
  }
  return win
}

/**
 * @returns {{ open: () => void, close: () => void, toggle: () => void, isOpen: () => boolean }}
 */
export function createFullscreenController() {
  /** @type {BrowserWindow|null} */
  let win = null

  // Let quitting actually close the window instead of hiding it.
  app.on('before-quit', () => {
    app.isQuitting = true
  })

  const isOpen = () => !!win && !win.isDestroyed() && win.isVisible()

  const open = () => {
    if (!win || win.isDestroyed()) win = createWindow()
    win.setBounds(cursorDisplayBounds())
    app.focus({ steal: true })
    win.show()
    win.focus()
  }

  const close = () => {
    if (win && !win.isDestroyed() && win.isVisible()) win.hide()
  }

  return {
    open,
    close,
    toggle: () => (isOpen() ? close() : open()),
    isOpen
  }
}
