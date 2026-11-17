// Pure "what is being sung at time t" lookup over a word-timed LyricsDoc
// (v2 task 1.5). Used by useActiveWord; kept React-free for node:test.

import { addWordTimings } from './wordTiming.js'

/** @typedef {import('../../../shared/types.js').LyricsDoc} LyricsDoc */

/**
 * @typedef {Object} ActiveWord
 * @property {number} line          Index into doc.lines; -1 before the first line / no lyrics
 * @property {number} word          Index into lines[line].words; -1 if none
 * @property {number} wordProgress  0–1 through the active word
 * @property {number} lineProgress  0–1 through the line's SUNG span
 *                                  (line.time → last word's end); stays 1
 *                                  through any instrumental tail until the next line
 */

/** @type {ActiveWord} */
export const NO_ACTIVE = Object.freeze({ line: -1, word: -1, wordProgress: 0, lineProgress: 0 })

const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x)

/** Last index whose `key` is <= t, or -1. `items` must be sorted by key. */
function lastAtOrBefore(items, t, key) {
  let lo = 0
  let hi = items.length - 1
  let idx = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (items[mid][key] <= t) {
      idx = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return idx
}

/**
 * @param {LyricsDoc|null} doc  A doc that has been through addWordTimings
 * @param {number} t            Playback position, ms
 * @returns {ActiveWord}
 */
export function getActiveAt(doc, t) {
  const lines = doc?.lines
  if (!lines?.length) return NO_ACTIVE

  const li = lastAtOrBefore(lines, t, 'time')
  if (li < 0) return NO_ACTIVE

  const line = lines[li]
  const words = line.words ?? []
  if (!words.length) {
    const dur = (line.endTime ?? line.time) - line.time
    return {
      line: li,
      word: -1,
      wordProgress: 0,
      lineProgress: dur > 0 ? clamp01((t - line.time) / dur) : 1
    }
  }

  const sungEnd = words[words.length - 1].end
  const sungDur = sungEnd - line.time
  const lineProgress = sungDur > 0 ? clamp01((t - line.time) / sungDur) : 1

  const wi = Math.max(0, lastAtOrBefore(words, t, 'start'))
  const w = words[wi]
  const wDur = w.end - w.start
  const wordProgress = wDur > 0 ? clamp01((t - w.start) / wDur) : 1

  return { line: li, word: wi, wordProgress, lineProgress }
}

// Timed docs memoised per trackId. A doc for the same track can arrive more
// than once (initial fetch + push, each a fresh object over IPC), so the key
// also includes mode + line count; identical content reuses the timing.
const MAX_CACHED = 8
const cache = new Map()

/**
 * addWordTimings with a small per-track cache.
 * @param {LyricsDoc|null} doc
 * @returns {LyricsDoc|null}
 */
export function getTimedDoc(doc) {
  if (!doc) return null
  const key = `${doc.trackId}|${doc.mode}|${doc.lines?.length ?? 0}`
  const hit = cache.get(key)
  if (hit) return hit
  const timed = addWordTimings(doc)
  cache.set(key, timed)
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value)
  return timed
}
