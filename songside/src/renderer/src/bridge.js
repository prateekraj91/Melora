// The ONLY way v2 renderer code reaches the main process.
//
// Wraps the preload's window.api and degrades gracefully when it is missing:
// the screensaver (later) loads this page outside Electron, where there is no
// preload. In that case getters resolve to null, subscriptions are no-ops and
// commands are dropped — callers never need to check for Electron themselves.
//
// v1 code (components/Overlay.jsx and its hooks) still talks to window.api
// directly; don't add new callers of window.api — go through here.

import { INVOKE, SEND, PUSH } from '../../shared/ipc.js'
import {
  isMock,
  mockState,
  mockLyrics,
  mockCommand,
  onMockState,
  onMockLyrics
} from './dev/mockPlayer.js'

export { INVOKE, SEND, PUSH }

/** @typedef {import('../../shared/types.js').PlayerState} PlayerState */
/** @typedef {import('../../shared/types.js').LyricsDoc} LyricsDoc */

const api = typeof window !== 'undefined' ? window.api : undefined
const noop = () => {}

/** True when running inside Electron with the preload bridge available. */
export const hasBridge = !!api

// Dev-only: with no preload and `?mock` in the URL, serve a fake playing track
// so the visuals can be checked in a plain browser (see dev/mockPlayer.js).
const mock = import.meta.env?.DEV && isMock()

/** @returns {Promise<PlayerState|null>} */
export function getPlayerState() {
  if (mock) return Promise.resolve(mockState())
  return api?.getPlayerState ? api.getPlayerState() : Promise.resolve(null)
}

/** @returns {Promise<LyricsDoc|null>} */
export function getLyricsDoc() {
  if (mock) return Promise.resolve(mockLyrics())
  return api?.getLyricsDoc ? api.getLyricsDoc() : Promise.resolve(null)
}

/**
 * @param {(state: PlayerState) => void} cb
 * @returns {() => void} unsubscribe
 */
export function onPlayerState(cb) {
  if (mock) return onMockState(cb)
  return api?.onPlayerState ? api.onPlayerState(cb) : noop
}

/**
 * @param {(doc: LyricsDoc|null) => void} cb
 * @returns {() => void} unsubscribe
 */
export function onLyricsDoc(cb) {
  if (mock) return onMockLyrics(cb)
  return api?.onLyricsDoc ? api.onLyricsDoc(cb) : noop
}

/**
 * Run a player command in main (spotify/commands.js).
 * @param {import('../../shared/types.js').PlayerCommand} cmd
 * @returns {Promise<boolean>} false when it failed or there is no bridge
 */
export function runCommand(cmd) {
  if (mock) return Promise.resolve(mockCommand(cmd))
  return api?.invoke ? api.invoke(INVOKE.PLAYER_COMMAND, cmd) : Promise.resolve(false)
}

export function toggleFullscreen() {
  api?.toggleFullscreen?.()
}

export function closeFullscreen() {
  api?.closeFullscreen?.()
}

/**
 * Generic request/response on a channel declared in INVOKE.
 * @param {string} channel
 * @param {...*} args
 * @returns {Promise<*>} resolves null when there is no bridge
 */
export function invoke(channel, ...args) {
  return api?.invoke ? api.invoke(channel, ...args) : Promise.resolve(null)
}

/**
 * Generic fire-and-forget on a channel declared in SEND.
 * @param {string} channel
 * @param {...*} args
 */
export function send(channel, ...args) {
  api?.send?.(channel, ...args)
}

/**
 * Generic subscription to a channel declared in PUSH.
 * @param {string} channel
 * @param {(data: *) => void} cb
 * @returns {() => void} unsubscribe
 */
export function subscribe(channel, cb) {
  return api?.subscribe ? api.subscribe(channel, cb) : noop
}
