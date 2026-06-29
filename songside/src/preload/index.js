import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  spotifyLogin: () => ipcRenderer.invoke('spotify:login'),
  getCurrentlyPlaying: () => ipcRenderer.invoke('spotify:currently-playing'),
  getAlbumColor: (imageUrl) => ipcRenderer.invoke('color:album', imageUrl),
  getLyricMeaning: (song, artist, lyric) =>
    ipcRenderer.invoke('llm:lyric-meaning', song, artist, lyric),
  getMood: (song, artist) => ipcRenderer.invoke('llm:mood', song, artist),
  getWeeklyDigest: (log) => ipcRenderer.invoke('llm:weekly-digest', log),
  // Subscribe to synced-lyrics frames pushed from the main process. Returns an
  // unsubscribe function so the renderer can clean up on unmount.
  onLyrics: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('lyrics:update', listener)
    return () => ipcRenderer.removeListener('lyrics:update', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
