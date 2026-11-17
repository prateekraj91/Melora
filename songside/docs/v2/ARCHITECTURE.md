# SongSide v2 — Architecture

v2 adds a fullscreen listening mode, no-button controls (voice/gesture/keys),
in-app playback via the Spotify Web Playback SDK, local AI (Ollama `qwen3:8b`),
audio-reactive visuals and a screensaver — on top of the v1 overlay, which keeps
working unchanged.

This document is the contract later tasks build against. Task 1.1 laid the
foundation only: IPC constants, shared types, the player store, the renderer
bridge and hooks, and stubs.

## Processes and windows

| Window            | Status                                             | Route                | Purpose                                                                                                                              |
| ----------------- | -------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Overlay**       | v1, live                                           | `/` (no hash)        | Small transparent always-on-top lyrics pill. Auto shows/hides off playback. ⌥⌘L toggles.                                             |
| **Fullscreen**    | stub (`main/windows/fullscreen.js`) — built in 1.3 | `#/fullscreen`       | Immersive listening mode. ⌥Space toggles, Esc closes.                                                                                |
| **Hidden player** | later (Web Playback SDK)                           | `#/player` (planned) | Invisible window that hosts the SDK so SongSide itself can be a Spotify Connect device (`device: 'songside'`). Feeds the same store. |

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
  after a seek. Later: the SDK window and the command layer.
- `update` shallow-merges, compares `track` by id and arrays element-wise, and
  only if something changed notifies `subscribe()` listeners in main and
  broadcasts `player:state` to **every** BrowserWindow. `setLyricsDoc`
  broadcasts `lyrics:doc`.
- **Position is an anchor**: playback was `positionMs` at epoch `positionAt`.
  Main never ticks it. Renderers interpolate with `usePlaybackClock`.
- **Colour**: `main/index.js` subscribes to the store; when `track.art` changes
  it runs the v1 `getAlbumColor` and stores `color` + `palette` (currently
  `[color]`; a richer palette can be extracted later without changing
  consumers).
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
      lyrics.js              v1 LRCLIB engine (+ writes to the store)
      state/playerStore.js   single source of truth
      windows/fullscreen.js  fullscreen controller (stub → 1.3)
      spotify.js color.js llm.js store.js tray.js   (v1)
    preload/index.js
    renderer/src/
      App.jsx                hash router
      bridge.js              only door to main for v2 code
      hooks/usePlayer.js     {state, lyrics}
      hooks/usePlaybackClock.js  stable now()
      fullscreen/Fullscreen.jsx  placeholder → 1.3+
      visuals/background/    1.4
      visuals/effects/       3.3 scene effects
      audio/                 1.7 analysis
      lyrics/                1.5 / 1.6
      input/                 2.x voice / gesture / keys
      components/ hooks/     v1 overlay
```

## Interfaces for later tasks

| Task | Where                                     | Interface                                                                                                                                                                                                    |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.3  | `main/windows/fullscreen.js`              | `createFullscreenController() → { open, close, toggle, isOpen }` — real window (see header comment)                                                                                                          |
| 1.4  | `renderer/src/visuals/background/`        | `<DreamyBackground palette={string[]} energy={number \| () => number} />` — slow colour-field background from the palette                                                                                    |
| 1.5  | `renderer/src/lyrics/`                    | `addWordTimings(doc: LyricsDoc) → LyricsDoc` (fills `lines[].words`); `useActiveWord(doc, now) → getActive()` returning `{ line, word, wordProgress, lineProgress }` (indexes + 0–1 progress), no re-renders |
| 1.6  | `renderer/src/lyrics/`                    | `<FadedLyrics doc={LyricsDoc} getActive={() => Active} />` — draws via rAF from the getter                                                                                                                   |
| 1.7  | `renderer/src/audio/`                     | `useAudioFrame() → getFrame()` returning `AudioFrame` `{ bass, mid, treble, energy, beat, bpm }`                                                                                                             |
| 2.1  | main (command layer)                      | `runCommand(cmd: PlayerCommand) → Promise<boolean>`; renderer reaches it via `invoke(INVOKE.PLAYER_COMMAND, cmd)`                                                                                            |
| 3.1  | main (AI)                                 | `runTask(task: string, input) → Promise<AiResult>`; renderer via `invoke(INVOKE.AI_RUN, { task, input })`                                                                                                    |
| 3.3  | `renderer/src/visuals/effects/<scene>.js` | `export default () => EffectLayer` — one file per `SceneName` (`christmas`, `rock`, `rain`, `love`, `edm`, `chill`, `hiphop`)                                                                                |

Reserved channels (declared, not yet handled): `player:command`,
`spotify:search`, `ai:run`, `scene:get`, `memory:ask`, `card:save`,
`voice:start`, `voice:stop`, `audio:beat`, `scene:update`, `voice:result`,
`sleep:update`.
