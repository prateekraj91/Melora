// hiphop — slow drifting smoke wisps + a subtle bass-synced vignette.
import { normalisePalette } from '../palette.js'
import {
  TAU,
  makeRng,
  countFor,
  approach,
  lift,
  shade,
  rankBy,
  lightness,
  wrap,
  smokeSprite,
  vignetteSprite
} from './kit.js'

const WISP_POOL = 18

/** @returns {import('../../../../shared/types.js').EffectLayer} */
export function createHiphop() {
  const rand = makeRng(303)
  /** @type {CanvasRenderingContext2D} */
  let ctx
  let w = 0
  let h = 0
  let intensity = 0.6
  let smoke = []
  let vignette = null
  let vignetteRgb = [0, 0, 0]
  let bass = 0
  const wisps = Array.from({ length: WISP_POOL }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    size: 0,
    phase: 0,
    sprite: 0
  }))

  const spawn = (s, anywhere) => {
    s.x = rand() * w
    s.y = anywhere ? rand() * h : h + 150
    s.vx = (rand() - 0.5) * 12
    s.vy = -(6 + rand() * 12)
    s.rot = rand() * TAU
    s.spin = (rand() - 0.5) * 0.12
    s.size = 260 + rand() * 340
    s.phase = rand() * TAU
    s.sprite = Math.floor(rand() * 3)
  }

  return {
    id: 'hiphop',
    init(c, opts) {
      ctx = c
      w = opts.width
      h = opts.height
      intensity = opts.intensity
      this.setPalette(opts.palette)
      for (const s of wisps) spawn(s, true)
    },
    setPalette(palette) {
      const p = normalisePalette(palette)
      const byLight = rankBy(p, lightness)
      smoke = [0, 1, 2].map((k) => smokeSprite(lift(p[byLight[k]], 0.35), rand))
      vignetteRgb = shade(p[byLight[byLight.length - 1]], 0.12)
      vignette = vignetteSprite(vignetteRgb, w, h)
    },
    setIntensity(i) {
      intensity = i
    },
    frame(t, dt, audio, fade = 1) {
      const ts = t / 1000
      bass = approach(bass, audio.bass, dt, 0.08)

      ctx.globalCompositeOperation = 'screen'
      const n = countFor(intensity, 6, WISP_POOL)
      for (let i = 0; i < n; i++) {
        const s = wisps[i]
        s.x = wrap(s.x + s.vx * dt, -s.size, w + s.size)
        s.y += s.vy * dt
        s.rot += s.spin * dt
        if (s.y < -s.size) spawn(s, false)
        const a = 0.1 + 0.05 * Math.sin(ts * 0.2 + s.phase)
        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.rot)
        ctx.globalAlpha = a * (0.6 + 0.4 * intensity) * fade
        ctx.drawImage(smoke[s.sprite], -s.size / 2, -s.size / 2, s.size, s.size)
        ctx.restore()
      }

      // vignette darkens a little on the bass
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = (0.3 + 0.3 * bass) * (0.5 + 0.5 * intensity) * fade
      ctx.drawImage(vignette, 0, 0, w, h)
    },
    resize(nw, nh) {
      for (const s of wisps) {
        s.x *= nw / (w || nw)
        s.y *= nh / (h || nh)
      }
      w = nw
      h = nh
      vignette = vignetteSprite(vignetteRgb, w, h)
    },
    dispose() {
      smoke = []
      vignette = null
    }
  }
}
