// Shared helpers for the effect layers (v2 task 3.3).
//
// Pure helpers (top half) are unit-tested. The sprite helpers (bottom half)
// pre-render soft shapes to small canvases ONCE per palette, so a layer's
// frame() only does drawImage / stroke with cached colour strings — no
// gradients, strings or objects created per frame.

/** @typedef {[number, number, number]} RGB  0–1 floats */

export const TAU = Math.PI * 2

/** Scene order for the dev cycler (S). */
export const SCENES = /** @type {const} */ ([
  'chill',
  'christmas',
  'rock',
  'rain',
  'love',
  'edm',
  'hiphop'
])
export const DEFAULT_SCENE = 'chill'
export const CROSSFADE_MS = 1500

export const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x)

/**
 * Small fast seeded PRNG (mulberry32) → () => [0, 1).
 * @param {number} seed
 */
export function makeRng(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * How many pooled particles are active at an intensity (0–1).
 * @param {number} intensity
 * @param {number} min  count at intensity 0
 * @param {number} max  count at intensity 1 (= pool size)
 */
export const countFor = (intensity, min, max) => Math.round(min + (max - min) * clamp01(intensity))

/** Exponential approach of `value` to `target`, frame-rate independent. */
export const approach = (value, target, dt, halfLifeS) =>
  target + (value - target) * Math.pow(0.5, dt / halfLifeS)

/** Lift a colour towards white by k (0–1) — keeps everything pastel. */
export const lift = (rgb, k) => /** @type {RGB} */ (rgb.map((c) => c + (1 - c) * k))

/** Scale a colour towards black (for shadows / vignettes). */
export const shade = (rgb, k) => /** @type {RGB} */ (rgb.map((c) => c * k))

/** 'rgb(r,g,b)' for a 0–1 colour. Call at palette time, not per frame. */
export const rgbString = (rgb) =>
  `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`

/** Relative luminance-ish lightness, for picking light / dark entries. */
export const lightness = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]

/** "Warmth": red over blue. Used to pick the warm entries for love / rock. */
export const warmth = (rgb) => rgb[0] - rgb[2] + rgb[1] * 0.2

/**
 * Indices of `palette` sorted by `score`, best first.
 * @param {RGB[]} palette
 * @param {(c: RGB) => number} score
 */
export const rankBy = (palette, score) =>
  palette
    .map((c, i) => [score(c), i])
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i)

/** The scene after `current` in SCENES (wraps; unknown → first). */
export function nextScene(current) {
  const i = SCENES.indexOf(current)
  return SCENES[(i + 1) % SCENES.length]
}

/**
 * Move a scene's crossfade weight linearly towards its target (1 for the
 * current scene, 0 for scenes fading out) so that a full fade takes
 * `durationMs`. Linear so that cycling mid-fade reverses smoothly from
 * wherever it is; draw with `smooth(weight)`.
 */
export function stepWeight(weight, target, dtMs, durationMs = CROSSFADE_MS) {
  const step = dtMs / durationMs
  return target > weight ? Math.min(target, weight + step) : Math.max(target, weight - step)
}

/** Smoothstep 0–1 (eases a linear weight for drawing). */
export const smooth = (x) => {
  const c = clamp01(x)
  return c * c * (3 - 2 * c)
}

/**
 * Smoothed beat envelope: jumps to 1 on a beat, decays with `halfLifeS`.
 * Returns the new value.
 */
export const beatEnvelope = (env, beat, dt, halfLifeS = 0.12) =>
  beat ? 1 : env * Math.pow(0.5, dt / halfLifeS)

/** Wrap x into [lo, hi). */
export function wrap(x, lo, hi) {
  const span = hi - lo
  if (span <= 0) return lo
  return ((((x - lo) % span) + span) % span) + lo
}

// ---------------------------------------------------------------------------
// Sprites (DOM / OffscreenCanvas — not unit-tested)

/** @returns {OffscreenCanvas|HTMLCanvasElement} */
export function makeCanvas(w, h) {
  w = Math.max(1, Math.ceil(w))
  h = Math.max(1, Math.ceil(h))
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

const rgba = (rgb, a) =>
  `rgba(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)},${a})`

/**
 * Soft round glow: radial gradient from `stops` ([offset, alpha] pairs).
 * Draw it centred, scaled to any size.
 * @param {RGB} rgb
 */
export function glowSprite(
  rgb,
  size = 64,
  stops = [
    [0, 1],
    [0.35, 0.5],
    [1, 0]
  ]
) {
  const c = makeCanvas(size, size)
  const g = c.getContext('2d')
  const r = size / 2
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  for (const [o, a] of stops) grad.addColorStop(o, rgba(rgb, a))
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

/**
 * A bokeh disc: nearly flat fill with a slightly brighter rim and soft edge.
 * @param {RGB} rgb
 */
export function bokehSprite(rgb, size = 96) {
  return glowSprite(rgb, size, [
    [0, 0.55],
    [0.6, 0.6],
    [0.8, 0.75],
    [0.9, 0.35],
    [1, 0]
  ])
}

/**
 * A petal: a soft teardrop, pointing up, `w` × `h` px.
 * @param {RGB} rgb
 */
export function petalSprite(rgb, w = 28, h = 40) {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, rgba(lift(rgb, 0.35), 0.95))
  grad.addColorStop(1, rgba(rgb, 0.75))
  g.fillStyle = grad
  g.beginPath()
  g.moveTo(w / 2, h * 0.04)
  g.bezierCurveTo(w * 1.05, h * 0.35, w * 0.85, h * 0.95, w / 2, h * 0.96)
  g.bezierCurveTo(w * 0.15, h * 0.95, -w * 0.05, h * 0.35, w / 2, h * 0.04)
  g.fill()
  return c
}

/**
 * A light cone pointing up from the bottom centre: bright at the base,
 * fading to nothing at the top and edges. `w` × `h` px.
 * @param {RGB} rgb
 */
export function beamSprite(rgb, w = 160, h = 512) {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')
  const vert = g.createLinearGradient(0, h, 0, 0)
  vert.addColorStop(0, rgba(rgb, 0.9))
  vert.addColorStop(0.5, rgba(rgb, 0.35))
  vert.addColorStop(1, rgba(rgb, 0))
  g.fillStyle = vert
  g.beginPath()
  g.moveTo(w * 0.47, h)
  g.lineTo(w * 0.53, h)
  g.lineTo(w, 0)
  g.lineTo(0, 0)
  g.closePath()
  g.fill()
  // soften the edges: fade the sides out horizontally
  g.globalCompositeOperation = 'destination-in'
  const horiz = g.createLinearGradient(0, 0, w, 0)
  horiz.addColorStop(0, 'rgba(0,0,0,0)')
  horiz.addColorStop(0.5, 'rgba(0,0,0,1)')
  horiz.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = horiz
  g.fillRect(0, 0, w, h)
  return c
}

/**
 * A raindrop on glass: a translucent disc, darker rim, small highlight.
 * @param {RGB} rgb
 */
export function dropSprite(rgb, size = 32) {
  const c = makeCanvas(size, size)
  const g = c.getContext('2d')
  const r = size / 2
  const body = g.createRadialGradient(r * 0.85, r * 0.8, 0, r, r, r)
  body.addColorStop(0, rgba(lift(rgb, 0.6), 0.25))
  body.addColorStop(0.75, rgba(rgb, 0.18))
  body.addColorStop(0.92, rgba(lift(rgb, 0.5), 0.55))
  body.addColorStop(1, rgba(rgb, 0))
  g.fillStyle = body
  g.fillRect(0, 0, size, size)
  g.fillStyle = 'rgba(255,255,255,0.55)'
  g.beginPath()
  g.ellipse(r * 0.7, r * 0.62, r * 0.16, r * 0.1, -0.6, 0, TAU)
  g.fill()
  return c
}

/**
 * A wisp of smoke: a few overlapping soft blobs.
 * @param {RGB} rgb
 * @param {() => number} rand
 */
export function smokeSprite(rgb, rand, size = 192) {
  const c = makeCanvas(size, size)
  const g = c.getContext('2d')
  for (let i = 0; i < 7; i++) {
    const x = size * (0.3 + rand() * 0.4)
    const y = size * (0.3 + rand() * 0.4)
    const r = size * (0.15 + rand() * 0.2)
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, rgba(rgb, 0.35))
    grad.addColorStop(1, rgba(rgb, 0))
    g.fillStyle = grad
    g.fillRect(0, 0, size, size)
  }
  return c
}

/**
 * Full-screen vignette: transparent centre, `rgb` at the edges.
 * @param {RGB} rgb
 */
export function vignetteSprite(rgb, w, h) {
  // Rendered small and stretched: it's a smooth gradient anyway.
  const sw = 256
  const sh = Math.max(16, Math.round((256 * h) / Math.max(1, w)))
  const c = makeCanvas(sw, sh)
  const g = c.getContext('2d')
  const r = Math.hypot(sw, sh) / 2
  const grad = g.createRadialGradient(sw / 2, sh / 2, r * 0.35, sw / 2, sh / 2, r)
  grad.addColorStop(0, rgba(rgb, 0))
  grad.addColorStop(1, rgba(rgb, 1))
  g.fillStyle = grad
  g.fillRect(0, 0, sw, sh)
  return c
}
