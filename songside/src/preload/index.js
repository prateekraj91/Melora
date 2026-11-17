import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { INVOKE, SEND, PUSH, isInvokeChannel, isSendChannel, isPushChannel } from '../shared/ipc.js'

// Subscribe to a main→renderer push; returns an unsubscribe function.
function on(channel, callback) {
  const listener = (_event, data) => callback(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

// Custom APIs for renderer
const api = {
  // ---- v1 ------------------------------------------------------------------
  spotifyLogin: () => ipcRenderer.invoke(INVOKE.SPOTIFY_LOGIN),
  getCurrentlyPlaying: () => ipcRenderer.invoke(INVOKE.SPOTIFY_CURRENTLY_PLAYING),
  isConnected: () => ipcRenderer.invoke(INVOKE.SPOTIFY_IS_CONNECTED),
  seek: (positionMs) => ipcRenderer.invoke(INVOKE.SPOTIFY_SEEK, positionMs),
  // Toggle whether the overlay window captures clicks (true) or lets them fall
  // through to the app behind it (false). Driven by the renderer's hover
  // hit-testing — see useClickThrough.
  setInteractive: (interactive) => ipcRenderer.send(SEND.OVERLAY_SET_INTERACTIVE, interactive),
  getAlbumColor: (imageUrl) => ipcRenderer.invoke(INVOKE.COLOR_ALBUM, imageUrl),
  getLyricMeaning: (song, artist, lyric) =>
    ipcRenderer.invoke(INVOKE.LLM_LYRIC_MEANING, song, artist, lyric),
  getMood: (song, artist) => ipcRenderer.invoke(INVOKE.LLM_MOOD, song, artist),
  getWeeklyDigest: (log) => ipcRenderer.invoke(INVOKE.LLM_WEEKLY_DIGEST, log),
  // Subscribe to synced-lyrics frames pushed from the main process. Returns an
  // unsubscribe function so the renderer can clean up on unmount.
  onLyrics: (callback) => on(PUSH.LYRICS_UPDATE, callback),

  // ---- v2 ------------------------------------------------------------------
  getPlayerState: () => ipcRenderer.invoke(INVOKE.PLAYER_GET_STATE),
  getLyricsDoc: () => ipcRenderer.invoke(INVOKE.LYRICS_GET_DOC),
  onPlayerState: (callback) => on(PUSH.PLAYER_STATE, callback),
  onLyricsDoc: (callback) => on(PUSH.LYRICS_DOC, callback),
  toggleFullscreen: () => ipcRenderer.send(SEND.WINDOW_FULLSCREEN_TOGGLE),
  closeFullscreen: () => ipcRenderer.send(SEND.WINDOW_FULLSCREEN_CLOSE),

  // Generic, allow-listed access: only channels declared in shared/ipc.js.
  invoke: (channel, ...args) => {
    if (!isInvokeChannel(channel)) {
      return Promise.reject(new Error(`[preload] unknown invoke channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel, ...args) => {
    if (!isSendChannel(channel)) throw new Error(`[preload] unknown send channel: ${channel}`)
    ipcRenderer.send(channel, ...args)
  },
  subscribe: (channel, callback) => {
    if (!isPushChannel(channel)) throw new Error(`[preload] unknown push channel: ${channel}`)
    return on(channel, callback)
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
