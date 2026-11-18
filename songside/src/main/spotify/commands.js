// Player command executor over the Spotify Web API (v2 task 2.2a). Works with
// whatever device is active (today: the Spotify desktop app).
//
//   commandToRequest(cmd, state)  pure: PlayerCommand → { method, path, body }
//   optimisticPatch(cmd, state)   pure: the store patch to apply right away
//   createCommandRunner(deps)     runCommand(cmd) → Promise<boolean>
//
// The runner is dependency-injected (fetch, tokens, store, poll) so it is
// unit-tested with a mocked fetch; main/index.js wires the real ones.
//
// Errors never throw to the caller: 401 → refresh the token and retry once;
// 403 (not Premium / restricted, e.g. volume on some devices) and 404 (no
// active device) → log and resolve false.

/** @typedef {import('../../shared/types.js').PlayerCommand} PlayerCommand */
/** @typedef {import('../../shared/types.js').PlayerState} PlayerState */

const API = 'https://api.spotify.com/v1'

export const COMMAND_TYPES = [
  'play',
  'pause',
  'toggle',
  'next',
  'prev',
  'seek',
  'volume',
  'volumeDelta',
  'playUri',
  'queue',
  'like',
  'sleep'
]

const clampVolume = (v) => Math.max(0, Math.min(100, Math.round(v)))
const DEFAULT_VOLUME = 50

/** Current interpolated position (ms) from the store's anchor. */
export function positionNow(state, now = Date.now()) {
  if (!state) return 0
  const elapsed = state.isPlaying && state.positionAt > 0 ? now - state.positionAt : 0
  const pos = (state.positionMs ?? 0) + elapsed
  const dur = state.track?.durationMs ?? 0
  return Math.max(0, dur > 0 ? Math.min(pos, dur) : pos)
}

/**
 * @typedef {Object} ApiRequest
 * @property {'GET'|'PUT'|'POST'} method
 * @property {string} path        including query string
 * @property {Object} [body]      JSON body
 */

/**
 * Pure mapping from a command to a Web API request. Returns null for invalid
 * commands or ones that don't map to a request (sleep).
 * @param {PlayerCommand} cmd
 * @param {PlayerState|null} state
 * @returns {ApiRequest|null}
 */
export function commandToRequest(cmd, state) {
  if (!cmd || typeof cmd.type !== 'string') return null
  switch (cmd.type) {
    case 'play':
      return { method: 'PUT', path: '/me/player/play' }
    case 'pause':
      return { method: 'PUT', path: '/me/player/pause' }
    case 'toggle':
      return state?.isPlaying
        ? { method: 'PUT', path: '/me/player/pause' }
        : { method: 'PUT', path: '/me/player/play' }
    case 'next':
      return { method: 'POST', path: '/me/player/next' }
    case 'prev':
      return { method: 'POST', path: '/me/player/previous' }
    case 'seek': {
      if (!Number.isFinite(cmd.positionMs)) return null
      const ms = Math.max(0, Math.round(cmd.positionMs))
      return { method: 'PUT', path: `/me/player/seek?position_ms=${ms}` }
    }
    case 'volume':
      if (!Number.isFinite(cmd.value)) return null
      return { method: 'PUT', path: `/me/player/volume?volume_percent=${clampVolume(cmd.value)}` }
    case 'volumeDelta': {
      if (!Number.isFinite(cmd.delta)) return null
      const base = Number.isFinite(state?.volume) ? state.volume : DEFAULT_VOLUME
      return {
        method: 'PUT',
        path: `/me/player/volume?volume_percent=${clampVolume(base + cmd.delta)}`
      }
    }
    case 'playUri': {
      if (typeof cmd.uri !== 'string' || !cmd.uri.startsWith('spotify:')) return null
      const isTrack = /^spotify:(track|episode):/.test(cmd.uri)
      return {
        method: 'PUT',
        path: '/me/player/play',
        body: isTrack ? { uris: [cmd.uri] } : { context_uri: cmd.uri }
      }
    }
    case 'queue':
      if (typeof cmd.uri !== 'string' || !cmd.uri.startsWith('spotify:')) return null
      return { method: 'POST', path: `/me/player/queue?uri=${encodeURIComponent(cmd.uri)}` }
    case 'like': {
      const id = cmd.trackId ?? state?.track?.id
      if (!id) return null
      return { method: 'PUT', path: `/me/tracks?ids=${encodeURIComponent(id)}` }
    }
    default:
      return null
  }
}

/**
 * The store patch to apply immediately after a successful command, so the UI
 * responds before the next Spotify poll confirms it.
 * @param {PlayerCommand} cmd
 * @param {PlayerState|null} state
 * @param {number} [now]
 * @returns {Partial<PlayerState>|null}
 */
export function optimisticPatch(cmd, state, now = Date.now()) {
  if (!state) return null
  const pause = () => ({
    isPlaying: false,
    status: 'paused',
    positionMs: positionNow(state, now),
    positionAt: now
  })
  const play = () => ({
    isPlaying: true,
    status: 'playing',
    positionMs: positionNow(state, now),
    positionAt: now
  })
  switch (cmd.type) {
    case 'play':
      return play()
    case 'pause':
      return pause()
    case 'toggle':
      return state.isPlaying ? pause() : play()
    case 'seek':
      return { positionMs: Math.max(0, Math.round(cmd.positionMs)), positionAt: now }
    case 'volume':
      return { volume: clampVolume(cmd.value) }
    case 'volumeDelta': {
      const base = Number.isFinite(state.volume) ? state.volume : DEFAULT_VOLUME
      return { volume: clampVolume(base + cmd.delta) }
    }
    default:
      return null
  }
}

/**
 * @param {{
 *   fetch: typeof fetch,
 *   getToken: () => Promise<string|null>,
 *   refreshToken: () => Promise<void>,
 *   getState: () => PlayerState|null,
 *   updateState?: (patch: Partial<PlayerState>) => void,
 *   pollNow?: () => void,
 *   log?: (...a: any[]) => void,
 *   setTimeout?: typeof setTimeout,
 * }} deps
 */
export function createCommandRunner(deps) {
  const log = deps.log ?? ((...a) => console.warn('[command]', ...a))
  const later = deps.setTimeout ?? setTimeout

  async function send(req, token) {
    return deps.fetch(`${API}${req.path}`, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(req.body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(req.body ? { body: JSON.stringify(req.body) } : {})
    })
  }

  /**
   * @param {PlayerCommand} cmd
   * @returns {Promise<boolean>}
   */
  return async function runCommand(cmd) {
    if (!cmd || !COMMAND_TYPES.includes(cmd.type)) {
      log('unknown command', cmd)
      return false
    }
    if (cmd.type === 'sleep') {
      log('sleep timer is not implemented yet (later task)')
      return false
    }
    const state = deps.getState()
    const req = commandToRequest(cmd, state)
    if (!req) {
      log('invalid command', cmd)
      return false
    }

    try {
      let token = await deps.getToken()
      if (!token) {
        log(`${cmd.type}: not connected to Spotify`)
        return false
      }
      let res = await send(req, token)
      if (res.status === 401) {
        await deps.refreshToken()
        token = await deps.getToken()
        if (!token) return false
        res = await send(req, token)
      }
      if (res.status === 404) {
        log(`${cmd.type}: no active Spotify device (404)`)
        return false
      }
      if (res.status === 403) {
        let reason = ''
        try {
          reason = (await res.json())?.error?.reason ?? ''
        } catch {
          /* no body */
        }
        log(
          `${cmd.type}: forbidden (403${reason ? ` ${reason}` : ''}) — Premium/device restriction`
        )
        return false
      }
      if (!res.ok) {
        log(`${cmd.type}: Spotify API error ${res.status}`)
        return false
      }

      const patch = optimisticPatch(cmd, state)
      if (patch) deps.updateState?.(patch)
      // Re-poll now, and once more shortly after: the Web API is eventually
      // consistent (e.g. currently-playing lags a 'next' by a few hundred ms).
      deps.pollNow?.()
      later(() => deps.pollNow?.(), 700)
      return true
    } catch (e) {
      log(`${cmd.type}: request failed:`, e.message)
      return false
    }
  }
}
