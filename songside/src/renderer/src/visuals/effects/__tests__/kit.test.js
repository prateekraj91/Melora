import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SCENES,
  DEFAULT_SCENE,
  CROSSFADE_MS,
  makeRng,
  countFor,
  approach,
  lift,
  shade,
  rankBy,
  warmth,
  nextScene,
  stepWeight,
  smooth,
  beatEnvelope,
  wrap,
  rgbString
} from '../kit.js'

test('scene list and dev cycling', () => {
  assert.equal(DEFAULT_SCENE, 'chill')
  assert.equal(SCENES.length, 7)
  let s = DEFAULT_SCENE
  const seen = new Set()
  for (let i = 0; i < SCENES.length; i++) {
    seen.add(s)
    s = nextScene(s)
  }
  assert.equal(seen.size, 7)
  assert.equal(s, DEFAULT_SCENE) // wrapped around
  assert.equal(nextScene('bogus'), SCENES[0])
})

test('makeRng is deterministic and in [0,1)', () => {
  const a = makeRng(5)
  const b = makeRng(5)
  for (let i = 0; i < 1000; i++) {
    const x = a()
    assert.equal(x, b())
    assert.ok(x >= 0 && x < 1)
  }
  assert.notEqual(makeRng(1)(), makeRng(2)())
})

test('countFor maps intensity to a pool prefix', () => {
  assert.equal(countFor(0, 6, 18), 6)
  assert.equal(countFor(1, 6, 18), 18)
  assert.equal(countFor(0.5, 6, 18), 12)
  assert.equal(countFor(-1, 6, 18), 6)
  assert.equal(countFor(7, 6, 18), 18)
})

test('stepWeight: a full fade takes CROSSFADE_MS, reverses mid-way', () => {
  let w = 0
  let t = 0
  while (w < 1) {
    w = stepWeight(w, 1, 16)
    t += 16
  }
  assert.ok(Math.abs(t - CROSSFADE_MS) <= 16)
  w = stepWeight(0.5, 0, 750)
  assert.equal(w, 0)
  assert.equal(stepWeight(0.4, 1, 0), 0.4)
  assert.equal(stepWeight(1, 1, 100), 1)
})

test('smooth is a clamped smoothstep', () => {
  assert.equal(smooth(0), 0)
  assert.equal(smooth(1), 1)
  assert.equal(smooth(0.5), 0.5)
  assert.equal(smooth(-2), 0)
  assert.equal(smooth(3), 1)
  assert.ok(smooth(0.25) < 0.25)
})

test('approach is frame-rate independent', () => {
  let a = 0
  for (let i = 0; i < 10; i++) a = approach(a, 1, 0.01, 0.1)
  const b = approach(0, 1, 0.1, 0.1)
  assert.ok(Math.abs(a - b) < 1e-9)
  assert.ok(Math.abs(b - 0.5) < 1e-9)
})

test('beatEnvelope jumps on a beat and halves per half-life', () => {
  assert.equal(beatEnvelope(0.2, true, 0.016), 1)
  assert.ok(Math.abs(beatEnvelope(1, false, 0.12, 0.12) - 0.5) < 1e-9)
})

test('colour helpers', () => {
  assert.deepEqual(lift([0, 0.5, 1], 0.5), [0.5, 0.75, 1])
  assert.deepEqual(shade([0.5, 1, 0], 0.5), [0.25, 0.5, 0])
  assert.equal(rgbString([1, 0.5, 0]), 'rgb(255,128,0)')
  const p = [
    [0.2, 0.3, 0.9], // cool
    [0.9, 0.5, 0.3], // warm
    [0.6, 0.6, 0.6]
  ]
  assert.equal(rankBy(p, warmth)[0], 1)
  assert.equal(rankBy(p, warmth)[2], 0)
})

test('wrap', () => {
  assert.equal(wrap(5, 0, 10), 5)
  assert.equal(wrap(12, 0, 10), 2)
  assert.equal(wrap(-3, 0, 10), 7)
  assert.equal(wrap(3, 5, 5), 5)
})
