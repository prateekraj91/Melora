import { useEffect, useRef, useState } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel']

/**
 * True once there has been no mouse / key / wheel activity for `delayMs`;
 * back to false on the next activity. The window becoming visible or focused
 * also counts as activity: the fullscreen window is reopened with a global
 * hotkey the page never sees, so without this it would come back blank.
 * Re-renders only on the idle ↔ active transition, never per mousemove.
 *
 * @param {number} [delayMs=3000]
 * @returns {boolean}
 */
export function useIdleHide(delayMs = 3000) {
  const [idle, setIdle] = useState(false)
  const idleRef = useRef(false)

  useEffect(() => {
    let timer = 0
    const goIdle = () => {
      idleRef.current = true
      setIdle(true)
    }
    const onActivity = () => {
      if (idleRef.current) {
        idleRef.current = false
        setIdle(false)
      }
      clearTimeout(timer)
      timer = setTimeout(goIdle, delayMs)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') onActivity()
    }

    timer = setTimeout(goIdle, delayMs)
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true })
    window.addEventListener('focus', onActivity)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer)
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity)
      window.removeEventListener('focus', onActivity)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [delayMs])

  return idle
}
