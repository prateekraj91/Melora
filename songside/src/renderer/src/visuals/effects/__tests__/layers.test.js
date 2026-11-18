// Smoke tests for every EffectLayer against a fake 2D context: they must
// init, animate, resize and dispose without throwing; keep every alpha in
// [0,1]; draw nothing at fade 0; and draw more at higher intensity.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'

function fakeCtx(log) {
  const ctx = {
    _alpha: 1,
    get globalAlpha() {
      return this._alpha
    },
    set globalAlpha(a) {
      if (!(a >= 0 && a <= 1.0000001)) log.badAlpha.push(a)
      this._alpha = a
    },
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt'
  }
  const draw = () => {
    if (ctx._alpha > 0) log.draws++
  }
  for (const m of [
    'save',
    'restore',
    'translate',
    'rotate',
    'scale',
    'beginPath',
    'moveTo',
    'lineTo',
    'arc',
    'ellipse',
    'closePath',
    'bezierCurveTo',
    'setTransform',
    'clearRect'
  ])
    ctx[m] = () => {}
  ctx.drawImage = draw
  ctx.stroke = draw
  ctx.fill = draw
  ctx.fillRect = draw
  const grad = { addColorStop() {} }
  ctx.createRadialGradient = () => grad
  ctx.createLinearGradient = () => grad
  return ctx
}

const PALETTE = ['#f1b9b4', '#d3bdf0', '#a9d3ec', '#a6d8b8', '#eed2a8']
const quiet = { bass: 0, mid: 0, treble: 0, energy: 0, beat: false, bpm: null }
const loud = (i) => ({
  bass: 0.8,
  mid: 0.5,
  treble: 0.3,
  energy: 0.7,
  beat: i % 30 === 0,
  bpm: 120
})

let factories
before(async () => {
  // Sprites render to OffscreenCanvas; give node a fake one.
  globalThis.OffscreenCanvas = class {
    constructor(w, h) {
      this.width = w
      this.height = h
    }
    getContext() {
      return fakeCtx({ draws: 0, badAlpha: [] })
    }
  }
  factories = (await import('../scenes.js')).SCENE_FACTORIES
})
after(() => {
  delete globalThis.OffscreenCanvas
})

/** Run a layer for n frames; returns the draw log. */
function run(make, { intensity = 0.6, fade = 1, frames = 120, audio = loud } = {}) {
  const log = { draws: 0, badAlpha: [] }
  const layer = make()
  layer.init(fakeCtx(log), { width: 1440, height: 900, palette: PALETTE, intensity })
  for (let i = 0; i < frames; i++) layer.frame(i * 16.7, 0.0167, audio(i), fade)
  return { log, layer }
}

describe('effect layers', () => {
  test('all seven scenes are registered', () => {
    assert.deepEqual(Object.keys(factories).sort(), [
      'chill',
      'christmas',
      'edm',
      'hiphop',
      'love',
      'rain',
      'rock'
    ])
  })

  for (const name of ['chill', 'christmas', 'rock', 'rain', 'love', 'edm', 'hiphop']) {
    test(`${name}: animates, resizes, re-palettes and disposes cleanly`, () => {
      const make = factories[name]
      const { log, layer } = run(make, { frames: 600 })
      assert.equal(layer.id, name)
      assert.deepEqual(log.badAlpha, [], 'alpha out of [0,1]')
      assert.ok(log.draws > 0, 'drew something')
      layer.resize(800, 600)
      layer.setPalette(['#ffffff'])
      layer.setIntensity(1)
      for (let i = 0; i < 60; i++) layer.frame(10000 + i * 16, 0.016, quiet)
      layer.setPalette([]) // empty → neutral greys, must not throw
      layer.frame(20000, 0.016, quiet)
      layer.dispose()
      assert.deepEqual(log.badAlpha, [])
    })

    test(`${name}: fade 0 draws nothing visible`, () => {
      const { log } = run(factories[name], { fade: 0, frames: 30 })
      assert.equal(log.draws, 0)
    })

    test(`${name}: higher intensity draws at least as much`, () => {
      const lo = run(factories[name], { intensity: 0, frames: 60 }).log.draws
      const hi = run(factories[name], { intensity: 1, frames: 60 }).log.draws
      assert.ok(hi >= lo, `${hi} >= ${lo}`)
    })
  }
})
