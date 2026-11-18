# SongSide v2 — Progress log

Overnight unattended run (2026-11-18 → 19), branch `v2`, one commit per task,
nothing pushed. Every task was gated on `npx electron-vite build`,
`npx eslint src` (only the 3 pre-existing v1 warnings remain) and `npm test`.

**How things were checked overnight:** no screen control was used. Visuals were
checked in a plain browser with a dev-only mock player:

```bash
npm run dev:web
```

then open `http://localhost:5174/?mock#/fullscreen`. The mock (see
`src/renderer/src/dev/mockPlayer.js`) is only active when there is no Electron
preload AND the URL has `?mock`, and only in dev builds. It plays a looping
fake song with English / Hindi / Punjabi lines, an empty line, and a very long
line. Anything that needs Electron, Spotify or system audio is marked
**untested live** below.

---

## 1.6 — Faded lyrics

**Built**

- `lyrics/FadedLyrics.jsx` (props `{doc, getActive}`): active line centred at
  4.2vw, one line above, two below (2.4vw-equivalent), Inter 200 via
  `@fontsource/inter` (fallback -apple-system).
- Sung words 0.85 opacity + soft white glow; the current word fills
  left→right with a `background-clip:text` gradient; unsung words 0.18.
- Neighbours: 0.10 opacity / blur 1.5px; the line two below 0.06 / 2.5px.
- Line change animates over 500ms `cubic-bezier(.2,.7,.2,1)`: the old line
  rises into the "above" slot and fades, the next one rises into the centre, a
  leaving line fades out 24px above, an entering one fades in 24px below.
- One rAF loop paints word styles straight onto span refs; React re-renders
  only when the active line index changes. Plain / none lyrics render nothing.
  Long lines wrap to at most 2 lines (line-clamp), centred, max-width 80vw.
- `Fullscreen.jsx`: the underline test is gone; track name / artist are a small
  bottom-left chrome at 0.35 opacity that fades out when idle.
- Pure layout maths in `lyrics/fadedLayout.js` (slot offsets, word looks, fill
  gradient), unit-tested in `lyrics/__tests__/fadedLayout.test.js`.
- Dev tooling: `npm run dev:web` (`vite.web.config.mjs`) + the `?mock` player
  in `bridge.js`.

**Decisions**

- Every line is laid out at the active font size and neighbours are drawn with
  `transform: scale(2.4/4.2)`, so slot changes animate on the compositor
  (transform/opacity/filter) with no font-size reflow. Side effect: a
  neighbour line wraps at the same point it will wrap when it becomes active.
- Slot positions are computed from measured line heights (so a 2-line active
  line pushes its neighbours out) and re-measured on resize.
- The lyrics stay visible when idle; only the cursor and the chrome hide.
- The current word skips the glow while it fills (text-shadow would show
  through the transparent fill) and gains it once sung.

**Untested live:** in the real fullscreen window with a Spotify song (checked
only in the browser mock).

**Check by hand:** see the morning checklist at the end.

---

## 1.4 — Dreamy background

**Built**

- Main: `main/palette.js` (pure): sRGB ⇄ OKLCH (Ottosson's OKLab), pastelise
  (L clamped 0.78–0.88, chroma ≤ 0.09, hue kept, then chroma reduced further
  only if needed to stay inside sRGB), `pastelPalette()` → exactly 5
  `#rrggbb`. Tested in `main/__tests__/palette.test.js` (reference values
  for sRGB red/green/blue, round trips, gamut mapping, clamps).
- `main/color.js`: new `getAlbumPalette(url)` (colorthief `getPalette`,
  colorCount 5), sharing one cached download per art URL with the v1
  `getAlbumColor`. Caches are now capped at 64 entries.
- `main/index.js`: the existing store subscriber now writes
  `palette` (5 pastels) **and** keeps `color`; if palette extraction fails it
  falls back to `[color]`.
- `visuals/background/DreamyBackground.jsx` + `shader.js`: WebGL1 fullscreen
  triangle, 5 gaussian blobs (one per colour) drifting on slow orbits, value-
  noise warping, vignette, per-frame dither. `energy()` grows blob radius
  (+25%) and brightness. Palette changes crossfade over 2s (smoothstep, on
  the CPU, uploaded as uniforms). DPR ≤ 1.5, ResizeObserver, stops its rAF
  while the document is hidden, handles `webglcontextlost`/`restored`, CSS
  radial-gradient fallback if WebGL can't start.
- `visuals/palette.js` (pure, tested): parse `#hex` / `rgb()` / `hsl()` (the v1
  colour format, used by the fallback), normalise to 5, crossfade helpers.
- Layered behind the lyrics in `Fullscreen.jsx` with `energy={() => 0}`.

**Decisions**

- Palette is stored as `#rrggbb` (not `oklch()` strings) so CSS, Canvas2D and
  WebGL can all use it without a colour-space parser.
- The blobs are drawn at ~30% brightness over a near-black base derived from
  the palette, because pastels at full brightness would make the white lyrics
  unreadable. If it looks too dark in the morning, raise `brightness` in
  `shader.js` (one number).

**Checked overnight:** in the browser mock (tinted soft field, lyrics
readable), WebGL context loss → restore via `WEBGL_lose_context` (renders
again), and `getPalette` on a Node Buffer with a generated test image.

**Untested live:** real album art → palette in Electron, the 2s crossfade on a
real track change, the CSS fallback path.

---

## 1.7 — System audio + beats

**Built**

- Main `main/audio/capture.js`: `setDisplayMediaRequestHandler` answers every
  `getDisplayMedia` with the first `desktopCapturer` screen and
  `audio: 'loopback'` (no picker). Any failure or no source → logged and the
  request is denied, so the renderer just runs silently.
- **macOS loopback switch:** Electron's typings say loopback is Windows-only,
  but this castLabs 42.11.18 build's Chromium contains the feature
  `MacCatapLoopbackAudioForScreenShare` (Core Audio taps, macOS 14.2+; this
  Mac is on 26.3.1). `enableLoopbackFeatures()` appends it to
  `--enable-features` before `ready`. Also added
  `NSAudioCaptureUsageDescription` to `electron-builder.yml` for packaged
  builds (the dev Electron.app already has one).
- `audio/analyser.js` (pure, 14 tests on synthetic spectra): bass 20–150 Hz,
  mid 150–2k, treble 2–12k; per-band auto-gain against a peak with a 4s
  half-life; spectral flux ≤ 4 kHz vs adaptive threshold mean + 1.5·std over
  the last 1s; 280ms refractory; bpm = median inter-beat interval folded into
  70–180, `null` until ≥ 4 consistent intervals. Allocation-free per frame.
- `audio/audioEngine.js` + `audio/useAudioFrame.js`: ONE shared, ref-counted
  capture (getDisplayMedia → stop video track → AudioContext → AnalyserNode
  fftSize 2048 / smoothing 0.6, not connected to the speakers). The hook
  returns a stable getter; zero frame when unavailable.
- Dev only: **D** in fullscreen toggles `audio/AudioDebug.jsx` (bars, bpm,
  capture status, beat flash).
- `AudioFrame.bpm` is now `number|null` in `shared/types.js`.

**Decisions**

- Capture **stops while the fullscreen window is hidden** (it's hidden, not
  destroyed) and restarts when shown, so macOS isn't recording in the
  background and the menu-bar recording indicator goes away when you close
  fullscreen. (Spec said start on mount / stop on unmount; the component
  never unmounts, so visibility is the meaningful lifetime.)
- Chromium may demand a user gesture for `getDisplayMedia`. If the first
  attempt fails with `InvalidStateError`/`NotAllowedError`, it retries once
  on the next click or key press.
- Outside Electron (browser / future screensaver) the engine never calls
  `getDisplayMedia` (it would open the browser's picker). With `?mock` in dev
  it feeds a synthetic 120 bpm frame instead (`dev/mockAudio.js`).

**Checked overnight:** analyser unit tests; the D overlay in the browser mock
(bars move, bpm 120, flash on beats).

**Untested live (important):** real system-audio capture. On first fullscreen
open macOS should ask for **Screen & System Audio Recording** permission for
Electron (dev) / songside (packaged). Grant it, then you may have to close and
reopen fullscreen (or restart the app). Check the terminal for `[audio]` lines
(`running (48000 Hz)` = good; `capture failed …` = tell me the message).

---

## 1.8 — Pulse + volume glow

**Built**

- `audio/pulse.js` (pure, tested): `stepPulse` — target = 0.35·bass +
  0.15·energy; a beat adds +0.25 (cap 1); every frame pulse += (target −
  pulse)·0.12. `glowOpacity(volume)` = 0.02 + volume/100·0.06.
- `Fullscreen.jsx`: one rAF loop updates `pulse.current` (a ref) from
  `useAudioFrame()`; the background gets `energy={() => pulse.current}`
  (a stable function).
- A fixed radial white glow layer between the background and the lyrics;
  opacity from `state.volume` with a 400ms transition.

**Decisions:** unknown volume (`null`, e.g. before the first poll or when
Spotify doesn't report a device) is treated as 50.

**Checked overnight:** in the browser mock with synthetic 120 bpm audio the
background's mean brightness pulses ≈ 45 → 50 (of 255) twice a second.

**Untested live:** with real audio; the glow responding to a real volume
change (Spotify's currently-playing endpoint only sometimes includes the
device volume — see 2.2a for the command path that sets it).

---

## 2.2a — Command executor (Web API)

**Built**

- `main/spotify/commands.js`: `commandToRequest(cmd, state)` (pure),
  `optimisticPatch(cmd, state)` (pure) and `createCommandRunner(deps)` →
  `runCommand(cmd)`, behind `INVOKE.PLAYER_COMMAND` (wired in
  `main/index.js`). Supports play, pause, toggle, next, prev, seek, volume,
  volumeDelta, playUri (track → `uris`, album/playlist/artist →
  `context_uri`), queue, like (`PUT /me/tracks?ids=`).
- Errors: 401 → refresh token and retry once; 403 (logs Spotify's reason,
  e.g. `PREMIUM_REQUIRED`, `VOLUME_CONTROL_DISALLOW`) and 404 (no active
  device) → `false` + log; network errors → `false`. Never throws.
- After success: the store gets an optimistic patch at once (play state +
  re-anchored position, volume, seek), then `pollNow()` (new export in
  `main/lyrics.js`) re-reads Spotify immediately and again after 700ms.
- Scopes: added `user-library-modify` and `user-library-read`.
- `bridge.js`: `runCommand(cmd)` (resolves `false` without Electron). In the
  dev `?mock` mode commands drive the mock player (two mock tracks), so input
  and feedback can be exercised in a browser.
- 32 tests in `main/__tests__/commands.test.js` (mapping table, clamps,
  optimistic patches, 401 retry, 403/404/500/network, not connected).

**Decisions**

- `sleep` is accepted by the type but returns `false` and logs "not
  implemented" — the sleep timer is a later task.
- The extra 700ms re-poll is because Spotify's currently-playing lags a
  `next` by a few hundred ms.

**ACTION NEEDED (once):** the new library scopes need fresh consent —
**menu-bar tray → Reconnect Spotify** before testing "like". Until then like
returns 403 (logged as `forbidden (403 …)`), everything else works.

**Untested live:** every command against the real Spotify app. Volume via
the Web API may be refused for some devices (403 `VOLUME_CONTROL_DISALLOW`).
