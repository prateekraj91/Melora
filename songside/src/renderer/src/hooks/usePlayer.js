import { useEffect, useState } from 'react'
import { getPlayerState, getLyricsDoc, onPlayerState, onLyricsDoc } from '../bridge'

/** @typedef {import('../../../shared/types.js').PlayerState} PlayerState */
/** @typedef {import('../../../shared/types.js').LyricsDoc} LyricsDoc */

/**
 * v2 player state from main's playerStore: fetched once on mount, then kept in
 * sync by the player:state / lyrics:doc pushes. Re-renders only when main
 * broadcasts a real change (never per frame — use usePlaybackClock for time).
 *
 * Lyrics whose trackId doesn't match the current track are dropped, so a late
 * doc from the previous song never paints over the new one.
 *
 * @returns {{ state: PlayerState|null, lyrics: LyricsDoc|null }}
 */
export function usePlayer() {
  const [state, setState] = useState(/** @type {PlayerState|null} */ (null))
  const [doc, setDoc] = useState(/** @type {LyricsDoc|null} */ (null))

  useEffect(() => {
    let alive = true
    // Pushes that arrive before the initial fetch resolves win over it.
    let gotStatePush = false
    let gotDocPush = false

    const offState = onPlayerState((s) => {
      gotStatePush = true
      setState(s)
    })
    const offDoc = onLyricsDoc((d) => {
      gotDocPush = true
      setDoc(d)
    })

    getPlayerState().then((s) => {
      if (alive && !gotStatePush) setState(s)
    })
    getLyricsDoc().then((d) => {
      if (alive && !gotDocPush) setDoc(d)
    })

    return () => {
      alive = false
      offState()
      offDoc()
    }
  }, [])

  const trackId = state?.track?.id ?? null
  const lyrics = doc && trackId && doc.trackId === trackId ? doc : null
  return { state, lyrics }
}
