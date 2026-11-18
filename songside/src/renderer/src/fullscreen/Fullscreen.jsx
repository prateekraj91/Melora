import { useEffect, useState } from 'react'
import { usePlayer } from '../hooks/usePlayer'
import { usePlaybackClock } from '../hooks/usePlaybackClock'
import { closeFullscreen } from '../bridge'
import { useIdleHide } from './useIdleHide'
import { useActiveWord, useTimedDoc } from '../lyrics/useActiveWord'
import FadedLyrics from '../lyrics/FadedLyrics'
import DreamyBackground from '../visuals/background/DreamyBackground'

const zeroEnergy = () => 0

// The 700ms fade-in plays once per page load. The window is hidden/shown (not
// reloaded) on reopen, and this flag also stops a remount from replaying it.
let fadedIn = false

// Fullscreen listening mode ('#/fullscreen').
//
// Layers, back to front (ARCHITECTURE.md): background → effects → lyrics →
// chrome. Lyrics stay visible while idle; after 3s without input the cursor
// hides and the chrome (track info) fades out (600ms).
export default function Fullscreen() {
  const { state, lyrics } = usePlayer()
  const now = usePlaybackClock(state)
  const idle = useIdleHide(3000)
  const [fadeIn] = useState(() => !fadedIn)
  useEffect(() => {
    fadedIn = true
  }, [])
  const timed = useTimedDoc(lyrics)
  const getActive = useActiveWord(lyrics, now)

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
      className="relative h-screen w-screen overflow-hidden bg-black text-white"
      style={{ cursor: idle ? 'none' : 'auto' }}
    >
      <div className={`absolute inset-0 ${fadeIn ? 'fullscreen-fade-in' : ''}`}>
        {/* background */}
        <DreamyBackground palette={state?.palette} energy={zeroEnergy} />

        {/* lyrics */}
        <FadedLyrics doc={timed} getActive={getActive} />

        {/* chrome */}
        <div
          className="pointer-events-none absolute bottom-[4vh] left-[4vw] max-w-[40vw] transition-opacity duration-[600ms] ease-out"
          style={{ opacity: idle ? 0 : 0.35 }}
        >
          <div className="truncate text-[15px] font-medium">{track?.name ?? 'Nothing playing'}</div>
          <div className="truncate text-[13px] text-white/70">{track?.artist ?? ''}</div>
        </div>
      </div>
    </div>
  )
}
