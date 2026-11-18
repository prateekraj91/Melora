// rain — falling streaks + droplets sliding down the glass.
import { normalisePalette } from '../palette.js'
import { makeRng, countFor, lift, rgbString, dropSprite } from './kit.js'

const STREAK_POOL = 260
const DROP_POOL = 34
const SLANT = 0.12 // horizontal drift per unit fall
const STREAK_GROUPS = 3 // colours, one path + stroke per colour

/** @returns {import('../../../../shared/types.js').EffectLayer} */
export function createRain() {
  const rand = makeRng(91)
  /** @type {CanvasRenderingContext2D} */
  let ctx
  let w = 0
  let h = 0
  let intensity = 0.6
  let streakColours = []
  let dropSprites = []
  const streaks = Array.from({ length: STREAK_POOL }, (_, i) => ({
    x: 0,
    y: 0,
    len: 0,
    v: 0,
    group: i % STREAK_GROUPS
  }))
  const drops = Array.from({ length: DROP_POOL }, () => ({
    x: 0,
    y: 0,
    r: 0,
    v: 0,
    hold: 0,
    colour: 0
  }))

  const spawnStreak = (s, anywhere) => {
    s.x = rand() * (w + h * SLANT) - h * SLANT
    s.y = anywhere ? rand() * h : -40 - rand() * 100
    s.len = 12 + rand() * 22
    s.v = 650 + rand() * 500
  }
  const spawnDrop = (d, anywhere) => {
    d.x = rand() * w
    d.y = anywhere ? rand() * h : rand() * h * 0.5
    d.r = 3 + rand() * 6
    d.v = 0
    d.hold = rand() * 3
    d.colour = Math.floor(rand() * 5)
  }

  return {
    id: 'rain',
    init(c, opts) {
      ctx = c
      w = opts.width
      h = opts.height
      intensity = opts.intensity
      this.setPalette(opts.palette)
      for (const s of streaks) spawnStreak(s, true)
      for (const d of drops) spawnDrop(d, true)
    },
    setPalette(palette) {
      const p = normalisePalette(palette)
      streakColours = [0, 1, 2].map((k) => rgbString(lift(p[k], 0.55)))
      dropSprites = p.map((c) => dropSprite(lift(c, 0.3)))
    },
    setIntensity(i) {
      intensity = i
    },
    frame(t, dt, audio, fade = 1) {
      // streaks: one path per colour group
      const n = countFor(intensity, 60, STREAK_POOL)
      ctx.lineWidth = 1
      ctx.lineCap = 'round'
      for (let g = 0; g < STREAK_GROUPS; g++) {
        ctx.globalAlpha = (0.12 + 0.06 * g + audio.energy * 0.08) * fade
        ctx.strokeStyle = streakColours[g]
        ctx.beginPath()
        for (let i = g; i < n; i += STREAK_GROUPS) {
          const s = streaks[i]
          s.y += s.v * dt
          s.x += s.v * dt * SLANT
          if (s.y - s.len > h) spawnStreak(s, false)
          ctx.moveTo(s.x, s.y)
          ctx.lineTo(s.x - s.len * SLANT, s.y - s.len)
        }
        ctx.stroke()
      }

      // drops on the glass: stick, then slide in little stop-and-go runs
      const nd = countFor(intensity, 10, DROP_POOL)
      for (let i = 0; i < nd; i++) {
        const d = drops[i]
        if (d.hold > 0) {
          d.hold -= dt
          d.v *= 0.9
        } else {
          d.v = Math.min(140, d.v + (40 + d.r * 12) * dt)
          if (rand() < dt * 0.8) d.hold = 0.2 + rand() * 1.2 // catch on the glass
        }
        d.y += d.v * dt
        if (d.y - d.r > h) spawnDrop(d, false)
        const s = d.r * 2
        ctx.globalAlpha = 0.85 * fade
        ctx.drawImage(dropSprites[d.colour], d.x - d.r, d.y - d.r * 1.1, s, s * 1.1)
      }
    },
    resize(nw, nh) {
      for (const d of drops) {
        d.x *= nw / (w || nw)
        d.y *= nh / (h || nh)
      }
      w = nw
      h = nh
    },
    dispose() {
      dropSprites = []
    }
  }
}
