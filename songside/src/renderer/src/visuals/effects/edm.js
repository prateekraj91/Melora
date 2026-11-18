// edm — rings pulsing out on beats + soft sweeping lasers.
import { normalisePalette } from '../palette.js'
import { TAU, makeRng, countFor, approach, beatEnvelope, lift, rgbString } from './kit.js'

const RING_POOL = 10
const LASERS = 6
/** Without audio (no permission / silence) still pulse gently at this rate. */
const IDLE_RING_MS = 1600

/** @returns {import('../../../../shared/types.js').EffectLayer} */
export function createEdm() {
  const rand = makeRng(128)
  /** @type {CanvasRenderingContext2D} */
  let ctx
  let w = 0
  let h = 0
  let intensity = 0.6
  let colours = []
  let glowColours = []
  let env = 0
  let energy = 0
  let lastRing = -Infinity
  let nextColour = 0
  const rings = Array.from({ length: RING_POOL }, () => ({
    alive: false,
    r: 0,
    v: 0,
    width: 0,
    alpha: 0,
    colour: 0
  }))
  const lasers = Array.from({ length: LASERS }, (_, i) => ({
    fromLeft: i % 2 === 0,
    y0: 0,
    phase: 0,
    speed: 0,
    colour: i % 5
  }))

  const ring = (strength) => {
    let r = rings.find((x) => !x.alive)
    if (!r) r = rings.reduce((a, b) => (a.r > b.r ? a : b)) // recycle the oldest
    r.alive = true
    r.r = Math.min(w, h) * 0.06
    r.v = Math.min(w, h) * (0.35 + 0.25 * strength)
    r.width = 2 + 4 * strength
    r.alpha = 0.25 + 0.3 * strength
    r.colour = nextColour
    nextColour = (nextColour + 1) % 5
  }

  return {
    id: 'edm',
    init(c, opts) {
      ctx = c
      w = opts.width
      h = opts.height
      intensity = opts.intensity
      this.setPalette(opts.palette)
      for (const l of lasers) {
        l.y0 = rand() * 0.3
        l.phase = rand() * TAU
        l.speed = 0.15 + rand() * 0.25
      }
    },
    setPalette(palette) {
      const p = normalisePalette(palette)
      colours = p.map((c) => rgbString(lift(c, 0.25)))
      glowColours = p.map((c) => rgbString(lift(c, 0.1)))
    },
    setIntensity(i) {
      intensity = i
    },
    frame(t, dt, audio, fade = 1) {
      const ts = t / 1000
      env = beatEnvelope(env, audio.beat, dt, 0.15)
      energy = approach(energy, audio.energy, dt, 0.3)
      if (audio.beat) {
        ring(Math.min(1, 0.4 + audio.bass))
        lastRing = t
      } else if (t - lastRing > IDLE_RING_MS) {
        ring(0.2)
        lastRing = t
      }

      ctx.globalCompositeOperation = 'screen'
      const cx = w / 2
      const cy = h / 2
      const maxR = Math.hypot(w, h) / 2
      const live = countFor(intensity, 4, RING_POOL)
      let shown = 0
      for (const r of rings) {
        if (!r.alive) continue
        r.r += r.v * dt
        r.v *= Math.pow(0.6, dt) // ease out
        const k = r.r / maxR
        if (k >= 1 || shown >= live) {
          r.alive = false
          continue
        }
        shown++
        const a = r.alpha * (1 - k) * (1 - k) * fade
        // soft halo + thin core
        ctx.strokeStyle = glowColours[r.colour]
        ctx.globalAlpha = a * 0.35
        ctx.lineWidth = r.width * 4
        ctx.beginPath()
        ctx.arc(cx, cy, r.r, 0, TAU)
        ctx.stroke()
        ctx.strokeStyle = colours[r.colour]
        ctx.globalAlpha = a
        ctx.lineWidth = r.width
        ctx.stroke()
      }

      // lasers: from the top corners, slowly sweeping across
      const nl = countFor(intensity, 2, LASERS)
      ctx.lineCap = 'round'
      for (let i = 0; i < nl; i++) {
        const l = lasers[i]
        const x0 = l.fromLeft ? -10 : w + 10
        const y0 = l.y0 * h * 0.3
        const sweep = 0.5 + 0.45 * Math.sin(ts * l.speed + l.phase)
        const x1 = l.fromLeft ? sweep * w : (1 - sweep) * w
        const y1 = h + 10
        const a = (0.05 + 0.08 * energy + 0.08 * env) * fade
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.strokeStyle = glowColours[l.colour]
        ctx.globalAlpha = a * 0.5
        ctx.lineWidth = 10
        ctx.stroke()
        ctx.strokeStyle = colours[l.colour]
        ctx.globalAlpha = a
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    },
    resize(nw, nh) {
      w = nw
      h = nh
    },
    dispose() {
      for (const r of rings) r.alive = false
    }
  }
}
