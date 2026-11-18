// DEV-ONLY synthetic audio for the browser mock (`?mock`, no Electron): a
// 120 bpm kick with decaying bass, a slow mid/treble swell, beats flagged on
// the kick. Lets the pulse / effects be checked without system audio.

/** @typedef {import('../../../shared/types.js').AudioFrame} AudioFrame */

const BEAT_MS = 500

/** @returns {() => AudioFrame} */
export function createMockAudio() {
  const frame = { bass: 0, mid: 0, treble: 0, energy: 0, beat: false, bpm: null }
  let lastBeatIndex = -1
  const t0 = performance.now()
  return () => {
    const t = performance.now() - t0
    const idx = Math.floor(t / BEAT_MS)
    const since = t - idx * BEAT_MS
    frame.beat = idx !== lastBeatIndex
    lastBeatIndex = idx
    frame.bass = Math.max(0.15, Math.exp(-since / 120))
    frame.mid = 0.4 + 0.25 * Math.sin(t / 2300)
    frame.treble = 0.3 + 0.2 * Math.sin(t / 1700 + 1)
    frame.energy = 0.45 + 0.3 * Math.sin(t / 4100)
    frame.bpm = idx >= 4 ? 120 : null
    return frame
  }
}
