// Shared system-audio engine (v2 task 1.7). One capture + AudioContext for the
// whole page, reference-counted: every useAudioFrame() acquires it on mount
// and releases on unmount, so the effects layer and the pulse share a stream.
//
// - getDisplayMedia({audio:true, video:true}) → main answers with the screen
//   + 'loopback' system audio (main/audio/capture.js); the video track is
//   stopped immediately.
// - AnalyserNode fftSize 2048, smoothingTimeConstant 0.6 → analyser.js.
// - While the document is hidden (the fullscreen window is hidden, not
//   destroyed) capture is STOPPED so macOS isn't recording in the background;
//   it restarts when the page is visible again.
// - If capture needs a user gesture (Chromium's transient-activation rule) or
//   fails, the frame stays zero; a gesture-gated failure retries once on the
//   next pointer/key input.

import { createAnalyser, zeroFrame } from './analyser.js'
import { isMock } from '../dev/mockPlayer.js'
import { createMockAudio } from '../dev/mockAudio.js'

/** @typedef {import('../../../shared/types.js').AudioFrame} AudioFrame */

const ZERO = Object.freeze(zeroFrame())

let refs = 0
let frame = /** @type {AudioFrame} */ (ZERO)
let status = 'idle' // idle | starting | running | unavailable
let stream = null
let ctx = null
let node = null
let dsp = null
let bins = null
let raf = 0
let gen = 0 // bumps on every stop() so stale async starts bail out
let retryArmed = false

const log = (...a) => console.info('[audio]', ...a)

let mockSource = null

function loop() {
  raf = requestAnimationFrame(loop)
  if (mockSource) {
    frame = mockSource()
    return
  }
  if (!node) return
  node.getByteFrequencyData(bins)
  frame = dsp.process(bins, performance.now())
}

function armRetry() {
  if (retryArmed) return
  retryArmed = true
  const retry = () => {
    window.removeEventListener('pointerdown', retry, true)
    window.removeEventListener('keydown', retry, true)
    retryArmed = false
    if (refs > 0 && status !== 'running') start()
  }
  window.addEventListener('pointerdown', retry, true)
  window.addEventListener('keydown', retry, true)
}

async function start() {
  if (status === 'starting' || status === 'running') return
  // Dev browser mock: synthetic 120 bpm audio instead of capture.
  if (import.meta.env?.DEV && isMock()) {
    mockSource = createMockAudio()
    status = 'running'
    if (!raf) raf = requestAnimationFrame(loop)
    return
  }
  // Outside Electron there is no auto-answering handler in main; calling
  // getDisplayMedia would pop the browser's screen picker. Run silently.
  if (typeof window === 'undefined' || !window.api) {
    status = 'unavailable'
    log('not running in Electron — no system audio')
    return
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
    status = 'unavailable'
    log('getDisplayMedia not available — running silently')
    return
  }
  status = 'starting'
  const my = ++gen
  try {
    const s = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
    if (my !== gen) {
      s.getTracks().forEach((t) => t.stop())
      return
    }
    s.getVideoTracks().forEach((t) => t.stop())
    if (!s.getAudioTracks().length) {
      s.getTracks().forEach((t) => t.stop())
      status = 'unavailable'
      log('capture has no audio track — running silently')
      return
    }
    stream = s
    ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(s)
    node = ctx.createAnalyser()
    node.fftSize = 2048
    node.smoothingTimeConstant = 0.6
    src.connect(node) // NOT to ctx.destination — we only listen
    dsp = createAnalyser({ sampleRate: ctx.sampleRate, fftSize: node.fftSize })
    bins = new Uint8Array(node.frequencyBinCount)
    s.getAudioTracks()[0].addEventListener('ended', () => {
      log('audio track ended')
      stop()
      status = 'unavailable'
    })
    status = 'running'
    log(`running (${ctx.sampleRate} Hz)`)
    if (!raf) raf = requestAnimationFrame(loop)
  } catch (e) {
    if (my !== gen) return
    status = 'unavailable'
    log(`capture failed (${e.name}: ${e.message}) — running silently`)
    // Chromium can require a user gesture for getDisplayMedia; try again on
    // the next click / key press.
    if (e.name === 'InvalidStateError' || e.name === 'NotAllowedError') armRetry()
  }
}

function stop() {
  gen++
  cancelAnimationFrame(raf)
  raf = 0
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  try {
    ctx?.close()
  } catch {
    /* already closed */
  }
  ctx = null
  node = null
  dsp = null
  mockSource = null
  frame = ZERO
  if (status !== 'unavailable') status = 'idle'
}

function onVisibility() {
  if (refs <= 0) return
  if (document.visibilityState === 'hidden') {
    stop()
    status = 'idle'
  } else {
    start()
  }
}

/** Acquire the engine; returns a release function. */
export function acquireAudio() {
  refs++
  if (refs === 1) {
    document.addEventListener('visibilitychange', onVisibility)
    if (document.visibilityState !== 'hidden') start()
  }
  let released = false
  return () => {
    if (released) return
    released = true
    refs--
    if (refs === 0) {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
      status = 'idle'
    }
  }
}

/** Latest AudioFrame (a zero frame when not capturing). Reused object. */
export const getAudioFrame = () => frame

/** 'idle' | 'starting' | 'running' | 'unavailable' — for the debug overlay. */
export const getAudioStatus = () => status
