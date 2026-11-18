// Trackpad / mouse gestures for the fullscreen window (v2 task 2.3).
//
//   two-finger swipe left / right   next / previous track (one per gesture)
//   two-finger swipe up / down      volume ±5, continuous, ≤ 1 step / 120ms
//   click                           play / pause
//   press and hold (≥ 600ms)        like
//
// `createGestureClassifier()` is a pure, time-driven state machine (every
// input carries its own timestamp) and is unit-tested with synthetic event
// sequences; `useGestures()` feeds it real DOM events.
//
// Wheel "gestures" are bursts of wheel events; a gesture ends after 150ms
// with no wheel event. macOS momentum scrolling keeps emitting events after
// the fingers lift, so a fling stays ONE gesture (one skip). After a skip,
// further horizontal swipes are ignored until 400ms after that gesture's
// last event, so a momentum tail split by a short gap can't skip twice.
//
// Direction (macOS, natural scrolling on): swiping the fingers left gives
// positive deltaX → next; fingers up gives positive deltaY → volume up.

import { useEffect, useRef } from 'react'

/** @typedef {import('../../../shared/types.js').PlayerCommand} PlayerCommand */

export const GESTURE_GAP_MS = 150
export const SWIPE_MIN = 120
export const SWIPE_RATIO = 2
export const SWIPE_COOLDOWN_MS = 400
export const VOLUME_THROTTLE_MS = 120
export const VOLUME_STEP = 5
export const VOLUME_MIN_DY = 12
export const VERTICAL_LOCK = 30
export const CLICK_MAX_MS = 250
export const MOVE_TOLERANCE = 6
export const HOLD_MS = 600

export function createGestureClassifier() {
  // wheel gesture state
  let lastWheelT = -Infinity
  let sumX = 0
  let sumY = 0
  let axis = null // null | 'x' | 'y'
  let pendingY = 0
  let lastVolumeT = -Infinity
  let swipeBlockedUntil = -Infinity
  let firedThisGesture = false

  // pointer state
  let down = null // { t, x, y, moved, held }

  const newGesture = () => {
    sumX = sumY = pendingY = 0
    axis = null
    firedThisGesture = false
  }

  return {
    /**
     * @param {{ t: number, deltaX: number, deltaY: number, ctrlKey?: boolean }} e
     * @returns {PlayerCommand[]}
     */
    wheel(e) {
      const out = []
      if (e.ctrlKey) return out // pinch-zoom on macOS arrives as ctrl+wheel
      if (e.t - lastWheelT > GESTURE_GAP_MS) newGesture()
      lastWheelT = e.t
      if (firedThisGesture) swipeBlockedUntil = e.t + SWIPE_COOLDOWN_MS

      sumX += e.deltaX || 0
      sumY += e.deltaY || 0

      // Horizontal swipe → one skip per gesture.
      if (
        axis !== 'y' &&
        !firedThisGesture &&
        Math.abs(sumX) > SWIPE_MIN &&
        Math.abs(sumX) > SWIPE_RATIO * Math.abs(sumY)
      ) {
        axis = 'x'
        firedThisGesture = true
        if (e.t >= swipeBlockedUntil) out.push({ type: sumX > 0 ? 'next' : 'prev' })
        swipeBlockedUntil = e.t + SWIPE_COOLDOWN_MS
        return out
      }

      // Vertical → continuous volume, once the gesture is clearly vertical.
      if (axis === null && Math.abs(sumY) > VERTICAL_LOCK && Math.abs(sumY) > Math.abs(sumX)) {
        axis = 'y'
      }
      if (axis === 'y') {
        pendingY += e.deltaY || 0
        if (e.t - lastVolumeT >= VOLUME_THROTTLE_MS && Math.abs(pendingY) >= VOLUME_MIN_DY) {
          out.push({ type: 'volumeDelta', delta: pendingY > 0 ? VOLUME_STEP : -VOLUME_STEP })
          pendingY = 0
          lastVolumeT = e.t
        }
      }
      return out
    },

    /** @param {{ t: number, x: number, y: number, button?: number }} e */
    pointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return []
      down = { t: e.t, x: e.x, y: e.y, moved: false, held: false }
      return []
    },

    /** @param {{ t: number, x: number, y: number }} e */
    pointerMove(e) {
      if (down && Math.hypot(e.x - down.x, e.y - down.y) >= MOVE_TOLERANCE) down.moved = true
      return []
    },

    /** @param {{ t: number, x: number, y: number }} e @returns {PlayerCommand[]} */
    pointerUp(e) {
      if (!down) return []
      const d = down
      down = null
      if (Math.hypot(e.x - d.x, e.y - d.y) >= MOVE_TOLERANCE) d.moved = true
      if (d.held || d.moved) return []
      if (e.t - d.t < CLICK_MAX_MS) return [{ type: 'toggle' }]
      return []
    },

    pointerCancel() {
      down = null
      return []
    },

    /**
     * Advance time without input (call ~HOLD_MS after pointerDown) so a
     * still press-and-hold fires `like` while the button is still down.
     * @param {number} t
     * @returns {PlayerCommand[]}
     */
    tick(t) {
      if (down && !down.held && !down.moved && t - down.t >= HOLD_MS) {
        down.held = true
        return [{ type: 'like' }]
      }
      return []
    }
  }
}

/**
 * Attach the classifier to window wheel / pointer events.
 * @param {(cmd: PlayerCommand) => void} onCommand
 */
export function useGestures(onCommand) {
  const cb = useRef(onCommand)
  useEffect(() => {
    cb.current = onCommand
  })
  useEffect(() => {
    const g = createGestureClassifier()
    const emit = (cmds) => cmds.forEach((c) => cb.current(c))
    let holdTimer = 0
    const now = () => performance.now()

    const onWheel = (e) =>
      emit(g.wheel({ t: now(), deltaX: e.deltaX, deltaY: e.deltaY, ctrlKey: e.ctrlKey }))
    const onDown = (e) => {
      emit(g.pointerDown({ t: now(), x: e.clientX, y: e.clientY, button: e.button }))
      clearTimeout(holdTimer)
      holdTimer = setTimeout(() => emit(g.tick(now())), HOLD_MS + 10)
    }
    const onMove = (e) => emit(g.pointerMove({ t: now(), x: e.clientX, y: e.clientY }))
    const onUp = (e) => {
      clearTimeout(holdTimer)
      emit(g.pointerUp({ t: now(), x: e.clientX, y: e.clientY }))
    }
    const onCancel = () => {
      clearTimeout(holdTimer)
      g.pointerCancel()
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      clearTimeout(holdTimer)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [])
}
