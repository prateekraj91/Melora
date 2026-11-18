// Album palette → soft pastel palette in OKLCH (v2 task 1.4). Pure maths, no
// Electron imports, unit-tested with node:test.
//
// Pastelise rule: keep the hue, clamp lightness to [0.78, 0.88] and chroma to
// ≤ 0.09, then map back into sRGB (reducing chroma further if needed so the
// colour stays in gamut). Output is `#rrggbb`, usable by CSS and by WebGL.

export const PASTEL_L_MIN = 0.78
export const PASTEL_L_MAX = 0.88
export const PASTEL_C_MAX = 0.09
export const PALETTE_SIZE = 5

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/**
 * sRGB (0–255 each) → OKLCH { l: 0–1, c: ≥0, h: degrees 0–360 }.
 * @param {[number, number, number]} rgb
 */
export function rgbToOklch([R, G, B]) {
  const r = toLinear(R / 255)
  const g = toLinear(G / 255)
  const b = toLinear(B / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const c = Math.hypot(A, Bb)
  let h = (Math.atan2(Bb, A) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h }
}

/**
 * OKLCH → linear-free sRGB floats (0–1, may fall outside the gamut).
 * @param {{l:number,c:number,h:number}} lch
 * @returns {[number, number, number]}
 */
export function oklchToRgbFloat({ l: L, c, h }) {
  const hr = (h * Math.PI) / 180
  const A = c * Math.cos(hr)
  const B = c * Math.sin(hr)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  return [toGamma(r), toGamma(g), toGamma(b)]
}

const EPS = 1e-4
const inGamut = (rgb) => rgb.every((v) => v >= -EPS && v <= 1 + EPS)

/**
 * OKLCH → sRGB 0–255 ints. Out-of-gamut colours lose chroma (hue and
 * lightness kept) until they fit.
 * @param {{l:number,c:number,h:number}} lch
 * @returns {[number, number, number]}
 */
export function oklchToRgb(lch) {
  let rgb = oklchToRgbFloat(lch)
  if (!inGamut(rgb)) {
    let lo = 0
    let hi = lch.c
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToRgbFloat({ ...lch, c: mid }))) lo = mid
      else hi = mid
    }
    rgb = oklchToRgbFloat({ ...lch, c: lo })
  }
  return rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255))
}

/**
 * The pastel version of a colour, in OKLCH.
 * @param {[number, number, number]} rgb 0–255
 */
export function pasteliseOklch(rgb) {
  const { l, c, h } = rgbToOklch(rgb)
  return {
    l: Math.min(PASTEL_L_MAX, Math.max(PASTEL_L_MIN, l)),
    c: Math.min(PASTEL_C_MAX, c),
    h
  }
}

/** @param {[number, number, number]} rgb 0–255 */
export const rgbToHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')

/**
 * @param {[number, number, number]} rgb 0–255
 * @returns {string} '#rrggbb'
 */
export function pastelise(rgb) {
  return rgbToHex(oklchToRgb(pasteliseOklch(rgb)))
}

/**
 * Raw palette (from colorthief) → exactly PALETTE_SIZE pastel hex colours.
 * Short palettes are padded by cycling; an empty one returns [].
 * @param {Array<[number, number, number]>} rgbs
 * @returns {string[]}
 */
export function pastelPalette(rgbs) {
  if (!rgbs?.length) return []
  const out = []
  for (let i = 0; i < PALETTE_SIZE; i++) out.push(pastelise(rgbs[i % rgbs.length]))
  return out
}
