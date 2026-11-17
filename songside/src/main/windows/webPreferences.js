import { join } from 'path'

// webPreferences shared by every SongSide renderer window (overlay, fullscreen,
// later the hidden player) so they all get the same preload and isolation.
export function appWebPreferences() {
  return {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,
    contextIsolation: true,
    nodeIntegration: false
  }
}
