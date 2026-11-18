import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepPulse, glowOpacity } from '../pulse.js'

const f = (bass, energy, beat = false) => ({ bass, energy, beat })

test('converges to 0.35·bass + 0.15·energy', () => {
  let p = 0
  for (let i = 0; i < 200; i++) p = stepPulse(p, f(1, 1))
  assert.ok(Math.abs(p - 0.5) < 1e-6)
})

test('moves 12% of the way per frame', () => {
  assert.ok(Math.abs(stepPulse(0, f(1, 0)) - 0.35 * 0.12) < 1e-9)
})

test('a beat kicks +0.25 before smoothing, capped at 1', () => {
  const p = stepPulse(0.1, f(0, 0, true))
  assert.ok(Math.abs(p - (0.35 + (0 - 0.35) * 0.12)) < 1e-9)
  assert.ok(stepPulse(0.95, f(1, 1, true)) <= 1)
})

test('silence decays to 0', () => {
  let p = 1
  for (let i = 0; i < 300; i++) p = stepPulse(p, f(0, 0))
  assert.ok(p < 1e-6)
})

test('glow opacity from volume', () => {
  assert.equal(glowOpacity(0), 0.02)
  assert.ok(Math.abs(glowOpacity(100) - 0.08) < 1e-12)
  assert.ok(Math.abs(glowOpacity(50) - 0.05) < 1e-12)
  assert.ok(Math.abs(glowOpacity(null) - 0.05) < 1e-12)
  assert.ok(Math.abs(glowOpacity(150) - 0.08) < 1e-12)
})
