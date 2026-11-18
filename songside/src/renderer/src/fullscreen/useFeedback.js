import { useEffect, useRef, useState } from 'react'
import {
  SKIP_MS,
  SKIP_WAIT_MS,
  SKIP_OFFSET_VW,
  VOLUME_HOLD_MS,
  VOLUME_FADE_MS,
  LIKE_MS,
  HINT_MS,
  createSkipTracker,
  volumeLabel,
  volumeChanged,
  takeFirstRun
} from './feedback.js'

/** @typedef {import('../../../shared/types.js').PlayerCommand} PlayerCommand */

const EASE_OUT = 'cubic-bezier(.2,.7,.2,1)'
const EASE_IN = 'cubic-bezier(.4,0,.7,.4)'

// The first-run hint is decided once per page load (React StrictMode runs
// effects twice in dev, and the decision also writes localStorage).
let hintDecision = /** @type {boolean|null} */ (null)
let hintPlayed = false

function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Imperative, button-free feedback for the fullscreen view (v2 task 2.6).
 * Every effect is a Web Animation on a ref: nothing here re-renders React.
 *
 * @param {{ lyricsDocId: string|null, volume: number|null|undefined }} args
 * @returns {{
 *   refs: { lyrics: any, volumeLabel: any, volumeFlash: any, heart: any, hint: any },
 *   onCommand: (cmd: PlayerCommand) => void
 * }}
 */
export function useFeedback({ lyricsDocId, volume }) {
  const lyrics = useRef(null)
  const volumeLabelEl = useRef(null)
  const volumeFlash = useRef(null)
  const heart = useRef(null)
  const hint = useRef(null)

  const docId = useRef(lyricsDocId)
  const [tracker] = useState(createSkipTracker)
  const anim = useRef({ out: null, in: null, timer: 0 })

  // Skip: slide in once the new lyrics doc arrives (or the wait runs out).
  const [settle] = useState(() => () => {
    const el = lyrics.current
    const r = tracker.update(performance.now(), docId.current)
    if (!r || !el) return
    clearTimeout(anim.current.timer)
    anim.current.timer = setTimeout(() => {
      const from = `translateX(${-r.dir * SKIP_OFFSET_VW}vw)`
      anim.current.in?.cancel()
      anim.current.in = el.animate(
        [
          { transform: from, opacity: 0 },
          { transform: 'translateX(0)', opacity: 1 }
        ],
        { duration: SKIP_MS, easing: EASE_OUT }
      )
      anim.current.out?.cancel()
      anim.current.out = null
    }, r.delay)
  })

  useEffect(() => {
    docId.current = lyricsDocId
    settle()
  }, [lyricsDocId, settle])

  useEffect(() => {
    const a = anim.current
    return () => clearTimeout(a.timer)
  }, [])

  // Volume: brief glow flash + "vol 60" that fades after 800ms.
  const prevVolume = useRef(volume)
  useEffect(() => {
    const prev = prevVolume.current
    prevVolume.current = volume
    if (!volumeChanged(prev, volume)) return
    const label = volumeLabelEl.current
    if (label) {
      label.textContent = volumeLabel(volume)
      label.getAnimations().forEach((x) => x.cancel())
      const total = VOLUME_HOLD_MS + VOLUME_FADE_MS
      label.animate(
        [{ opacity: 0.4 }, { opacity: 0.4, offset: VOLUME_HOLD_MS / total }, { opacity: 0 }],
        { duration: total, easing: 'ease-out' }
      )
    }
    const flash = volumeFlash.current
    if (flash) {
      flash.getAnimations().forEach((x) => x.cancel())
      const peak = 0.04 + (volume / 100) * 0.06
      flash.animate([{ opacity: 0 }, { opacity: peak, offset: 0.25 }, { opacity: 0 }], {
        duration: 700,
        easing: 'ease-out'
      })
    }
  }, [volume])

  // One-time hints on the first ever fullscreen open.
  useEffect(() => {
    if (hintDecision === null) hintDecision = takeFirstRun(storage())
    const el = hint.current
    if (!hintDecision || hintPlayed || !el) return undefined
    const a = el.animate(
      [
        { opacity: 0 },
        { opacity: 0.35, offset: 0.12 },
        { opacity: 0.35, offset: 0.85 },
        { opacity: 0 }
      ],
      { duration: HINT_MS, easing: 'ease-in-out', delay: 800 }
    )
    a.onfinish = () => {
      hintPlayed = true
    }
    return () => a.cancel()
  }, [])

  const [onCommand] = useState(() => (cmd) => {
    // Skip → slide out in the swipe direction.
    const dir = tracker.skip(cmd, performance.now(), docId.current)
    const el = lyrics.current
    if (dir && el) {
      anim.current.in?.cancel()
      anim.current.out?.cancel()
      anim.current.out = el.animate(
        [
          { transform: 'translateX(0)', opacity: 1 },
          { transform: `translateX(${dir * SKIP_OFFSET_VW}vw)`, opacity: 0 }
        ],
        { duration: SKIP_MS, easing: EASE_IN, fill: 'forwards' }
      )
      clearTimeout(anim.current.timer)
      anim.current.timer = setTimeout(settle, SKIP_WAIT_MS + 20)
    }
    // Like → soft ♥ bloom in the centre.
    if (cmd?.type === 'like' && heart.current) {
      heart.current.getAnimations().forEach((x) => x.cancel())
      heart.current.animate(
        [
          { opacity: 0, transform: 'translate(-50%,-50%) scale(0.6)' },
          { opacity: 0.55, transform: 'translate(-50%,-50%) scale(1)', offset: 0.25 },
          { opacity: 0, transform: 'translate(-50%,-50%) scale(1.35)' }
        ],
        { duration: LIKE_MS, easing: 'ease-out' }
      )
    }
  })

  return {
    refs: { lyrics, volumeLabel: volumeLabelEl, volumeFlash, heart, hint },
    onCommand
  }
}
