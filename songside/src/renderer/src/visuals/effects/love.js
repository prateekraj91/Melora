// love — drifting petals + slow warm glows.
import { normalisePalette } from '../palette.js'
import {
  TAU,
  makeRng,
  countFor,
  approach,
  lift,
  rankBy,
  warmth,
  wrap,
  glowSprite,
  petalSprite
} from './kit.js'

const PETAL_POOL = 42
const GLOWS = 4

/** @returns {import('../../../../shared/types.js').EffectLayer} */
export function createLove() {
  const rand = makeRng(14)
  /** @type {CanvasRenderingContext2D} */
  let ctx
  let w = 0
  let h = 0
  let intensity = 0.6
  let petalSprites = []
  let glowSprites = []
  let energy = 0
  const petals = Array.from({ length: PETAL_POOL }, () => ({
    x: 0,
    y: 0,
    vy: 0,
    sway: 0,
    phase: 0,
    rot: 0,
    spin: 0,
    flip: 0,
    size: 0,
    colour: 0
  }))
  const glows = Array.from({ length: GLOWS }, () => ({
    cx: 0,
    cy: 0,
    phase: 0,
    speed: 0,
    colour: 0
  }))

  const spawn = (p, anywhere) => {
    p.x = rand() * w
    p.y = anywhere ? rand() * h : -30
    p.vy = 18 + rand() * 26
    p.sway = 20 + rand() * 40
    p.phase = rand() * TAU
    p.rot = rand() * TAU
    p.spin = (rand() - 0.5) * 1.2
    p.flip = 0.5 + rand() * 1.5
    p.size = 0.6 + rand() * 0.7
    p.colour = Math.floor(rand() * 3)
  }

  return {
    id: 'love',
    init(c, opts) {
      ctx = c
      w = opts.width
      h = opts.height
      intensity = opts.intensity
      this.setPalette(opts.palette)
      for (const p of petals) spawn(p, true)
      glows.forEach((g, i) => {
        g.cx = (i + 0.5) / GLOWS
        g.cy = 0.3 + rand() * 0.4
        g.phase = rand() * TAU
        g.speed = 0.05 + rand() * 0.07
        g.colour = i % 2
      })
    },
    setPalette(palette) {
      const p = normalisePalette(palette)
      const warm = rankBy(p, warmth)
      petalSprites = [0, 1, 2].map((k) => petalSprite(lift(p[warm[k]], 0.25)))
      glowSprites = [0, 1].map((k) => glowSprite(lift(p[warm[k]], 0.15), 128))
    },
    setIntensity(i) {
      intensity = i
    },
    frame(t, dt, audio, fade = 1) {
      const ts = t / 1000
      energy = approach(energy, audio.energy, dt, 0.6)

      // warm glows: big, slow, breathing
      ctx.globalCompositeOperation = 'screen'
      const R = Math.max(w, h) * 0.32
      for (const g of glows) {
        const x = (g.cx + Math.sin(ts * g.speed + g.phase) * 0.12) * w
        const y = (g.cy + Math.cos(ts * g.speed * 0.8 + g.phase) * 0.1) * h
        const breathe = 0.7 + 0.3 * Math.sin(ts * 0.4 + g.phase)
        const r = R * (0.85 + 0.15 * breathe)
        ctx.globalAlpha = (0.08 + 0.06 * breathe + energy * 0.06) * (0.6 + 0.4 * intensity) * fade
        ctx.drawImage(glowSprites[g.colour], x - r, y - r, r * 2, r * 2)
      }

      // petals: fall, sway, spin, and "flip" (scaleY) to fake 3D
      ctx.globalCompositeOperation = 'source-over'
      const n = countFor(intensity, 10, PETAL_POOL)
      for (let i = 0; i < n; i++) {
        const p = petals[i]
        p.y += p.vy * dt
        p.rot += p.spin * dt
        if (p.y > h + 30) spawn(p, false)
        const x = wrap(p.x + Math.sin(ts * 0.5 + p.phase) * p.sway, -30, w + 30)
        const sprite = petalSprites[p.colour]
        const sw = sprite.width * p.size
        const sh = sprite.height * p.size
        ctx.save()
        ctx.translate(x, p.y)
        ctx.rotate(p.rot)
        ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(ts * p.flip + p.phase)))
        ctx.globalAlpha = 0.38 * fade
        ctx.drawImage(sprite, -sw / 2, -sh / 2, sw, sh)
        ctx.restore()
      }
    },
    resize(nw, nh) {
      for (const p of petals) {
        p.x *= nw / (w || nw)
        p.y *= nh / (h || nh)
      }
      w = nw
      h = nh
    },
    dispose() {
      petalSprites = []
      glowSprites = []
    }
  }
}
