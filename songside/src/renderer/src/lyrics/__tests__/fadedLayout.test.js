import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  slotCentres,
  slotTransform,
  wordLook,
  fillGradient,
  NEIGHBOUR_SCALE,
  DRIFT_PX,
  SLOT_STYLE,
  SUNG_OPACITY,
  UNSUNG_OPACITY
} from '../fadedLayout.js'

describe('slotCentres', () => {
  const s = NEIGHBOUR_SCALE
  test('active line is centred; neighbours stack outward with the gap', () => {
    const c = slotCentres({ [-1]: 60, 0: 60, 1: 60, 2: 60 }, 10)
    assert.equal(c[0], 0)
    assert.equal(c[-1], -(30 + 10 + (60 * s) / 2))
    assert.equal(c[1], 30 + 10 + (60 * s) / 2)
    assert.equal(c[2], c[1] + 60 * s + 10)
  })

  test('above / below are symmetric for equal heights', () => {
    const c = slotCentres({ [-1]: 50, 0: 80, 1: 50 }, 12)
    assert.ok(Math.abs(c[-1] + c[1]) < 1e-9)
  })

  test('a two-line (taller) active line pushes neighbours further out', () => {
    const one = slotCentres({ 0: 60, 1: 60 }, 10)
    const two = slotCentres({ 0: 120, 1: 60 }, 10)
    assert.equal(two[1] - one[1], 30)
  })

  test('leaving / entering lines sit DRIFT_PX beyond their neighbours', () => {
    const c = slotCentres({ [-2]: 0, [-1]: 0, 0: 0, 1: 0, 2: 0, 3: 0 }, 0)
    assert.equal(c[-2], -DRIFT_PX)
    assert.equal(c[3], DRIFT_PX)
  })

  test('intro (no active line) keeps the next lines near the centre', () => {
    const c = slotCentres({ 1: 60, 2: 60 }, 10)
    assert.equal(c[1], 10 + (60 * s) / 2)
  })
})

describe('slot styles', () => {
  test('neighbour opacities and blur follow the spec', () => {
    assert.deepEqual(SLOT_STYLE[-1], { scale: NEIGHBOUR_SCALE, opacity: 0.1, blur: 1.5 })
    assert.deepEqual(SLOT_STYLE[1], { scale: NEIGHBOUR_SCALE, opacity: 0.1, blur: 1.5 })
    assert.deepEqual(SLOT_STYLE[2], { scale: NEIGHBOUR_SCALE, opacity: 0.06, blur: 2.5 })
    assert.equal(SLOT_STYLE[0].scale, 1)
    assert.equal(SLOT_STYLE[-2].opacity, 0)
    assert.equal(SLOT_STYLE[3].opacity, 0)
  })

  test('slotTransform puts the visual centre at the given offset', () => {
    assert.equal(slotTransform(0, 100, 1), 'translateY(-50.0px) scale(1.0000)')
    assert.equal(slotTransform(80, 40, 0.5), 'translateY(60.0px) scale(0.5000)')
  })
})

describe('wordLook', () => {
  test('before the first word everything is unsung', () => {
    assert.deepEqual(wordLook(0, -1, 0), { kind: 'unsung', opacity: UNSUNG_OPACITY, fill: 0 })
  })
  test('sung / current / unsung around the active word', () => {
    assert.equal(wordLook(0, 2, 0.5).kind, 'sung')
    assert.equal(wordLook(0, 2, 0.5).opacity, SUNG_OPACITY)
    assert.deepEqual(wordLook(2, 2, 0.5), { kind: 'current', opacity: 1, fill: 0.5 })
    assert.equal(wordLook(3, 2, 0.5).kind, 'unsung')
  })
  test('a fully sung current word renders as sung (keeps the glow)', () => {
    assert.equal(wordLook(2, 2, 1).kind, 'sung')
  })
})

describe('fillGradient', () => {
  test('hard stop at the fill percentage', () => {
    const g = fillGradient(0.25)
    assert.match(g, /25\.0%, rgba\(255,255,255,0\.18\) 25\.0%/)
  })
})
