// chill — slow floating bokeh orbs.
import { normalisePalette } from '../palette.js'
import { TAU, makeRng, countFor, approach, lift, wrap, bokehSprite } from './kit.js'

const POOL = 18

/** @returns {import('../../../../shared/types.js').EffectLayer} */
export function createChill() {
  const rand = makeRng(7)
  /** @type {CanvasRenderingContext2D} */
  let ctx
  let w = 0
  let h = 0
  let intensity = 0.6
  let sprites = []
  let energy = 0
  const orbs = Array.from({ length: POOL }, () => ({
    x: 0,
    y: 0,
    r: 0,
    vx: 0,
    vy: 0,
    phase: 0,
    speed: 0,
    alpha: 0,
    colour: 0
  }))

  const seed = () => {
    for (const o of orbs) {
      o.x = rand() * w
      o.y = rand() * h
      o.r = 30 + rand() * 110
      o.vx = (rand() - 0.5) * 14
      o.vy = -4 - rand() * 10
      o.phase = rand() * TAU
      o.speed = 0.15 + rand() * 0.35
      o.alpha = 0.1 + rand() * 0.12
      o.colour = Math.floor(rand() * 5)
    }
  }

  return {
    id: 'chill',
    init(c, opts) {
      ctx = c
      w = opts.width
      h = opts.height
      intensity = opts.intensity
      this.setPalette(opts.palette)
      seed()
    },
    setPalette(palette) {
      sprites = normalisePalette(palette).map((c) => bokehSprite(lift(c, 0.15)))
    },
    setIntensity(i) {
      intensity = i
    },
    frame(t, dt, audio, fade = 1) {
      energy = approach(energy, audio.energy, dt, 0.4)
      const n = countFor(intensity, 6, POOL)
      const ts = t / 1000
      ctx.globalCompositeOperation = 'screen'
      for (let i = 0; i < n; i++) {
        const o = orbs[i]
        o.x = wrap(o.x + o.vx * dt, -o.r, w + o.r)
        o.y = wrap(o.y + o.vy * dt, -o.r, h + o.r)
        const breathe = 0.75 + 0.25 * Math.sin(o.phase + ts * o.speed)
        const r = o.r * (1 + energy * 0.12)
        ctx.globalAlpha = o.alpha * breathe * (0.6 + 0.4 * intensity) * (1 + energy * 0.5) * fade
        ctx.drawImage(sprites[o.colour], o.x - r, o.y - r, r * 2, r * 2)
      }
    },
    resize(nw, nh) {
      for (const o of orbs) {
        o.x *= nw / (w || nw)
        o.y *= nh / (h || nh)
      }
      w = nw
      h = nh
    },
    dispose() {
      sprites = []
    }
  }
}
