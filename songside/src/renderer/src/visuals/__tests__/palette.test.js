import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseColor,
  normalisePalette,
  mixPalettes,
  easeInOut,
  rgbCss,
  NEUTRAL,
  PALETTE_SIZE
} from '../palette.js'

const close = (a, b, eps = 1e-3) =>
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= eps, `${a} ≈ ${b}`))

describe('parseColor', () => {
  test('hex', () => {
    close(parseColor('#ff8000'), [1, 128 / 255, 0])
    close(parseColor('#fff'), [1, 1, 1])
    close(parseColor('  #A9D3EC '), [169 / 255, 211 / 255, 236 / 255])
  })
  test('rgb() / rgba()', () => {
    close(parseColor('rgb(255, 0, 0)'), [1, 0, 0])
    close(parseColor('rgba(0 255 0 / 0.5)'), [0, 1, 0])
    close(parseColor('rgb(100% 50% 0%)'), [1, 0.5, 0])
  })
  test('hsl() — the v1 dominant colour format', () => {
    close(parseColor('hsl(0 100% 50%)'), [1, 0, 0])
    close(parseColor('hsl(120, 100%, 50%)'), [0, 1, 0])
    close(parseColor('hsl(141 73% 42%)'), [0.1134, 0.7266, 0.328], 0.01)
    close(parseColor('hsl(-120 100% 50%)'), [0, 0, 1])
  })
  test('garbage → null', () => {
    assert.equal(parseColor('oklch(0.8 0.1 20)'), null)
    assert.equal(parseColor('#12'), null)
    assert.equal(parseColor(null), null)
    assert.equal(parseColor('rgb(a,b,c)'), null)
  })
})

describe('normalisePalette', () => {
  test('always 5 entries, cycling', () => {
    const p = normalisePalette(['#ff0000', '#00ff00'])
    assert.equal(p.length, PALETTE_SIZE)
    close(p[2], [1, 0, 0])
    close(p[3], [0, 1, 0])
  })
  test('drops unparseable entries', () => {
    const p = normalisePalette(['nope', '#0000ff'])
    p.forEach((c) => close(c, [0, 0, 1]))
  })
  test('empty → neutral greys (copies, not shared)', () => {
    const p = normalisePalette([])
    assert.deepEqual(p, NEUTRAL)
    p[0][0] = 9
    assert.notEqual(NEUTRAL[0][0], 9)
    assert.deepEqual(normalisePalette(undefined), NEUTRAL)
  })
})

describe('crossfade helpers', () => {
  test('mixPalettes interpolates in place', () => {
    const a = [[0, 0, 0]]
    const b = [[1, 0.5, 0]]
    const out = [[9, 9, 9]]
    mixPalettes(a, b, 0.5, out)
    close(out[0], [0.5, 0.25, 0])
    mixPalettes(a, b, 1, out)
    close(out[0], [1, 0.5, 0])
  })
  test('easeInOut is clamped and symmetric', () => {
    assert.equal(easeInOut(-1), 0)
    assert.equal(easeInOut(2), 1)
    assert.equal(easeInOut(0.5), 0.5)
    assert.ok(easeInOut(0.25) < 0.25)
  })
  test('rgbCss', () => assert.equal(rgbCss([1, 0.5, 0], 0.3), 'rgba(255,128,0,0.3)'))
})
