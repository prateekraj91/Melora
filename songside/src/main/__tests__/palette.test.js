import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  rgbToOklch,
  oklchToRgb,
  pasteliseOklch,
  pastelise,
  pastelPalette,
  rgbToHex,
  PASTEL_L_MIN,
  PASTEL_L_MAX,
  PASTEL_C_MAX,
  PALETTE_SIZE
} from '../palette.js'

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≈ ${b}`)

describe('OKLCH conversion', () => {
  test('white and black', () => {
    const w = rgbToOklch([255, 255, 255])
    close(w.l, 1, 1e-4, 'white L')
    close(w.c, 0, 1e-4, 'white C')
    const k = rgbToOklch([0, 0, 0])
    close(k.l, 0, 1e-6, 'black L')
  })

  test('known reference values (sRGB red, green, blue)', () => {
    // CSS Color 4 reference: red ≈ oklch(0.628 0.258 29.2)
    const red = rgbToOklch([255, 0, 0])
    close(red.l, 0.628, 0.002, 'red L')
    close(red.c, 0.258, 0.002, 'red C')
    close(red.h, 29.23, 0.3, 'red h')
    const green = rgbToOklch([0, 255, 0])
    close(green.l, 0.8664, 0.002, 'green L')
    close(green.h, 142.5, 0.5, 'green h')
    const blue = rgbToOklch([0, 0, 255])
    close(blue.l, 0.452, 0.002, 'blue L')
    close(blue.h, 264.05, 0.5, 'blue h')
  })

  test('round trip sRGB → OKLCH → sRGB is lossless (±1)', () => {
    for (const rgb of [
      [12, 200, 99],
      [255, 128, 0],
      [33, 33, 33],
      [180, 20, 220],
      [250, 250, 245]
    ]) {
      const back = oklchToRgb(rgbToOklch(rgb))
      back.forEach((v, i) => close(v, rgb[i], 1, `channel ${i} of ${rgb}`))
    }
  })

  test('hue is in [0, 360)', () => {
    for (const rgb of [
      [255, 0, 128],
      [0, 0, 255],
      [10, 200, 10]
    ]) {
      const { h } = rgbToOklch(rgb)
      assert.ok(h >= 0 && h < 360)
    }
  })

  test('out-of-gamut colours are mapped in by reducing chroma', () => {
    const rgb = oklchToRgb({ l: 0.85, c: 0.4, h: 260 })
    rgb.forEach((v) => assert.ok(v >= 0 && v <= 255))
    const back = rgbToOklch(rgb)
    close(back.l, 0.85, 0.01, 'lightness kept')
    close(back.h, 260, 2, 'hue kept')
  })
})

describe('pastelise', () => {
  test('clamps lightness and chroma, keeps hue', () => {
    const p = pasteliseOklch([200, 0, 30]) // dark saturated red
    assert.equal(p.l, PASTEL_L_MIN)
    assert.equal(p.c, PASTEL_C_MAX)
    close(p.h, rgbToOklch([200, 0, 30]).h, 1e-9)
  })

  test('very light input is pulled down to L ≤ 0.88', () => {
    assert.equal(pasteliseOklch([250, 250, 250]).l, PASTEL_L_MAX)
  })

  test('already-pastel colours keep their lightness', () => {
    const src = oklchToRgb({ l: 0.82, c: 0.05, h: 100 })
    const p = pasteliseOklch(src)
    close(p.l, 0.82, 0.005)
    close(p.c, 0.05, 0.005)
  })

  test('output hex is in range and round-trips within the pastel bounds', () => {
    for (const rgb of [
      [0, 0, 0],
      [255, 0, 0],
      [0, 0, 255],
      [20, 120, 40],
      [255, 255, 0]
    ]) {
      const hex = pastelise(rgb)
      assert.match(hex, /^#[0-9a-f]{6}$/)
      const back = rgbToOklch([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)))
      assert.ok(back.l >= PASTEL_L_MIN - 0.01 && back.l <= PASTEL_L_MAX + 0.01, `L of ${hex}`)
      assert.ok(back.c <= PASTEL_C_MAX + 0.01, `C of ${hex}`)
    }
  })

  test('rgbToHex pads', () => assert.equal(rgbToHex([0, 15, 255]), '#000fff'))
})

describe('pastelPalette', () => {
  test('always returns exactly 5 colours, cycling short palettes', () => {
    const p = pastelPalette([
      [255, 0, 0],
      [0, 0, 255]
    ])
    assert.equal(p.length, PALETTE_SIZE)
    assert.equal(p[0], p[2])
    assert.equal(p[1], p[3])
  })
  test('empty / missing → []', () => {
    assert.deepEqual(pastelPalette([]), [])
    assert.deepEqual(pastelPalette(null), [])
  })
})
