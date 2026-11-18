// Renderer-side palette helpers (pure, unit-tested). state.palette arrives as
// CSS colour strings — `#rrggbb` from main's pasteliser, or the v1 `hsl(...)`
// dominant colour as a fallback — and the visuals need RGB floats.

/** @typedef {[number, number, number]} RGB  0–1 floats */

export const PALETTE_SIZE = 5
/** Neutral fallback when there is no palette yet (greys are allowed by the colour rule). */
export const NEUTRAL = /** @type {RGB[]} */ ([
  [0.62, 0.62, 0.64],
  [0.55, 0.55, 0.58],
  [0.68, 0.67, 0.66],
  [0.5, 0.5, 0.52],
  [0.6, 0.6, 0.6]
])

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

/**
 * Parse `#rgb`, `#rrggbb`, `rgb(...)`/`rgba(...)` or `hsl(...)` (comma or
 * space syntax). Returns null for anything else.
 * @param {string} str
 * @returns {RGB|null}
 */
export function parseColor(str) {
  if (typeof str !== 'string') return null
  const s = str.trim().toLowerCase()
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (m) {
    const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  }
  const nums = (x) => x.split(/[\s,/]+/).filter(Boolean)
  m = s.match(/^rgba?\((.+)\)$/)
  if (m) {
    const [r, g, b] = nums(m[1]).map((v) =>
      v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / 255
    )
    return [r, g, b].every(Number.isFinite) ? [r, g, b] : null
  }
  m = s.match(/^hsla?\((.+)\)$/)
  if (m) {
    const [h, sat, l] = nums(m[1]).map((v) => parseFloat(v))
    if (![h, sat, l].every(Number.isFinite)) return null
    return hslToRgb(((h % 360) + 360) % 360, sat / 100, l / 100)
  }
  return null
}

/**
 * Exactly PALETTE_SIZE RGB colours: unparseable entries dropped, short
 * palettes cycled, an empty one replaced by NEUTRAL.
 * @param {string[]|null|undefined} palette
 * @returns {RGB[]}
 */
export function normalisePalette(palette) {
  const parsed = (palette ?? []).map(parseColor).filter(Boolean)
  if (!parsed.length) return NEUTRAL.map((c) => [...c])
  return Array.from({ length: PALETTE_SIZE }, (_, i) => [...parsed[i % parsed.length]])
}

/**
 * Linear blend of two equal-length palettes (in place into `out`).
 * @param {RGB[]} a
 * @param {RGB[]} b
 * @param {number} t 0–1
 * @param {RGB[]} out
 */
export function mixPalettes(a, b, t, out) {
  for (let i = 0; i < out.length; i++) {
    for (let k = 0; k < 3; k++) out[i][k] = a[i][k] + (b[i][k] - a[i][k]) * t
  }
  return out
}

/** Smooth 0→1 ease for crossfades. */
export const easeInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

/** @param {RGB} c */
export const rgbCss = (c, alpha = 1) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${alpha})`
