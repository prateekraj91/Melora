import { useRef, useState, useCallback, useEffect } from 'react'

// Deliberate-hover delay before we fetch + show a line's meaning. This is the
// primary mechanism that keeps the meaning tooltip from fighting click-to-seek:
// a click is a fast in-and-out, so a normal click never dwells long enough to
// trip this timer. Only a genuine "pause to read this line" does. Long enough
// to ignore the cursor merely sweeping across the stack, short enough to feel
// responsive once you settle.
const HOVER_DELAY_MS = 600

// Manages the on-hover lyric-meaning tooltip: the deliberate-hover timer, a
// per-line cache (so a re-hover is instant and never re-hits the model), and a
// stale-request guard so a slow fetch that resolves after you've moved on is
// quietly dropped instead of flashing the wrong meaning over the wrong line.
//
// Returns { tip, enter, leave, dismiss }:
//   tip    — { text, meaning, loading, rect } | null  (what/where to render)
//   enter  — (lyric, el) => start the dwell timer for a line
//   leave  — () => cancel/hide on mouse-out
//   dismiss— () => same as leave; called from onClick so a seek is left clean
export function useLyricMeaning(track) {
  const [tip, setTip] = useState(null)
  const timerRef = useRef(null)
  // `${song}::${lyric}` -> meaning. A ref so it survives re-renders without
  // re-triggering them; the main process caches too, but this also skips the
  // IPC round-trip so a previously-seen line appears instantly.
  const cacheRef = useRef(new Map())
  // The line whose meaning we're currently resolving/showing. Used to ignore a
  // late fetch once the cursor has left or moved to a different line.
  const activeKeyRef = useRef(null)

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const hide = useCallback(() => {
    cancelTimer()
    activeKeyRef.current = null
    setTip(null)
  }, [cancelTimer])

  const enter = useCallback(
    (lyric, el) => {
      if (!lyric || !track || !el) return
      cancelTimer()
      // Capture the element synchronously; by the time the timer fires we read
      // its live bounding box (it's still under the cursor) to anchor the tip.
      timerRef.current = setTimeout(async () => {
        const song = track.name
        const key = `${song}::${lyric}`
        const rect = el.getBoundingClientRect()
        activeKeyRef.current = key

        const cached = cacheRef.current.get(key)
        if (cached) {
          setTip({ text: lyric, meaning: cached, loading: false, rect })
          return
        }

        setTip({ text: lyric, meaning: null, loading: true, rect })
        try {
          const meaning = await window.api.getLyricMeaning(song, track.artist, lyric)
          cacheRef.current.set(key, meaning)
          // Only paint if the user is still dwelling on this same line.
          if (activeKeyRef.current === key) {
            setTip({ text: lyric, meaning, loading: false, rect })
          }
        } catch {
          if (activeKeyRef.current === key) hide()
        }
      }, HOVER_DELAY_MS)
    },
    [track, cancelTimer, hide]
  )

  // Drop any pending timer if the component unmounts mid-dwell.
  useEffect(() => cancelTimer, [cancelTimer])

  return { tip, enter, leave: hide, dismiss: hide }
}
