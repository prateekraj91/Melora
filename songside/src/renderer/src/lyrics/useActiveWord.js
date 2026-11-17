import { useCallback, useEffect, useMemo, useRef } from 'react'
import { getActiveAt, getTimedDoc } from './activeWord.js'

/** @typedef {import('../../../shared/types.js').LyricsDoc} LyricsDoc */
/** @typedef {import('./activeWord.js').ActiveWord} ActiveWord */

/**
 * Word-level "what is being sung now" for a lyrics doc (v2 task 1.5).
 *
 * Returns a STABLE getter `() => ActiveWord` ({ line, word, wordProgress,
 * lineProgress }) to call from a requestAnimationFrame loop. It never causes
 * re-renders: the timed doc and clock live in refs. The word-timed doc is
 * memoised per trackId (see getTimedDoc).
 *
 * @param {LyricsDoc|null} doc
 * @param {() => number} now  Playback clock (usePlaybackClock)
 * @returns {() => ActiveWord}
 */
export function useActiveWord(doc, now) {
  const timed = useMemo(() => getTimedDoc(doc), [doc])
  const ref = useRef({ timed, now })

  useEffect(() => {
    ref.current = { timed, now }
  }, [timed, now])

  return useCallback(() => getActiveAt(ref.current.timed, ref.current.now()), [])
}

/**
 * The word-timed doc for rendering (same memoised object the getter uses).
 * @param {LyricsDoc|null} doc
 * @returns {LyricsDoc|null}
 */
export function useTimedDoc(doc) {
  return useMemo(() => getTimedDoc(doc), [doc])
}
