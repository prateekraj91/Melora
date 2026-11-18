// Hardware media keys → player commands (v2 task 2.2).
//
// Registered as globalShortcuts ONLY while the fullscreen window is showing:
// the Spotify app also reacts to media keys natively, so holding them all the
// time could double-handle a press (SongSide toggles via the Web API AND
// Spotify toggles locally → no net change). While fullscreen is up the user
// is "in" SongSide, so we take them; on close we hand them back.
//
// macOS only lets an app see media keys as global shortcuts when it is a
// trusted accessibility client. We check without prompting; if not trusted
// (or registration fails) we log and carry on — the in-window keys still work.

import { globalShortcut, systemPreferences } from 'electron'

const KEYS = [
  ['MediaPlayPause', { type: 'toggle' }],
  ['MediaNextTrack', { type: 'next' }],
  ['MediaPreviousTrack', { type: 'prev' }]
]

/**
 * @param {(cmd: import('../../shared/types.js').PlayerCommand) => Promise<boolean>} runCommand
 */
export function createMediaKeys(runCommand) {
  const registered = new Set()

  return {
    enable() {
      if (registered.size) return
      if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(false)) {
        console.info(
          '[media-keys] not registered: app is not a trusted accessibility client ' +
            '(System Settings → Privacy & Security → Accessibility)'
        )
        return
      }
      for (const [accel, cmd] of KEYS) {
        let ok = false
        try {
          ok = globalShortcut.register(accel, () => runCommand(cmd))
        } catch (e) {
          console.warn(`[media-keys] ${accel} threw:`, e.message)
        }
        if (ok) registered.add(accel)
        else console.info(`[media-keys] could not register ${accel}`)
      }
      if (registered.size) console.info(`[media-keys] registered: ${[...registered].join(', ')}`)
    },
    disable() {
      for (const accel of registered) globalShortcut.unregister(accel)
      registered.clear()
    }
  }
}
