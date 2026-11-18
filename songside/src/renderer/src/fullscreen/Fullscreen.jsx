import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../hooks/usePlayer'
import { usePlaybackClock } from '../hooks/usePlaybackClock'
import { closeFullscreen, runCommand } from '../bridge'
import { useKeyboardControls } from '../input/keys'
import { useIdleHide } from './useIdleHide'
import { useActiveWord, useTimedDoc } from '../lyrics/useActiveWord'
import FadedLyrics from '../lyrics/FadedLyrics'
import DreamyBackground from '../visuals/background/DreamyBackground'
import { useAudioFrame } from '../audio/useAudioFrame'
import AudioDebug from '../audio/AudioDebug'
import { stepPulse, glowOpacity } from '../audio/pulse'

const DEV = import.meta.env.DEV

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
  const getAudio = useAudioFrame()
  const [debug, setDebug] = useState(false)

  // Pulse (task 1.8): one rAF loop smooths bass/energy/beats into a 0–1 value
  // that drives the background. Kept in a ref — never React state.
  const pulse = useRef(0)
  const [pulseEnergy] = useState(() => () => pulse.current)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      pulse.current = stepPulse(pulse.current, getAudio())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [getAudio])

  // Space / arrows / L / Esc (input/keys.js).
  useKeyboardControls({ onCommand: (cmd) => runCommand(cmd), onClose: closeFullscreen })

  useEffect(() => {
    const onKey = (e) => {
      // Dev only: D toggles the audio debug overlay.
      if (DEV && (e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey) {
        setDebug((v) => !v)
      }
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
        <DreamyBackground palette={state?.palette} energy={pulseEnergy} />

        {/* volume glow: brighter centre at higher volume */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 60%)',
            opacity: glowOpacity(state?.volume),
            transition: 'opacity 400ms ease-out'
          }}
        />

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

      {DEV && debug && <AudioDebug getFrame={getAudio} />}
    </div>
  )
}
