# SongSide v2 — Architecture

v2 adds a fullscreen listening mode, no-button controls (voice/gesture/keys),
in-app playback via the Spotify Web Playback SDK, local AI (Ollama `qwen3:8b`),
audio-reactive visuals and a screensaver — on top of the v1 overlay, which keeps
working unchanged.

This document is the contract later tasks build against. Task 1.1 laid the
foundation (IPC constants, shared types, the player store, the renderer bridge
and hooks); tasks 1.3–3.3 have since filled in the fullscreen window, lyrics,
background, audio, input, feedback and scene effects. Per-task notes,
decisions and the hand-test checklist live in `docs/v2/PROGRESS.md`.

## Processes and windows

| Window            | Status                                   | Route                | Purpose                                                                                                                              |
| ----------------- | ---------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Overlay**       | v1, live                                 | `/` (no hash)        | Small transparent always-on-top lyrics pill. Auto shows/hides off playback. ⌥⌘L toggles.                                             |
| **Fullscreen**    | live (`main/windows/fullscreen.js`, 1.3) | `#/fullscreen`       | Immersive listening mode. ⌥Space toggles, Esc closes.                                                                                |
| **Hidden player** | later (Web Playback SDK)                 | `#/player` (planned) | Invisible window that hosts the SDK so SongSide itself can be a Spotify Connect device (`device: 'songside'`). Feeds the same store. |

All windows load the **same renderer bundle** and pick their UI by hash
(`renderer/src/App.jsx`). All windows share the same preload.

## The player store — single source of truth

`main/state/playerStore.js` owns `PlayerState` and the current `LyricsDoc`
(typedefs in `shared/types.js`).

- **Producers** call `update(patch)` / `setLyricsDoc(doc)`. Today the only
  producer is the v1 lyrics engine (`main/lyrics.js`), which on each 3 s Spotify
  poll writes `track`, `status`, the position anchor, `volume` and
  `device: 'spotify-app'`; `idle`/`disconnected` when nothing plays; the
  `LyricsDoc` (all lines with `endTime`) when lyrics load; and the new anchor
  after a seek. The command executor (`main/spotify/commands.js`, 2.2a) also
  writes an **optimistic patch** (isPlaying / volume / anchor) the moment a
  command succeeds, then asks the engine to poll now and again 700 ms later
  so the real state replaces it. Later: the SDK window.
- `update` shallow-merges, compares `track` by id and arrays element-wise, and
  only if something changed notifies `subscribe()` listeners in main and
  broadcasts `player:state` to **every** BrowserWindow. `setLyricsDoc`
  broadcasts `lyrics:doc`.
- **Position is an anchor**: playback was `positionMs` at epoch `positionAt`.
  Main never ticks it. Renderers interpolate with `usePlaybackClock`.
- **Colour**: `main/index.js` subscribes to the store; when `track.art` changes
  it stores `color` (v1 dominant colour) and `palette`: five pastel `#rrggbb`
  colours from `color.getAlbumPalette` → `palette.pastelPalette` (OKLCH,
  L 0.78–0.88, C ≤ 0.09, gamut-mapped; 1.4). Renderers turn it into RGB floats
  with `visuals/palette.js` (`normalisePalette` always yields 5, neutral greys
  when empty).
- Renderers read it with `invoke(player:get-state)` / `invoke(lyrics:get-doc)` on
  mount, then follow the pushes (`usePlayer`).

The v1 `lyrics:update` per-line frames still flow to the overlay untouched.

## IPC

Every channel is declared once in `shared/ipc.js`:

- `INVOKE` — renderer → main request/response
- `SEND` — renderer → main fire-and-forget
- `PUSH` — main → renderer

The preload exposes the v1 methods, typed v2 helpers, and generic
`invoke/send/subscribe` that **reject any channel not declared in `ipc.js`**.
New features add their channel to `ipc.js` first.

## Renderer rules

1. **Bridge only.** v2 code reaches main exclusively through
   `renderer/src/bridge.js`, never `window.api`. The bridge is safe when
   `window.api` is missing (the screensaver will load the page outside
   Electron): getters resolve `null`, subscriptions are no-ops.
2. **No per-frame React state.** React state changes only on store pushes.
   Anything that moves every frame (position, word highlight, audio levels,
   particles) reads a getter (`now()`, `getActive()`, `getFrame()`) inside a
   `requestAnimationFrame` loop and writes to refs / canvas / CSS variables.
3. **Layer order** (back to front): **background → effects → lyrics → chrome**.
   Each is its own absolutely-positioned layer; effects never draw over lyrics.
4. **Colours come only from `state.palette`** (and `state.color`). No
   hard-coded hues in v2 visuals beyond neutral black/white.
5. Drop stale data: anything keyed by `trackId` that doesn't match
   `state.track.id` is ignored (`usePlayer` already does this for lyrics).
6. **Commands go through one path.** Keys, gestures (and later voice) build a
   `PlayerCommand` and call `runCommand(cmd)` from the bridge. In the
   fullscreen view they pass through `useFeedback().onCommand` first so every
   input gets its visual acknowledgement (2.6). Main executes it
   (`INVOKE.PLAYER_COMMAND` → `commands.js`); media keys call the same runner
   directly in main.
7. **Pure logic in plain modules, unit-tested with `node:test`** (`npm test`,
   files in `__tests__/`). React hooks / canvas code stay thin wrappers around
   them (e.g. `gestures.js` classifier vs `useGestures`, `feedback.js` vs
   `useFeedback.js`, `kit.js` vs the layers).

### Fullscreen layer stack (as built)

Inside one wrapper that gets `blur(6px) saturate(0.7)` while paused:
`DreamyBackground` (WebGL) → `EffectStack` (Canvas2D) → volume glow + volume
flash → lyrics wrapper (slides on skip) → `FadedLyrics` → chrome (track /
artist, fades when idle). Outside the blur: "paused", the ♥ bloom, the volume
label, the first-run hint, and in dev the scene name and the `AudioDebug`
overlay (D).

### Dev mock mode

`npm run dev:web` serves the renderer alone (`vite.web.config.mjs`, port
5174). With no Electron preload **and** `?mock` in the URL **and** a dev
build, the bridge routes state, lyrics and commands to `dev/mockPlayer.js`
and audio to `dev/mockAudio.js` (synthetic 120 bpm). Open
`http://localhost:5174/?mock#/fullscreen`. Production builds never include
this path.

## Folder layout

```
songside/
  docs/v2/ARCHITECTURE.md
  src/
    shared/
      ipc.js                 channel constants (INVOKE / SEND / PUSH)
      types.js               JSDoc typedefs
    main/
      index.js               app wiring, IPC, hotkeys
      lyrics.js              v1 LRCLIB engine (+ writes to the store, pollNow)
      state/playerStore.js   single source of truth
      windows/fullscreen.js  fullscreen controller (1.3; onShow/onHide hooks)
      palette.js             OKLCH pasteliser (1.4)
      audio/capture.js       system-audio loopback permission plumbing (1.7)
      spotify/commands.js    PlayerCommand → Web API executor (2.2a)
      input/mediaKeys.js     media keys while fullscreen is open (2.2)
      spotify.js color.js llm.js store.js tray.js   (v1)
    preload/index.js
    renderer/src/
      App.jsx                hash router
      bridge.js              only door to main for v2 code
      hooks/usePlayer.js     {state, lyrics}
      hooks/usePlaybackClock.js  stable now()
      fullscreen/Fullscreen.jsx  the listening-mode view
      fullscreen/useIdleHide.js  cursor / chrome idle (1.3, 1.5b)
      fullscreen/feedback.js useFeedback.js  button-free feedback (2.6)
      visuals/palette.js     palette parsing / mixing (1.4)
      visuals/background/    DreamyBackground + shader (1.4)
      visuals/effects/       kit.js, one file per scene, scenes.js, EffectStack.jsx (3.3)
      audio/                 analyser.js, audioEngine.js, useAudioFrame, pulse.js, AudioDebug (1.7 / 1.8)
      lyrics/                wordTiming, activeWord, fadedLayout, FadedLyrics (1.5 / 1.6)
      input/                 keys.js (2.2), gestures.js (2.3); voice later
      dev/                   mockPlayer.js, mockAudio.js (dev-only browser mock)
      components/ hooks/     v1 overlay
```

## Interfaces for later tasks

| Task | Where                                                   | Interface                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.3  | `main/windows/fullscreen.js`                            | `createFullscreenController() → { open, close, toggle, isOpen }` — real window (see header comment)                                                                                                                                                            |
| 1.4  | `renderer/src/visuals/background/`                      | `<DreamyBackground palette={string[]} energy={number \| () => number} />` — slow colour-field background from the palette                                                                                                                                      |
| 1.5  | `renderer/src/lyrics/`                                  | `addWordTimings(doc: LyricsDoc) → LyricsDoc` (fills `lines[].words`); `useActiveWord(doc, now) → getActive()` returning `{ line, word, wordProgress, lineProgress }` (indexes + 0–1 progress), no re-renders                                                   |
| 1.6  | `renderer/src/lyrics/`                                  | `<FadedLyrics doc={LyricsDoc} getActive={() => Active} />` — draws via rAF from the getter                                                                                                                                                                     |
| 1.7  | `renderer/src/audio/`                                   | `useAudioFrame() → getFrame()` returning `AudioFrame` `{ bass, mid, treble, energy, beat, bpm: number\|null }`; one shared, ref-counted capture (`acquireAudio`)                                                                                               |
| 2.2a | `main/spotify/commands.js`                              | `createCommandRunner(deps) → runCommand(cmd: PlayerCommand) → Promise<boolean>`; renderer reaches it via `runCommand(cmd)` in the bridge (`INVOKE.PLAYER_COMMAND`). `sleep` is not implemented yet (returns false)                                             |
| 2.2  | `renderer/src/input/keys.js`, `main/input/mediaKeys.js` | `useKeyboardControls({ onCommand, onClose })`; `createMediaKeys(run) → { enable, disable }`                                                                                                                                                                    |
| 2.3  | `renderer/src/input/gestures.js`                        | `createGestureClassifier()` (pure) + `useGestures(onCommand)`                                                                                                                                                                                                  |
| 2.6  | `renderer/src/fullscreen/useFeedback.js`                | `useFeedback({ lyricsDocId, volume }) → { refs, onCommand }`                                                                                                                                                                                                   |
| 3.1  | main (AI)                                               | `runTask(task: string, input) → Promise<AiResult>`; renderer via `invoke(INVOKE.AI_RUN, { task, input })`                                                                                                                                                      |
| 3.3  | `renderer/src/visuals/effects/<scene>.js`               | `export function create<Scene>() → EffectLayer`, registered in `scenes.js` (`SCENE_FACTORIES[name]`). `frame(t, dt, audio, fade)`; optional `setPalette` / `setIntensity`. `<EffectStack scene palette intensity getAudio />` draws and crossfades them (1.5s) |
| 3.2  | (next)                                                  | Replace the dev S cycler / `DEFAULT_SCENE` in `Fullscreen.jsx` with the AI `SceneChoice` (`scene` + `intensity`)                                                                                                                                               |

`player:command` is handled (2.2a). Reserved channels (declared, not yet
handled): `spotify:search`, `ai:run`, `scene:get`, `memory:ask`, `card:save`,
`voice:start`, `voice:stop`, `audio:beat`, `scene:update`, `voice:result`,
`sleep:update`.
