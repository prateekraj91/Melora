import { useEffect, useRef } from 'react'
import { usePlayer } from '../hooks/usePlayer'
import { usePlaybackClock } from '../hooks/usePlaybackClock'
import { closeFullscreen } from '../bridge'
import { useIdleHide } from './useIdleHide'
import { useActiveWord, useTimedDoc } from '../lyrics/useActiveWord'

function fmt(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Placeholder fullscreen route ('#/fullscreen'). Proves the v2 data path:
// store → push → usePlayer, and the anchor clock driven by rAF with no React
// state per frame. Real UI arrives in tasks 1.4–1.7.
//
// After 3s without mouse/key/wheel input the cursor hides and the text fades
// out (600ms); any input brings both back. The text fades in (700ms) on mount.
//
// The current lyric line is drawn with the active word underlined (task 1.5).
// It is written straight to the DOM from the rAF loop — the line's word spans
// are rebuilt only when the line changes, and only the underline moves per word.
export default function Fullscreen() {
  const { state, lyrics } = usePlayer()
  const now = usePlaybackClock(state)
  const idle = useIdleHide(3000)
  const posRef = useRef(/** @type {HTMLSpanElement|null} */ (null))
  const lineRef = useRef(/** @type {HTMLDivElement|null} */ (null))
  const timed = useTimedDoc(lyrics)
  const getActive = useActiveWord(lyrics, now)

  useEffect(() => {
    let raf = 0
    let shownLine = -2 // force a first paint (line -1 = before the first line)
    let shownWord = -1
    /** @type {HTMLSpanElement[]} */
    let spans = []

    const loop = () => {
      if (posRef.current) posRef.current.textContent = fmt(now())

      const el = lineRef.current
      if (el) {
        const a = getActive()
        if (a.line !== shownLine) {
          shownLine = a.line
          shownWord = -1
          const words = a.line >= 0 ? (timed?.lines[a.line]?.words ?? []) : []
          spans = words.map((w) => {
            const span = document.createElement('span')
            span.textContent = w.text
            span.style.textUnderlineOffset = '0.25em'
            span.style.textDecorationThickness = '2px'
            return span
          })
          el.replaceChildren()
          spans.forEach((span, i) => {
            if (i) el.append(' ')
            el.append(span)
          })
        }
        if (a.word !== shownWord) {
          if (spans[shownWord]) spans[shownWord].style.textDecorationLine = 'none'
          if (spans[a.word]) spans[a.word].style.textDecorationLine = 'underline'
          shownWord = a.word
        }
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [now, getActive, timed])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const track = state?.track
  return (
    <div
      className="flex h-screen w-screen items-center justify-center bg-black text-white"
      style={{ cursor: idle ? 'none' : 'auto' }}
    >
      <div className="fullscreen-fade-in">
        <div
          className="flex flex-col items-center gap-2 transition-opacity duration-[600ms] ease-out"
          style={{ opacity: idle ? 0 : 1 }}
        >
          <div
            ref={lineRef}
            className="mb-6 min-h-[1.5em] max-w-[80vw] text-center text-4xl font-semibold leading-snug"
          />
          <div className="text-3xl font-semibold">{track?.name ?? 'Nothing playing'}</div>
          <div className="text-lg text-white/60">{track?.artist ?? ''}</div>
          <div className="font-mono text-sm text-white/50">
            <span ref={posRef}>0:00</span>
            {track ? ` / ${fmt(track.durationMs)}` : ''}
          </div>
          <div className="text-xs text-white/40">
            status: {state?.status ?? '—'} · lyrics:{' '}
            {lyrics ? `${lyrics.mode}, ${lyrics.lines.length} lines` : 'none'}
          </div>
        </div>
      </div>
    </div>
  )
}
