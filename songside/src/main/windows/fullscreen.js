// Fullscreen listening-mode window controller — STUB (v2 task 1.1).
//
// The interface is final; the implementation is a no-op so the IPC
// (SEND.WINDOW_FULLSCREEN_TOGGLE / _CLOSE) and the Alt+Space hotkey can be
// wired now.
//
// What task 1.3 must build here:
//   • open(): lazily create ONE BrowserWindow that covers the display the
//     cursor is on (simpleFullscreen / kiosk-style, frameless, black
//     backgroundColor, no traffic lights), using the same preload as the
//     overlay, and load the renderer at the '#/fullscreen' hash route
//     (ELECTRON_RENDERER_URL + '#/fullscreen' in dev, loadFile with
//     { hash: '/fullscreen' } in prod). Show it focused and fade in.
//   • While open, hide the v1 overlay (it must come back on close with its
//     normal auto show/hide behaviour) and keep the window on the active Space.
//   • close(): fade out, then hide (keep the window warm for a quick reopen),
//     restore the overlay, and give focus back to the previous app.
//   • toggle(): open if closed, close if open. isOpen(): visible & not destroyed.
//   • The window renders entirely from playerStore broadcasts (player:state,
//     lyrics:doc), which reach it automatically because the store broadcasts
//     to every BrowserWindow. It must not poll Spotify itself.
//   • Esc in the renderer sends window:fullscreen-close; Alt+Space toggles.

/**
 * Task 1.3 will take deps here (e.g. `{ overlay }` from main/index.js, to hide
 * the overlay while fullscreen is open); the stub ignores them.
 * @returns {{ open: () => void, close: () => void, toggle: () => void, isOpen: () => boolean }}
 */
export function createFullscreenController() {
  let open = false
  return {
    open() {
      open = true
      console.log('[fullscreen] open (stub — implemented in task 1.3)')
    },
    close() {
      open = false
      console.log('[fullscreen] close (stub — implemented in task 1.3)')
    },
    toggle() {
      if (open) this.close()
      else this.open()
    },
    isOpen: () => open
  }
}
