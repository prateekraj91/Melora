import { useCallback, useEffect, useRef } from 'react'

/** @typedef {import('../../../shared/types.js').PlayerState} PlayerState */

/**
 * Returns a STABLE `now()` that interpolates the playback position (ms) from
 * the store's anchor: positionMs + (Date.now() - positionAt) while playing,
 * clamped to [0, durationMs]. Never causes re-renders — call it from rAF loops,
 * canvas frames, etc.
 *
 * @param {PlayerState|null} state
 * @returns {() => number}
 */
export function usePlaybackClock(state) {
  const anchor = useRef({ positionMs: 0, positionAt: 0, isPlaying: false, durationMs: 0 })

  const positionMs = state?.positionMs ?? 0
  const positionAt = state?.positionAt ?? 0
  const isPlaying = !!state?.isPlaying
  const durationMs = state?.track?.durationMs ?? 0

  useEffect(() => {
    anchor.current = { positionMs, positionAt, isPlaying, durationMs }
  }, [positionMs, positionAt, isPlaying, durationMs])

  return useCallback(() => {
    const a = anchor.current
    let pos = a.positionMs
    if (a.isPlaying && a.positionAt > 0) pos += Date.now() - a.positionAt
    if (a.durationMs > 0) pos = Math.min(pos, a.durationMs)
    return Math.max(0, pos)
  }, [])
}
