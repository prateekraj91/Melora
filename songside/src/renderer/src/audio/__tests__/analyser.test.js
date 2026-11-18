import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createAnalyser, bpmFromIntervals, foldBpm, zeroFrame, REFRACTORY_MS } from '../analyser.js'

const SR = 48000
const FFT = 2048
const BINS = FFT / 2
const HZ = SR / FFT // 23.4 Hz per bin
const bin = (hz) => Math.round(hz / HZ)
const FRAME_MS = 1000 / 60

/** Deterministic PRNG so tests are stable. */
function rng(seed = 1) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** A spectrum with `level` (0–255) in [loHz, hiHz] and quiet noise elsewhere. */
function spectrum(bands, noise = 0, rand = rng(7)) {
  const b = new Uint8Array(BINS)
  for (let i = 0; i < BINS; i++) b[i] = Math.round(rand() * noise)
  for (const [lo, hi, level] of bands) {
    for (let i = bin(lo); i <= bin(hi); i++) b[i] = Math.max(b[i], level)
  }
  return b
}

/**
 * Simulate `seconds` of audio at 60fps with a kick (bass + low-mid burst)
 * every `beatMs`, on top of a steady pad + light noise. Returns beat times.
 */
function run(a, { seconds = 10, beatMs = 500, kick = 230, pad = 60, jitter = 0, seed = 3 } = {}) {
  const rand = rng(seed)
  const beats = []
  let nextKick = 0
  let lastFrame
  for (let t = 0; t < seconds * 1000; t += FRAME_MS) {
    if (t >= nextKick) {
      nextKick += beatMs + (jitter ? (rand() - 0.5) * jitter : 0)
    }
    // Kick envelope: full on the first frame, decaying over ~100ms.
    const env = Math.max(0, 1 - Math.max(0, t - (nextKick - beatMs)) / 100)
    const level = kick ? Math.round(kick * env) : 0
    const bins = spectrum(
      [
        [40, 120, Math.max(pad, level)],
        [150, 400, Math.max(pad * 0.8, level * 0.6)],
        [500, 3000, pad * 0.7]
      ],
      12,
      rand
    )
    lastFrame = a.process(bins, t)
    if (lastFrame.beat) beats.push(t)
  }
  return { beats, frame: lastFrame }
}

describe('band levels', () => {
  test('bass-only input → bass high, treble ~0', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    let f
    for (let i = 0; i < 30; i++) f = a.process(spectrum([[30, 140, 200]]), i * FRAME_MS)
    assert.ok(f.bass > 0.9, `bass ${f.bass}`)
    assert.ok(f.treble < 0.05, `treble ${f.treble}`)
    assert.ok(f.mid < 0.3, `mid ${f.mid}`)
  })

  test('treble-only input → treble high, bass ~0', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    let f
    for (let i = 0; i < 30; i++) f = a.process(spectrum([[3000, 11000, 180]]), i * FRAME_MS)
    assert.ok(f.treble > 0.9)
    assert.ok(f.bass < 0.05)
  })

  test('silence → zero levels, no beat, bpm null', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    let f
    for (let i = 0; i < 120; i++) f = a.process(new Uint8Array(BINS), i * FRAME_MS)
    assert.deepEqual({ ...f }, zeroFrame())
  })
})

describe('auto-gain', () => {
  test('a quiet steady signal is normalised up towards 1', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    let f
    for (let i = 0; i < 60; i++) f = a.process(spectrum([[30, 140, 40]]), i * FRAME_MS)
    assert.ok(f.bass > 0.95, `quiet bass normalised: ${f.bass}`)
  })

  test('after a loud burst, a quieter level reads low, then recovers as the peak decays', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    let t = 0
    for (let i = 0; i < 10; i++, t += FRAME_MS) a.process(spectrum([[30, 140, 250]]), t)
    const right = a.process(spectrum([[30, 140, 60]]), (t += FRAME_MS))
    assert.ok(right.bass < 0.35, `just after burst: ${right.bass}`)
    let later
    for (let i = 0; i < 60 * 12; i++, t += FRAME_MS) later = a.process(spectrum([[30, 140, 60]]), t)
    assert.ok(later.bass > 0.9, `12s later: ${later.bass}`)
  })
})

describe('beat detection', () => {
  test('120 bpm kicks → about one beat per kick and bpm ≈ 120', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    const { beats, frame } = run(a, { seconds: 10, beatMs: 500 })
    assert.ok(beats.length >= 17 && beats.length <= 21, `beats: ${beats.length}`)
    assert.ok(Math.abs(frame.bpm - 120) < 3, `bpm ${frame.bpm}`)
  })

  test('90 bpm kicks → bpm ≈ 90', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    const { frame } = run(a, { seconds: 12, beatMs: 60000 / 90 })
    assert.ok(Math.abs(frame.bpm - 90) < 3, `bpm ${frame.bpm}`)
  })

  test('beats are never closer than the 280ms refractory period', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    const { beats } = run(a, { seconds: 6, beatMs: 150 })
    assert.ok(beats.length > 0)
    for (let i = 1; i < beats.length; i++) {
      assert.ok(beats[i] - beats[i - 1] >= REFRACTORY_MS - 1e-6, `gap ${beats[i] - beats[i - 1]}`)
    }
  })

  test('a steady pad with noise and no kicks produces (almost) no beats', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    const { beats, frame } = run(a, { seconds: 8, kick: 0 })
    assert.ok(beats.length <= 2, `false beats: ${beats.length}`)
    assert.equal(frame.bpm, null)
  })

  test('bpm stays null until enough beats', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    const { beats, frame } = run(a, { seconds: 1.2, beatMs: 500 })
    assert.ok(beats.length <= 3)
    assert.equal(frame.bpm, null)
  })

  test('reset() clears state', () => {
    const a = createAnalyser({ sampleRate: SR, fftSize: FFT })
    run(a, { seconds: 5 })
    a.reset()
    const f = a.process(new Uint8Array(BINS), 0)
    assert.deepEqual({ ...f }, zeroFrame())
  })
})

describe('bpm helpers', () => {
  test('median of consistent intervals', () => {
    assert.equal(bpmFromIntervals([500, 500, 510, 490, 500]), 120)
  })
  test('null for too few or inconsistent intervals', () => {
    assert.equal(bpmFromIntervals([500, 500, 500]), null)
    assert.equal(bpmFromIntervals([300, 900, 450, 1200, 600, 350]), null)
  })
  test('folds into 70–180', () => {
    assert.equal(foldBpm(60), 120)
    assert.equal(foldBpm(240), 120)
    assert.equal(foldBpm(100), 100)
    assert.equal(foldBpm(0), null)
  })
})
