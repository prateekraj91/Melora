import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlayer } from '../hooks/usePlayer'
import { usePlaybackClock } from '../hooks/usePlaybackClock'
import { closeFullscreen, runCommand } from '../bridge'
import { useKeyboardControls } from '../input/keys'
import { useGestures } from '../input/gestures'
import { useIdleHide } from './useIdleHide'
import { useActiveWord, useTimedDoc } from '../lyrics/useActiveWord'
import FadedLyrics from '../lyrics/FadedLyrics'
import DreamyBackground from '../visuals/background/DreamyBackground'
import EffectStack from '../visuals/effects/EffectStack'
import { DEFAULT_SCENE, nextScene } from '../visuals/effects/kit'
import { useAudioFrame } from '../audio/useAudioFrame'
import AudioDebug from '../audio/AudioDebug'
import { stepPulse, glowOpacity } from '../audio/pulse'
import { normalisePalette, rgbCss } from '../visuals/palette'
import { useFeedback } from './useFeedback'
import { HINT_TEXT, isPausedLook, bloomColour } from './feedback'

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
  // Scene source for now: default 'chill', dev builds cycle with S (task 3.3).
  // The AI scene choice (task 3.2) will replace this.
  const [scene, setScene] = useState(DEFAULT_SCENE)
  const sceneLabelRef = useRef(null)
  const sceneShown = useRef(scene)
  useEffect(() => {
    const el = sceneLabelRef.current
    if (sceneShown.current === scene || !el) return
    sceneShown.current = scene
    el.textContent = scene
    el.getAnimations().forEach((a) => a.cancel())
    el.animate([{ opacity: 0.4 }, { opacity: 0.4, offset: 0.7 }, { opacity: 0 }], {
      duration: 1000,
      easing: 'ease-out'
    })
  }, [scene])

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

  // Feedback without buttons (task 2.6): skip slide, volume label, like bloom,
  // first-run hint. Every command goes through it on the way to the player.
  const {
    refs: {
      lyrics: lyricsRef,
      volumeLabel: volumeLabelRef,
      volumeFlash: volumeFlashRef,
      heart: heartRef,
      hint: hintRef
    },
    onCommand: feedback
  } = useFeedback({ lyricsDocId: lyrics?.trackId ?? null, volume: state?.volume })
  const send = (cmd) => {
    feedback(cmd)
    runCommand(cmd)
  }
  // Space / arrows / L / Esc (input/keys.js).
  useKeyboardControls({ onCommand: send, onClose: closeFullscreen })
  // Swipe ←/→ skip, swipe ↑/↓ volume, click pause, hold like (input/gestures.js).
  useGestures(send)

  const palette = state?.palette
  const bloom = useMemo(() => rgbCss(bloomColour(normalisePalette(palette))), [palette])
  const paused = isPausedLook(state?.status)

  useEffect(() => {
    const onKey = (e) => {
      // Dev only: D toggles the audio debug overlay.
      if (DEV && (e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey) {
        setDebug((v) => !v)
      }
      // Dev only: S cycles the effect scene.
      if (DEV && (e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey && !e.repeat) {
        setScene((s) => nextScene(s))
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
      <div
        className={`absolute inset-0 ${fadeIn ? 'fullscreen-fade-in' : ''}`}
        style={{
          // Paused: the whole scene softly blurs and desaturates.
          filter: paused ? 'blur(6px) saturate(0.7)' : 'blur(0px) saturate(1)',
          transition: 'filter 500ms ease-out'
        }}
      >
        {/* background */}
        <DreamyBackground palette={state?.palette} energy={pulseEnergy} />

        {/* effects */}
        <EffectStack scene={scene} palette={state?.palette} getAudio={getAudio} />

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

        {/* volume change: brief flash of the glow, palette-tinted */}
        <div
          ref={volumeFlashRef}
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${bloom} 0%, rgba(0,0,0,0) 65%)`,
            opacity: 0
          }}
        />

        {/* lyrics (slides sideways on skip) */}
        <div ref={lyricsRef} className="pointer-events-none absolute inset-0">
          <FadedLyrics doc={timed} getActive={getActive} />
        </div>

        {/* chrome */}
        <div
          className="pointer-events-none absolute bottom-[4vh] left-[4vw] max-w-[40vw] transition-opacity duration-[600ms] ease-out"
          style={{ opacity: idle ? 0 : 0.35 }}
        >
          <div className="truncate text-[15px] font-medium">{track?.name ?? 'Nothing playing'}</div>
          <div className="truncate text-[13px] text-white/70">{track?.artist ?? ''}</div>
        </div>
      </div>

      {/* feedback layer (outside the blur) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[56%] text-center text-[13px] font-light tracking-[0.3em] text-white transition-opacity duration-500 ease-out"
        style={{ opacity: paused ? 0.32 : 0 }}
      >
        paused
      </div>
      <div
        ref={heartRef}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 text-[22vh] leading-none select-none"
        style={{ color: bloom, opacity: 0, filter: 'blur(1px)', textShadow: `0 0 40px ${bloom}` }}
      >
        ♥
      </div>
      <div
        ref={volumeLabelRef}
        className="pointer-events-none absolute inset-x-0 bottom-[10vh] text-center text-[12px] font-light tracking-[0.2em] text-white"
        style={{ opacity: 0 }}
      />
      <div
        ref={hintRef}
        className="pointer-events-none absolute inset-x-0 bottom-[3.5vh] text-center text-[12px] font-light tracking-[0.12em] text-white"
        style={{ opacity: 0 }}
      >
        {HINT_TEXT}
      </div>

      {DEV && (
        <div
          ref={sceneLabelRef}
          className="pointer-events-none absolute top-[4vh] right-[4vw] text-[12px] font-light tracking-[0.2em] text-white"
          style={{ opacity: 0 }}
        />
      )}
      {DEV && debug && <AudioDebug getFrame={getAudio} />}
    </div>
  )
}
