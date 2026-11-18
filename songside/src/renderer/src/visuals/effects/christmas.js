// christmas — snow at 3 depths + twinkling fairy lights along the top.
import { normalisePalette } from '../palette.js'
import { TAU, makeRng, countFor, lift, rgbString, wrap, glowSprite } from './kit.js'

// depth: 0 far … 2 near
const DEPTHS = [
  { size: 1.6, speed: 16, sway: 6, alpha: 0.35, share: 0.45 },
  { size: 2.6, speed: 30, sway: 10, alpha: 0.5, share: 0.35 },
  { size: 4.2, speed: 52, sway: 16, alpha: 0.7, share: 0.2 }
]
const SNOW_POOL = 240
const BULBS = 22

/** @returns {import('../../../../shared/types.js').EffectLayer} */
export function createChristmas() {
  const rand = makeRng(25)
  /** @type {CanvasRenderingContext2D} */
  let ctx
  let w = 0
  let h = 0
  let intensity = 0.6
  let flake = null
  let bulbSprites = []
  let wireColour = 'rgb(200,200,200)'
  const flakes = Array.from({ length: SNOW_POOL }, () => ({
    x: 0,
    y: 0,
    depth: 0,
    phase: 0
  }))
  const bulbs = Array.from({ length: BULBS }, (_, i) => ({
    colour: i % 5,
    phase: 0,
    speed: 0
  }))

  const seed = () => {
    flakes.forEach((f, i) => {
      const u = i / SNOW_POOL
      f.depth = u < DEPTHS[0].share ? 0 : u < DEPTHS[0].share + DEPTHS[1].share ? 1 : 2
      f.x = rand() * w
      f.y = rand() * h
      f.phase = rand() * TAU
    })
    // shuffle so any active prefix has all depths
    for (let i = flakes.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      const tmp = flakes[i]
      flakes[i] = flakes[j]
      flakes[j] = tmp
    }
    for (const b of bulbs) {
      b.phase = rand() * TAU
      b.speed = 0.6 + rand() * 1.6
    }
  }

  // The wire: a gentle sag between three anchor points along the top.
  const wireY = (x) => {
    const seg = w / 2
    const u = (x % seg) / seg
    return 26 + Math.sin(u * Math.PI) * Math.min(48, h * 0.05)
  }

  return {
    id: 'christmas',
    init(c, opts) {
      ctx = c
      w = opts.width
      h = opts.height
      intensity = opts.intensity
      this.setPalette(opts.palette)
      seed()
    },
    setPalette(palette) {
      const p = normalisePalette(palette)
      flake = glowSprite(lift(p[0], 0.85), 32, [
        [0, 1],
        [0.4, 0.8],
        [1, 0]
      ])
      bulbSprites = p.map((c) => glowSprite(lift(c, 0.2), 64))
      wireColour = rgbString(lift(p[1], 0.5))
    },
    setIntensity(i) {
      intensity = i
    },
    frame(t, dt, audio, fade = 1) {
      const ts = t / 1000
      // snow
      const n = countFor(intensity, 50, SNOW_POOL)
      for (let i = 0; i < n; i++) {
        const f = flakes[i]
        const d = DEPTHS[f.depth]
        f.y += d.speed * dt
        if (f.y > h + 6) {
          f.y = -6
          f.x = rand() * w
        }
        const x = wrap(f.x + Math.sin(ts * 0.6 + f.phase) * d.sway, -6, w + 6)
        const s = d.size * 2.4
        ctx.globalAlpha = d.alpha * fade
        ctx.drawImage(flake, x - s / 2, f.y - s / 2, s, s)
      }

      // fairy lights
      ctx.globalAlpha = 0.18 * fade
      ctx.strokeStyle = wireColour
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x <= w; x += 16) {
        if (x === 0) ctx.moveTo(x, wireY(x))
        else ctx.lineTo(x, wireY(x))
      }
      ctx.stroke()
      ctx.globalCompositeOperation = 'screen'
      const beat = audio.energy * 0.3
      for (let i = 0; i < BULBS; i++) {
        const b = bulbs[i]
        const x = ((i + 0.5) / BULBS) * w
        const y = wireY(x) + 6
        const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(ts * b.speed + b.phase))
        const r = 12 + 6 * tw
        ctx.globalAlpha = Math.min(1, (0.35 + 0.5 * tw + beat) * (0.5 + 0.5 * intensity)) * fade
        ctx.drawImage(bulbSprites[b.colour], x - r, y - r, r * 2, r * 2)
      }
    },
    resize(nw, nh) {
      for (const f of flakes) {
        f.x *= nw / (w || nw)
        f.y *= nh / (h || nh)
      }
      w = nw
      h = nh
    },
    dispose() {
      bulbSprites = []
      flake = null
    }
  }
}
