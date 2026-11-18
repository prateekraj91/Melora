import '@fontsource/inter/200.css'
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  SLOTS,
  SLOT_STYLE,
  SUNG_GLOW,
  slotCentres,
  slotTransform,
  wordLook,
  fillGradient
} from './fadedLayout.js'

/** @typedef {import('../../../shared/types.js').LyricsDoc} LyricsDoc */
/** @typedef {import('./activeWord.js').ActiveWord} ActiveWord */

const EASE = 'cubic-bezier(.2,.7,.2,1)'
const TRANSITION = `transform 500ms ${EASE}, opacity 500ms ${EASE}, filter 500ms ${EASE}`
const GAP_VW = 1.1

const lineBase = {
  position: 'absolute',
  top: '50%',
  left: '10vw',
  width: '80vw',
  textAlign: 'center',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  fontWeight: 200,
  fontSize: '4.2vw',
  lineHeight: 1.25,
  color: '#fff',
  transformOrigin: 'center center',
  willChange: 'transform, opacity, filter',
  // Long lines wrap to at most 2 lines.
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
  transition: TRANSITION
}

/**
 * Karaoke-style lyrics (v2 task 1.6): the active line centred, one line above,
 * two below, all fading/blurring with distance. React re-renders ONLY when the
 * active line index changes; per-word fill/opacity is written to refs by one
 * requestAnimationFrame loop.
 *
 * @param {{ doc: LyricsDoc|null, getActive: () => ActiveWord }} props
 *   doc must be word-timed (useTimedDoc); getActive from useActiveWord.
 */
export default function FadedLyrics({ doc, getActive }) {
  const synced = doc?.mode === 'synced' && doc.lines.length > 0
  const [line, setLine] = useState(-1)

  /** index → line element */
  const lineEls = useRef(new Map())
  /** `${line}:${word}` → word span */
  const wordEls = useRef(new Map())

  const lineRef = useCallback(
    (i) => (el) => {
      if (el) lineEls.current.set(i, el)
      else lineEls.current.delete(i)
    },
    []
  )
  const wordRef = useCallback(
    (i, w) => (el) => {
      const key = `${i}:${w}`
      if (el) wordEls.current.set(key, el)
      else wordEls.current.delete(key)
    },
    []
  )

  // Place every rendered line in its slot. Runs on line change / new doc and
  // on resize (heights depend on wrapping).
  const place = useCallback(() => {
    const heights = {}
    for (const d of SLOTS) {
      const el = lineEls.current.get(line + d)
      if (el) heights[d] = el.offsetHeight
    }
    const gap = (window.innerWidth * GAP_VW) / 100
    const centres = slotCentres(heights, gap)
    for (const d of SLOTS) {
      const el = lineEls.current.get(line + d)
      if (!el) continue
      const s = SLOT_STYLE[d]
      const fresh = !el.dataset.placed
      // A newly mounted line jumps straight to its slot (no transition from
      // the default position); after that every slot change animates.
      if (fresh) el.style.transition = 'none'
      el.style.transform = slotTransform(centres[d], heights[d] || 0, s.scale)
      el.style.opacity = String(s.opacity)
      el.style.filter = s.blur ? `blur(${s.blur}px)` : 'none'
      if (fresh) {
        void el.offsetHeight
        el.style.transition = TRANSITION
        el.dataset.placed = '1'
      }
    }
  }, [line])

  useLayoutEffect(() => {
    if (synced) place()
  }, [synced, place, doc])

  useEffect(() => {
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [place])

  // One rAF loop: follow the active line (→ React state only on change) and
  // paint the active line's words.
  useEffect(() => {
    if (!synced) return undefined
    let raf = 0
    let painted = -2 // line whose word spans currently carry inline styles

    const clearWords = (i) => {
      for (let w = 0; ; w++) {
        const el = wordEls.current.get(`${i}:${w}`)
        if (!el) break
        el.style.cssText = ''
      }
    }

    const loop = () => {
      const a = getActive()
      if (a.line !== painted) {
        if (painted >= 0) clearWords(painted)
        painted = a.line
        setLine(a.line)
      }
      if (a.line >= 0) {
        const n = doc.lines[a.line]?.words?.length ?? 0
        for (let w = 0; w < n; w++) {
          const el = wordEls.current.get(`${a.line}:${w}`)
          if (!el) continue
          const look = wordLook(w, a.word, a.wordProgress)
          const st = el.style
          if (look.kind === 'current') {
            st.opacity = '1'
            st.textShadow = 'none'
            st.backgroundImage = fillGradient(look.fill)
            st.webkitBackgroundClip = 'text'
            st.backgroundClip = 'text'
            st.color = 'transparent'
          } else {
            st.opacity = String(look.opacity)
            st.textShadow = look.kind === 'sung' ? SUNG_GLOW : 'none'
            st.backgroundImage = 'none'
            st.color = '#fff'
          }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [synced, doc, getActive])

  if (!synced) return null

  const items = []
  for (const d of SLOTS) {
    const i = line + d
    const l = doc.lines[i]
    if (!l) continue
    const words = l.words ?? []
    items.push(
      <div key={`${doc.trackId}:${i}`} ref={lineRef(i)} style={lineBase}>
        {words.length
          ? words.map((w, wi) => (
              <Fragment key={wi}>
                {wi ? ' ' : ''}
                <span ref={wordRef(i, wi)}>{w.text}</span>
              </Fragment>
            ))
          : ' '}
      </div>
    )
  }

  return (
    <div
      aria-live="off"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {items}
    </div>
  )
}
