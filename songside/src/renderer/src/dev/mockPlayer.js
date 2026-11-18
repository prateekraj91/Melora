// DEV-ONLY mock player, used by bridge.js when there is no Electron preload
// (window.api missing) AND the URL has `?mock`. Lets the fullscreen visuals be
// developed / checked in a plain browser: `npm run dev:web`, then open
// http://localhost:5174/?mock#/fullscreen
//
// Provides a looping 60-second "track" with timed lyric lines and a pastel
// palette. Never used in a production build path with a preload present.

/** @typedef {import('../../../shared/types.js').PlayerState} PlayerState */
/** @typedef {import('../../../shared/types.js').LyricsDoc} LyricsDoc */

const LINES = [
  'Hold on to the night a little longer',
  'मैं सुनता रहूँ तेरी धड़कन',
  'Every streetlight hums your name',
  'And the city sleeps like a slow song',
  '',
  'Wait for me where the river bends, where the evening turns to gold and we forget the time',
  'ਮੈਂ ਸੁੱਤਾ ਨਹੀਓਂ ਉਸ ਦਿਨ ਦਾ',
  'Do you know',
  'Stay',
  'We were never meant to be this quiet'
]
const LINE_MS = 4500
const START_MS = 3000
const DURATION = START_MS + LINES.length * LINE_MS + 3000

export const MOCK_PALETTE = ['#f1b9b4', '#d3bdf0', '#a9d3ec', '#a6d8b8', '#eed2a8']

const t0 = Date.now()

/** @returns {PlayerState} */
export function mockState() {
  const elapsed = (Date.now() - t0) % DURATION
  return {
    connected: true,
    status: 'playing',
    track: {
      id: 'mock-track',
      uri: 'spotify:track:mock',
      name: 'Mock Song (dev)',
      artist: 'SongSide',
      album: 'Dev',
      art: null,
      durationMs: DURATION
    },
    positionMs: elapsed,
    positionAt: Date.now(),
    isPlaying: true,
    volume: 60,
    device: null,
    color: MOCK_PALETTE[0],
    palette: MOCK_PALETTE
  }
}

/** @returns {LyricsDoc} */
export function mockLyrics() {
  return {
    trackId: 'mock-track',
    mode: 'synced',
    plain: null,
    lines: LINES.map((text, i) => ({
      time: START_MS + i * LINE_MS,
      endTime: START_MS + (i + 1) * LINE_MS,
      text
    }))
  }
}

export const isMock = () =>
  typeof window !== 'undefined' && !window.api && /[?&]mock\b/.test(window.location.search)
