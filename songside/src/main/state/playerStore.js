// The single source of truth for playback in the main process.
//
// Producers (the v1 lyrics engine today; the Web Playback SDK window and
// command layer later) call update(patch). Consumers either subscribe() in main
// or receive the PUSH.PLAYER_STATE / PUSH.LYRICS_DOC broadcasts in every
// BrowserWindow. Renderers fetch the initial value with INVOKE.PLAYER_GET_STATE
// / INVOKE.LYRICS_GET_DOC and then follow the pushes.
//
// Position is an anchor (positionMs at epoch positionAt) and never ticks here —
// each consumer interpolates locally. That keeps broadcasts rare: only real
// changes (track, play/pause, seek, re-anchor on poll, colour…) go out.

import { BrowserWindow, ipcMain } from 'electron'
import { INVOKE, PUSH } from '../../shared/ipc.js'

/** @typedef {import('../../shared/types.js').PlayerState} PlayerState */
/** @typedef {import('../../shared/types.js').LyricsDoc} LyricsDoc */

/** @type {PlayerState} */
let state = {
  connected: false,
  status: 'disconnected',
  track: null,
  positionMs: 0,
  positionAt: 0,
  isPlaying: false,
  volume: null,
  device: null,
  color: null,
  palette: []
}

/** @type {LyricsDoc|null} */
let lyricsDoc = null

/** @type {Set<(next: PlayerState, prev: PlayerState) => void>} */
const listeners = new Set()

function sameValue(key, a, b) {
  if (a === b) return true
  if (key === 'track') return (a?.id ?? null) === (b?.id ?? null)
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i])
  }
  return false
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

/** @returns {PlayerState} */
export function getState() {
  return state
}

/** @returns {LyricsDoc|null} */
export function getLyricsDoc() {
  return lyricsDoc
}

/**
 * Shallow-merge a patch. Tracks compare by id, arrays element-wise. If anything
 * changed, notify subscribers and broadcast PUSH.PLAYER_STATE to all windows.
 * @param {Partial<PlayerState>} patch
 * @returns {boolean} whether the state changed
 */
export function update(patch) {
  let changed = false
  for (const key of Object.keys(patch)) {
    if (!sameValue(key, state[key], patch[key])) {
      changed = true
      break
    }
  }
  if (!changed) return false

  const prev = state
  state = { ...state, ...patch }
  for (const cb of listeners) {
    try {
      cb(state, prev)
    } catch (e) {
      console.error('[playerStore] listener failed:', e)
    }
  }
  broadcast(PUSH.PLAYER_STATE, state)
  return true
}

/**
 * Replace the current lyrics document and broadcast PUSH.LYRICS_DOC.
 * @param {LyricsDoc|null} doc
 */
export function setLyricsDoc(doc) {
  lyricsDoc = doc
  broadcast(PUSH.LYRICS_DOC, doc)
}

/**
 * @param {(next: PlayerState, prev: PlayerState) => void} cb
 * @returns {() => void} unsubscribe
 */
export function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function registerPlayerStoreIpc() {
  ipcMain.handle(INVOKE.PLAYER_GET_STATE, () => state)
  ipcMain.handle(INVOKE.LYRICS_GET_DOC, () => lyricsDoc)
}
