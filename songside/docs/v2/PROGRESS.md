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
