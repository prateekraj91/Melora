// Feedback without buttons (v2 task 2.6): pure, unit-tested pieces.
// useFeedback.js turns these into Web Animations on refs (no React state).

/** @typedef {import('../../../shared/types.js').PlayerCommand} PlayerCommand */

export const SKIP_MS = 300
/** Slide the old lyrics back in if no new lyrics doc arrives within this. */
export const SKIP_WAIT_MS = 1500
/** How far the lyrics travel on a skip, in vw. */
export const SKIP_OFFSET_VW = 8
export const VOLUME_HOLD_MS = 800
export const VOLUME_FADE_MS = 400
export const LIKE_MS = 900
export const HINT_MS = 4000
export const HINT_KEY = 'songside.v2.hintsShown'
export const HINT_TEXT = 'swipe to skip · click to pause · ↑↓ volume · esc to close'

/**
 * Which way the lyrics leave on a skip: next → left (-1, follows a
 * swipe-left), prev → right (+1). Anything else → 0 (no slide).
 * @param {PlayerCommand|null|undefined} cmd
 * @returns {-1|0|1}
 */
export function skipDirection(cmd) {
  if (cmd?.type === 'next') return -1
  if (cmd?.type === 'prev') return 1
  return 0
}

/**
 * Tracks a skip from "lyrics slide out" to "new lyrics slide in".
 *
 * skip(): the lyrics slide out now. Repeated skips while one is pending keep
 * the ORIGINAL lyrics id, so the first new doc ends the wait.
 * update(): call when the lyrics doc changes or on a timer. Returns null
 * while still waiting, or `{ dir, delay }` once the slide-in should start:
 * the doc id changed, or SKIP_WAIT_MS passed (skip failed / slow lyrics).
 * `delay` makes sure the slide-out finished first.
 */
export function createSkipTracker() {
  /** @type {{ dir: number, t: number, from: string|null }|null} */
  let pending = null
  return {
    /**
     * @param {PlayerCommand} cmd
     * @param {number} t
     * @param {string|null} docId  trackId of the lyrics on screen now
     * @returns {-1|0|1} slide-out direction (0 = not a skip)
     */
    skip(cmd, t, docId) {
      const dir = skipDirection(cmd)
      if (!dir) return 0
      pending = { dir, t, from: pending ? pending.from : docId }
      return dir
    },
    /**
     * @param {number} t
     * @param {string|null} docId
     * @returns {{ dir: number, delay: number }|null}
     */
    update(t, docId) {
      if (!pending) return null
      if (docId === pending.from && t - pending.t < SKIP_WAIT_MS) return null
      const out = { dir: pending.dir, delay: Math.max(0, pending.t + SKIP_MS - t) }
      pending = null
      return out
    },
    isPending: () => !!pending
  }
}

/**
 * The faint volume label, e.g. "vol 60". null for an unknown volume.
 * @param {number|null|undefined} volume
 */
export function volumeLabel(volume) {
  if (typeof volume !== 'number' || !Number.isFinite(volume)) return null
  return `vol ${Math.round(Math.max(0, Math.min(100, volume)))}`
}

/**
 * Whether a volume change deserves feedback: both values known and different.
 * (The first state after load is not a "change".)
 */
export function volumeChanged(prev, next) {
  return typeof prev === 'number' && typeof next === 'number' && prev !== next
}

/** Paused look only for a real pause — not idle / disconnected. */
export const isPausedLook = (status) => status === 'paused'

/**
 * First-ever fullscreen open? Reads and sets HINT_KEY in `storage`. Any
 * storage error → false: never risk showing the hint on every open.
 * @param {Pick<Storage, 'getItem'|'setItem'>|null|undefined} storage
 */
export function takeFirstRun(storage) {
  try {
    if (!storage || storage.getItem(HINT_KEY)) return false
    storage.setItem(HINT_KEY, '1')
    return true
  } catch {
    return false
  }
}

/**
 * Like-bloom colour from the palette: its lightest entry lifted a little
 * further towards white so it reads as soft on any background.
 * @param {[number, number, number][]} palette  normalised RGB (visuals/palette.js)
 * @returns {[number, number, number]}
 */
export function bloomColour(palette) {
  let best = palette[0]
  let bestL = -1
  for (const c of palette) {
    const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    if (l > bestL) {
      bestL = l
      best = c
    }
  }
  return [0, 1, 2].map((k) => best[k] + (1 - best[k]) * 0.25)
}
