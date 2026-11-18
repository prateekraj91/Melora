// System-audio capture plumbing for the v2 visuals (task 1.7).
//
// The renderer calls navigator.mediaDevices.getDisplayMedia({audio, video});
// we answer automatically (no picker) with the first screen and
// `audio: 'loopback'` (system audio). The renderer stops the video track
// immediately — we only want the audio.
//
// macOS: Electron's docs say loopback audio is Windows-only, but this build's
// Chromium ships the `MacCatapLoopbackAudioForScreenShare` feature (Core Audio
// taps, macOS 14.2+), which makes 'loopback' work on macOS. It must be enabled
// on the command line before the app is ready — see enableLoopbackFeatures().
// First use triggers the macOS "Screen & System Audio Recording" permission;
// if it is denied or anything fails we deny the request, the renderer's
// getDisplayMedia rejects, and the visuals simply run without audio.

import { app, desktopCapturer, session } from 'electron'

export const MAC_LOOPBACK_FEATURE = 'MacCatapLoopbackAudioForScreenShare'

/** Call at module top level in main/index.js (before app 'ready'). */
export function enableLoopbackFeatures() {
  if (process.platform !== 'darwin') return
  const existing = app.commandLine.getSwitchValue('enable-features')
  const features = existing ? `${existing},${MAC_LOOPBACK_FEATURE}` : MAC_LOOPBACK_FEATURE
  app.commandLine.appendSwitch('enable-features', features)
}

/** Call once after app 'ready'. */
export function registerDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 0, height: 0 }
        })
        if (!sources.length) {
          console.warn('[audio] no screen source (Screen Recording permission denied?) — no audio')
          callback({})
          return
        }
        callback({ video: sources[0], audio: 'loopback' })
      } catch (e) {
        console.warn('[audio] display-media request failed — visuals run silently:', e.message)
        try {
          callback({})
        } catch {
          /* already answered */
        }
      }
    },
    { useSystemPicker: false }
  )
}
