// Pure layout + styling rules for FadedLyrics (v2 task 1.6). No DOM / React,
// unit-tested with node:test.
//
// Lines are placed in "slots" relative to the active line index L:
//   d = -2  leaving (fades out above)      d = 1  next line
//   d = -1  previous line ("above")        d = 2  line after next
//   d =  0  active line                    d = 3  entering (fades in below)
// Every line is laid out at the ACTIVE font size and neighbours are drawn with
// transform: scale(NEIGHBOUR_SCALE) — so slot changes animate on the
// compositor (transform / opacity / filter only, no font-size reflow).

export const ACTIVE_VW = 4.2
export const NEIGHBOUR_VW = 2.4
export const NEIGHBOUR_SCALE = NEIGHBOUR_VW / ACTIVE_VW
export const DRIFT_PX = 24
export const SLOTS = [-2, -1, 0, 1, 2, 3]

/**
 * @typedef {Object} SlotStyle
 * @property {number} scale
 * @property {number} opacity  Whole-line opacity (the active line's words set their own)
 * @property {number} blur     px
 */

/** @type {Record<number, SlotStyle>} */
export const SLOT_STYLE = {
  [-2]: { scale: NEIGHBOUR_SCALE, opacity: 0, blur: 3 },
  [-1]: { scale: NEIGHBOUR_SCALE, opacity: 0.1, blur: 1.5 },
  0: { scale: 1, opacity: 1, blur: 0 },
  1: { scale: NEIGHBOUR_SCALE, opacity: 0.1, blur: 1.5 },
  2: { scale: NEIGHBOUR_SCALE, opacity: 0.06, blur: 2.5 },
  3: { scale: NEIGHBOUR_SCALE, opacity: 0, blur: 3 }
}

/**
 * Vertical centre (px, relative to the screen centre) of every slot, given the
 * unscaled layout height of the line in each slot (0 / undefined = empty).
 * Lines stack with `gap` px between their VISUAL (scaled) boxes; the leaving
 * and entering lines sit DRIFT_PX beyond their neighbours.
 *
 * @param {Partial<Record<number, number>>} heights  slot → unscaled height px
 * @param {number} gap  px between visual line boxes
 * @param {number} [s=NEIGHBOUR_SCALE]
 * @returns {Record<number, number>} slot → centre offset px
 */
export function slotCentres(heights, gap, s = NEIGHBOUR_SCALE) {
  const h = (d) => heights[d] || 0
  const half0 = h(0) / 2
  const c = {}
  c[0] = 0
  c[-1] = -(half0 + gap + (h(-1) * s) / 2)
  c[-2] = c[-1] - (h(-1) * s) / 2 - DRIFT_PX - (h(-2) * s) / 2
  c[1] = half0 + gap + (h(1) * s) / 2
  c[2] = c[1] + (h(1) * s) / 2 + gap + (h(2) * s) / 2
  c[3] = c[2] + (h(2) * s) / 2 + DRIFT_PX + (h(3) * s) / 2
  return c
}

/**
 * CSS transform for a line element whose top edge sits at the screen centre.
 * @param {number} centre  from slotCentres
 * @param {number} height  unscaled layout height px
 * @param {number} scale
 */
export function slotTransform(centre, height, scale) {
  return `translateY(${(centre - height / 2).toFixed(1)}px) scale(${scale.toFixed(4)})`
}

export const SUNG_OPACITY = 0.85
export const UNSUNG_OPACITY = 0.18
export const SUNG_GLOW = '0 0 24px rgba(255,255,255,.35)'

/**
 * @typedef {Object} WordLook
 * @property {'sung'|'current'|'unsung'} kind
 * @property {number} opacity
 * @property {number} fill  0–1, how much of a 'current' word is filled left→right
 */

/**
 * How word `i` of the active line should look.
 * @param {number} i
 * @param {number} activeWord     index from getActive(); -1 = none yet
 * @param {number} wordProgress   0–1
 * @returns {WordLook}
 */
export function wordLook(i, activeWord, wordProgress) {
  if (activeWord < 0 || i > activeWord) return { kind: 'unsung', opacity: UNSUNG_OPACITY, fill: 0 }
  if (i < activeWord || wordProgress >= 1) return { kind: 'sung', opacity: SUNG_OPACITY, fill: 1 }
  return { kind: 'current', opacity: 1, fill: Math.max(0, wordProgress) }
}

/**
 * Background gradient used (with background-clip:text) to fill the current
 * word left→right. Both stops are the sung / unsung whites.
 * @param {number} fill 0–1
 */
export function fillGradient(fill) {
  const p = (fill * 100).toFixed(1)
  return `linear-gradient(90deg, rgba(255,255,255,${SUNG_OPACITY}) ${p}%, rgba(255,255,255,${UNSUNG_OPACITY}) ${p}%)`
}
