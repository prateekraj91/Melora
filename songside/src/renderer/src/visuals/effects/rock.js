// rock — stage beams sweeping on beats, rising embers, a tiny 2px shake on kicks.
import { normalisePalette } from '../palette.js'
import {
  TAU,
  makeRng,
  countFor,
  approach,
  beatEnvelope,
  lift,
  rankBy,
  warmth,
  glowSprite,
  beamSprite
} from './kit.js'

const BEAMS = 5
const EMBER_POOL = 90
const SHAKE_PX = 2

/** @returns {import('../../../../shared/types.js').EffectLayer} */
export function createRock() {
  const rand = makeRng(66)
  /** @type {CanvasRenderingContext2D} */
  let ctx
  let w = 0
  let h = 0
  let intensity = 0.6
  let beamSprites = []
  let emberSprites = []
  let env = 0
  let kick = 0
  let swing = 0 // accumulated sweep phase; beats push it forward
  const beams = Array.from({ length: BEAMS }, (_, i) => ({
    base: 0,
    phase: (i / BEAMS) * TAU,
    span: 0,
    colour: i % 3
  }))
  const embers = Array.from({ length: EMBER_POOL }, () => ({
    x: 0,
    y: 0,
    vy: 0,
    life: 0,
    max: 1,
    phase: 0,
    size: 0,
    colour: 0
  }))

  const spawn = (e, anywhere) => {
    e.x = rand() * w
    e.y = anywhere ? rand() * h : h + 10
    e.vy = 25 + rand() * 45
    e.max = 3 + rand() * 4
    e.life = anywhere ? rand() * e.max : 0
    e.phase = rand() * TAU
    e.size = 2 + rand() * 3
    e.colour = Math.floor(rand() * 2)
  }

  return {
    id: 'rock',
    init(c, opts) {
      ctx = c
      w = opts.width
      h = opts.height
      intensity = opts.intensity
      this.setPalette(opts.palette)
      beams.forEach((b, i) => {
        b.base = (i + 0.5) / BEAMS
        b.span = 0.25 + rand() * 0.2
      })
      for (const e of embers) spawn(e, true)
    },
    setPalette(palette) {
      const p = normalisePalette(palette)
      const warm = rankBy(p, warmth)
      beamSprites = [0, 1, 2].map((k) => beamSprite(lift(p[warm[k]], 0.2)))
      emberSprites = [0, 1].map((k) => glowSprite(lift(p[warm[k]], 0.3), 32))
    },
    setIntensity(i) {
      intensity = i
    },
    frame(t, dt, audio, fade = 1) {
      env = beatEnvelope(env, audio.beat, dt, 0.18)
      swing += dt * (0.35 + env * 1.6)
      // shake only on kicks: a beat with real bass behind it
      kick = audio.beat && audio.bass > 0.45 ? 1 : approach(kick, 0, dt, 0.05)
      const sx = (rand() - 0.5) * 2 * SHAKE_PX * kick * intensity
      const sy = (rand() - 0.5) * 2 * SHAKE_PX * kick * intensity
      ctx.translate(sx, sy)

      // beams from below the bottom edge
      ctx.globalCompositeOperation = 'screen'
      const bw = w * 0.22
      const bh = h * 1.25
      const nb = countFor(intensity, 3, BEAMS)
      for (let i = 0; i < nb; i++) {
        const b = beams[i]
        const angle = Math.sin(swing + b.phase) * b.span
        ctx.save()
        ctx.translate(b.base * w, h + 20)
        ctx.rotate(angle)
        ctx.globalAlpha = (0.08 + 0.14 * env + 0.06 * audio.energy) * (0.6 + 0.4 * intensity) * fade
        ctx.drawImage(beamSprites[b.colour], -bw / 2, -bh, bw, bh)
        ctx.restore()
      }

      // embers
      const ne = countFor(intensity, 20, EMBER_POOL)
      for (let i = 0; i < ne; i++) {
        const e = embers[i]
        e.life += dt
        e.y -= e.vy * dt * (1 + env * 0.6)
        if (e.life >= e.max || e.y < -10) spawn(e, false)
        const k = e.life / e.max
        const a = Math.sin(k * Math.PI) // in and out
        const x = e.x + Math.sin(e.phase + e.life * 1.7) * 10
        const s = e.size * 3
        ctx.globalAlpha = a * 0.55 * fade
        ctx.drawImage(emberSprites[e.colour], x - s / 2, e.y - s / 2, s, s)
      }
    },
    resize(nw, nh) {
      for (const e of embers) {
        e.x *= nw / (w || nw)
        e.y *= nh / (h || nh)
      }
      w = nw
      h = nh
    },
    dispose() {
      beamSprites = []
      emberSprites = []
    }
  }
}
