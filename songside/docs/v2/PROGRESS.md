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
