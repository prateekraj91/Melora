import { useEffect, useRef } from 'react'
import { getAudioStatus } from './audioEngine.js'

const BARS = ['bass', 'mid', 'treble', 'energy']

/**
 * DEV-only audio debug overlay (toggled with D in the fullscreen window):
 * band bars, bpm, capture status and a flash on every beat. Written from a
 * rAF loop straight into refs.
 *
 * @param {{ getFrame: () => import('../../../shared/types.js').AudioFrame }} props
 */
export default function AudioDebug({ getFrame }) {
  const bars = useRef({})
  const flash = useRef(null)
  const text = useRef(null)

  useEffect(() => {
    let raf = 0
    let flashUntil = 0
    const loop = (now) => {
      const f = getFrame()
      for (const k of BARS) {
        const el = bars.current[k]
        if (el) el.style.transform = `scaleX(${f[k].toFixed(3)})`
      }
      if (f.beat) flashUntil = now + 90
      if (flash.current) flash.current.style.opacity = now < flashUntil ? '1' : '0.08'
      if (text.current) text.current.textContent = `${getAudioStatus()} · bpm ${f.bpm ?? '—'}`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [getFrame])

  return (
    <div className="pointer-events-none absolute right-4 top-4 w-56 rounded-lg bg-black/60 p-3 font-mono text-[11px] text-white/80">
      <div className="mb-2 flex items-center justify-between">
        <span ref={text}>…</span>
        <span ref={flash} className="h-3 w-3 rounded-full bg-white" style={{ opacity: 0.08 }} />
      </div>
      {BARS.map((k) => (
        <div key={k} className="mb-1 flex items-center gap-2">
          <span className="w-12">{k}</span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-white/10">
            <div
              ref={(el) => {
                bars.current[k] = el
              }}
              className="h-full origin-left bg-white/70"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
