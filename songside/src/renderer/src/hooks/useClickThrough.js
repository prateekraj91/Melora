import { useEffect } from 'react'

// Makes the overlay window click-through everywhere except over real interactive
// content, so the apps behind it stay clickable.
//
// The window is created ignoring mouse events with `forward: true`, which means
// we still receive mousemove events even while clicks pass straight through. On
// each move we hit-test the element under the cursor: if it (or an ancestor) is
// marked `[data-interactive]` — a lyric line, the Connect button, the plain
// lyric scroller — we ask the main process to capture clicks there; over any
// transparent gap we hand control back so the click lands on whatever is behind
// the overlay.
export function useClickThrough() {
  useEffect(() => {
    let interactive = false
    const set = (next) => {
      if (next === interactive) return
      interactive = next
      window.api.setInteractive(next)
    }

    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      set(!!el && !!el.closest('[data-interactive]'))
    }
    // Cursor left the window entirely → always hand clicks back.
    const onLeave = () => set(false)

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      if (interactive) window.api.setInteractive(false)
    }
  }, [])
}
