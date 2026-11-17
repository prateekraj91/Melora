import { useEffect, useRef } from 'react'
import { usePlayer } from '../hooks/usePlayer'
import { usePlaybackClock } from '../hooks/usePlaybackClock'
import { closeFullscreen } from '../bridge'

function fmt(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Placeholder fullscreen route ('#/fullscreen'). Proves the v2 data path:
// store → push → usePlayer, and the anchor clock driven by rAF with no React
// state per frame. Real UI arrives in tasks 1.3–1.7.
export default function Fullscreen() {
  const { state, lyrics } = usePlayer()
  const now = usePlaybackClock(state)
  const posRef = useRef(/** @type {HTMLSpanElement|null} */ (null))

  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (posRef.current) posRef.current.textContent = fmt(now())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [now])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const track = state?.track
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-black text-white">
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
  )
}
