// "Pulse" — one smoothed 0–1 value derived from the audio frame, used as the
// background's energy (v2 task 1.8). Pure; unit-tested.
//
//   target = 0.35·bass + 0.15·energy
//   on a beat: pulse = min(1, pulse + 0.25)
//   every frame: pulse += (target − pulse) · 0.12

export const BASS_WEIGHT = 0.35
export const ENERGY_WEIGHT = 0.15
export const BEAT_KICK = 0.25
export const FOLLOW = 0.12

/**
 * @param {number} pulse  previous value
 * @param {{bass:number, energy:number, beat:boolean}} f
 * @returns {number}
 */
export function stepPulse(pulse, f) {
  const target = BASS_WEIGHT * f.bass + ENERGY_WEIGHT * f.energy
  let p = pulse
  if (f.beat) p = Math.min(1, p + BEAT_KICK)
  p += (target - p) * FOLLOW
  return Math.min(1, Math.max(0, p))
}

/**
 * Volume glow opacity: 0.02 + volume/100 · 0.06 (volume null → treated as 50).
 * @param {number|null|undefined} volume 0–100
 */
export function glowOpacity(volume) {
  const v = Number.isFinite(volume) ? Math.min(100, Math.max(0, volume)) : 50
  return 0.02 + (v / 100) * 0.06
}
