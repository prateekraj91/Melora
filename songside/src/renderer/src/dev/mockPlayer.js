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

const TRACKS = [
  { id: 'mock-track', name: 'Mock Song (dev)', palette: MOCK_PALETTE },
  {
    id: 'mock-track-2',
    name: 'Second Mock Song',
    palette: ['#b9d4f1', '#c8f0d8', '#f0e1b4', '#e3c2ef', '#b8ebe6']
  }
]

// Mutable mock playback: an anchor like the real store, changed by commands.
const mock = {
  trackIndex: 0,
  positionMs: 0,
  positionAt: Date.now(),
  isPlaying: true,
  volume: 60
}
const stateListeners = new Set()
const lyricListeners = new Set()

function positionNow() {
  const p = mock.positionMs + (mock.isPlaying ? Date.now() - mock.positionAt : 0)
  return p % DURATION
}

/** @returns {PlayerState} */
export function mockState() {
  const t = TRACKS[mock.trackIndex]
  return {
    connected: true,
    status: mock.isPlaying ? 'playing' : 'paused',
    track: {
      id: t.id,
      uri: `spotify:track:${t.id}`,
      name: t.name,
      artist: 'SongSide',
      album: 'Dev',
      art: null,
      durationMs: DURATION
    },
    positionMs: positionNow(),
    positionAt: Date.now(),
    isPlaying: mock.isPlaying,
    volume: mock.volume,
    device: null,
    color: t.palette[0],
    palette: t.palette
  }
}

/** @returns {LyricsDoc} */
export function mockLyrics() {
  return {
    trackId: TRACKS[mock.trackIndex].id,
    mode: 'synced',
    plain: null,
    lines: LINES.map((text, i) => ({
      time: START_MS + i * LINE_MS,
      endTime: START_MS + (i + 1) * LINE_MS,
      text
    }))
  }
}

export function onMockState(cb) {
  stateListeners.add(cb)
  return () => stateListeners.delete(cb)
}

export function onMockLyrics(cb) {
  lyricListeners.add(cb)
  return () => lyricListeners.delete(cb)
}

function emit(trackChanged = false) {
  const st = mockState()
  stateListeners.forEach((cb) => cb(st))
  if (trackChanged) {
    const doc = mockLyrics()
    lyricListeners.forEach((cb) => cb(doc))
  }
}

/**
 * Apply a PlayerCommand to the mock (dev browser only). Mirrors what the real
 * executor + store would do, so input and feedback can be checked offline.
 * @param {import('../../../shared/types.js').PlayerCommand} cmd
 * @returns {boolean}
 */
export function mockCommand(cmd) {
  console.info('[mock] command', cmd)
  const reanchor = () => {
    mock.positionMs = positionNow()
    mock.positionAt = Date.now()
  }
  switch (cmd?.type) {
    case 'play':
    case 'pause':
    case 'toggle':
      reanchor()
      mock.isPlaying = cmd.type === 'toggle' ? !mock.isPlaying : cmd.type === 'play'
      emit()
      return true
    case 'next':
    case 'prev':
      mock.trackIndex =
        (mock.trackIndex + (cmd.type === 'next' ? 1 : TRACKS.length - 1)) % TRACKS.length
      mock.positionMs = 0
      mock.positionAt = Date.now()
      emit(true)
      return true
    case 'seek':
      mock.positionMs = Math.max(0, cmd.positionMs)
      mock.positionAt = Date.now()
      emit()
      return true
    case 'volume':
    case 'volumeDelta':
      mock.volume = Math.max(
        0,
        Math.min(100, Math.round(cmd.type === 'volume' ? cmd.value : mock.volume + cmd.delta))
      )
      emit()
      return true
    case 'like':
      return true
    default:
      return false
  }
}

export const isMock = () =>
  typeof window !== 'undefined' && !window.api && /[?&]mock\b/.test(window.location.search)
