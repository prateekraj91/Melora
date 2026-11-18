// Pure audio analysis for the v2 visuals (task 1.7). Takes byte frequency
// data (AnalyserNode.getByteFrequencyData, 0–255 per bin) and produces an
// AudioFrame. No Web Audio / DOM here — unit-tested on synthetic arrays.
//
//   bands   bass 20–150 Hz, mid 150–2000 Hz, treble 2–12 kHz (mean of bins)
//   gain    per-band auto-gain: level / slowly-decaying peak, so quiet and
//           loud masters both use the full 0–1 range
//   beats   spectral flux (sum of positive bin increases, ≤ 4 kHz) against an
//           adaptive threshold mean + k·std over the last ~1s, with a 280ms
//           refractory period
//   bpm     median inter-beat interval, folded into 70–180, null until there
//           are enough consistent intervals
//
// Allocation-free per frame: all buffers are preallocated and the returned
// frame object is reused (copy it if you need to keep it).

/** @typedef {import('../../../shared/types.js').AudioFrame} AudioFrame */

export const BANDS = {
  bass: [20, 150],
  mid: [150, 2000],
  treble: [2000, 12000]
}
const FLUX_MAX_HZ = 4000
export const BEAT_WINDOW_MS = 1000
export const REFRACTORY_MS = 280
export const THRESHOLD_K = 1.5
const MIN_FLUX = 0.02 // per-bin-normalised flux below this is silence/noise
const PEAK_HALF_LIFE_MS = 4000
const PEAK_FLOOR = 0.04
const MAX_HISTORY = 128 // flux samples kept (≥ 1s at 120fps)
const MAX_INTERVALS = 16
const MIN_INTERVALS = 4
const MAX_SPREAD = 0.2 // (p75 - p25) / median of intervals must be below this

/** @returns {AudioFrame} */
export const zeroFrame = () => ({ bass: 0, mid: 0, treble: 0, energy: 0, beat: false, bpm: null })

/** Fold a tempo into [70, 180). */
export function foldBpm(bpm) {
  if (!(bpm > 0)) return null
  let b = bpm
  while (b < 70) b *= 2
  while (b >= 180) b /= 2
  return b
}

/**
 * BPM from beat intervals (ms). Null until there are MIN_INTERVALS intervals
 * that agree (interquartile spread / median < MAX_SPREAD).
 * @param {number[]} intervals
 * @returns {number|null}
 */
export function bpmFromIntervals(intervals) {
  if (intervals.length < MIN_INTERVALS) return null
  const s = [...intervals].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]
  const median = q(0.5)
  if (!(median > 0)) return null
  if ((q(0.75) - q(0.25)) / median > MAX_SPREAD) return null
  return Math.round(foldBpm(60000 / median) * 10) / 10
}

/**
 * @param {{ sampleRate: number, fftSize: number }} opts
 */
export function createAnalyser({ sampleRate, fftSize }) {
  const binCount = fftSize / 2
  const hzPerBin = sampleRate / fftSize
  const binOf = (hz) => Math.max(0, Math.min(binCount - 1, Math.round(hz / hzPerBin)))
  const ranges = {
    bass: [binOf(BANDS.bass[0]), binOf(BANDS.bass[1])],
    mid: [binOf(BANDS.mid[0]) + 1, binOf(BANDS.mid[1])],
    treble: [binOf(BANDS.treble[0]) + 1, binOf(BANDS.treble[1])]
  }
  const fluxEnd = binOf(FLUX_MAX_HZ)
  const allStart = ranges.bass[0]
  const allEnd = ranges.treble[1]

  const prev = new Float32Array(binCount)
  let hasPrev = false
  const peaks = { bass: PEAK_FLOOR, mid: PEAK_FLOOR, treble: PEAK_FLOOR, energy: PEAK_FLOOR }
  const fluxVals = new Float32Array(MAX_HISTORY)
  const fluxTimes = new Float64Array(MAX_HISTORY)
  let fluxHead = 0
  let fluxCount = 0
  let lastBeat = -Infinity
  const intervals = []
  let lastT = null
  const frame = zeroFrame()

  const mean = (bins, [a, b]) => {
    let sum = 0
    for (let i = a; i <= b; i++) sum += bins[i]
    return b >= a ? sum / (b - a + 1) / 255 : 0
  }

  const gain = (key, level, decay) => {
    peaks[key] = Math.max(level, peaks[key] * decay, PEAK_FLOOR)
    return Math.min(1, level / peaks[key])
  }

  return {
    /** Current per-band peaks (for tests / debugging). */
    peaks,
    reset() {
      hasPrev = false
      fluxHead = fluxCount = 0
      lastBeat = -Infinity
      intervals.length = 0
      lastT = null
      Object.keys(peaks).forEach((k) => (peaks[k] = PEAK_FLOOR))
      Object.assign(frame, zeroFrame())
    },
    /**
     * @param {Uint8Array|number[]} bins  byte frequency data, length fftSize/2
     * @param {number} t                  timestamp, ms
     * @returns {AudioFrame}              (reused object)
     */
    process(bins, t) {
      const dt = lastT === null ? 16 : Math.max(0, t - lastT)
      lastT = t
      const decay = Math.pow(0.5, dt / PEAK_HALF_LIFE_MS)

      frame.bass = gain('bass', mean(bins, ranges.bass), decay)
      frame.mid = gain('mid', mean(bins, ranges.mid), decay)
      frame.treble = gain('treble', mean(bins, ranges.treble), decay)
      frame.energy = gain('energy', mean(bins, [allStart, allEnd]), decay)

      // Spectral flux over the low/mid spectrum (where kicks & snares live).
      let flux = 0
      for (let i = 0; i <= fluxEnd; i++) {
        const v = bins[i] / 255
        if (hasPrev) {
          const d = v - prev[i]
          if (d > 0) flux += d
        }
        prev[i] = v
      }
      flux /= fluxEnd + 1
      const firstFrame = !hasPrev
      hasPrev = true

      // Adaptive threshold from the last ~1s of flux (before adding this one).
      let n = 0
      let sum = 0
      let sumSq = 0
      for (let k = 0; k < fluxCount; k++) {
        const idx = (fluxHead - 1 - k + MAX_HISTORY) % MAX_HISTORY
        if (t - fluxTimes[idx] > BEAT_WINDOW_MS) break
        const v = fluxVals[idx]
        n++
        sum += v
        sumSq += v * v
      }
      const m = n ? sum / n : 0
      const std = n ? Math.sqrt(Math.max(0, sumSq / n - m * m)) : 0
      const threshold = m + THRESHOLD_K * std

      frame.beat =
        !firstFrame &&
        n >= 8 &&
        flux > MIN_FLUX &&
        flux > threshold &&
        t - lastBeat >= REFRACTORY_MS

      if (frame.beat) {
        if (lastBeat > -Infinity) {
          const iv = t - lastBeat
          // Ignore pauses (> 2s) — they're gaps, not tempo.
          if (iv <= 2000) {
            intervals.push(iv)
            if (intervals.length > MAX_INTERVALS) intervals.shift()
          }
        }
        lastBeat = t
        frame.bpm = bpmFromIntervals(intervals)
      }

      fluxVals[fluxHead] = flux
      fluxTimes[fluxHead] = t
      fluxHead = (fluxHead + 1) % MAX_HISTORY
      fluxCount = Math.min(MAX_HISTORY, fluxCount + 1)
      return frame
    }
  }
}
