import { useEffect } from 'react'
import { acquireAudio, getAudioFrame } from './audioEngine.js'

/** @typedef {import('../../../shared/types.js').AudioFrame} AudioFrame */

/**
 * System-audio analysis for visuals (v2 task 1.7). Starts the shared capture
 * on mount, releases it on unmount, and returns a STABLE getter
 * `() => AudioFrame` to read inside requestAnimationFrame loops. Returns a
 * zero frame whenever audio is unavailable (no permission, not Electron…).
 *
 * @returns {() => AudioFrame}
 */
export function useAudioFrame() {
  useEffect(() => acquireAudio(), [])
  return getAudioFrame
}
