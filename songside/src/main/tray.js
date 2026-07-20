// Menu-bar tray for the always-on overlay. Gives real control beyond the ⌥⌘L
// hotkey: toggle the overlay, flip "Start at login" (reflecting the live
// setLoginItemSettings state), and quit.
//
// The overlay normally shows/hides itself from Spotify playback; the tray's
// Show/Hide is a manual override that the next "play" naturally clears.

import { Tray, Menu, nativeImage } from 'electron'

// Build a crisp menu-bar image from the app icon. macOS menu-bar glyphs are
// ~18px and render as template images (the system tints them for light/dark
// menu bars and the selected/highlighted state), so we resize and mark it as a
// template — the icon's alpha becomes the mask.
function trayImage(iconPath) {
  const img = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
  img.setTemplateImage(true)
  return img
}

// handlers:
//   getVisible()      → is the overlay currently shown?
//   onToggleOverlay() → flip overlay visibility (manual override)
//   getLoginEnabled() → is open-at-login currently on?
//   onToggleLogin()   → flip open-at-login
//   onReconnect()     → clear the Spotify token and re-run the auth flow
//   onQuit()          → quit the app
// Returns { tray, refresh } — call refresh() after any state change so the
// menu's labels/checkbox reflect reality.
export function createTray(iconPath, handlers) {
  const tray = new Tray(trayImage(iconPath))
  tray.setToolTip('SongSide')

  const refresh = () => {
    const menu = Menu.buildFromTemplate([
      {
        label: handlers.getVisible() ? 'Hide overlay' : 'Show overlay',
        accelerator: 'Alt+Cmd+L',
        click: () => {
          handlers.onToggleOverlay()
          refresh()
        }
      },
      { type: 'separator' },
      {
        label: 'Start at login',
        type: 'checkbox',
        checked: handlers.getLoginEnabled(),
        click: () => {
          handlers.onToggleLogin()
          refresh()
        }
      },
      { label: 'Reconnect Spotify…', click: () => handlers.onReconnect() },
      { type: 'separator' },
      { label: 'Quit SongSide', accelerator: 'Cmd+Q', click: () => handlers.onQuit() }
    ])
    tray.setContextMenu(menu)
  }

  refresh()
  return { tray, refresh }
}
