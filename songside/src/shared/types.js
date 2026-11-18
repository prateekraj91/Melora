// Shared JSDoc typedefs for SongSide v2. No runtime code — import types with
// `/** @typedef {import('../shared/types.js').PlayerState} PlayerState */`.

/**
 * @typedef {Object} Track
 * @property {string} id         Spotify track id
 * @property {string} uri        spotify:track:… URI
 * @property {string} name
 * @property {string} artist     Comma-joined artist names
 * @property {string} album
 * @property {string|null} art   Largest album-art URL
 * @property {number} durationMs
 */

/**
 * Single source of truth for playback, owned by main (state/playerStore.js).
 * Position is an ANCHOR: playback was `positionMs` into the track at wall-clock
 * `positionAt`. Consumers interpolate (see usePlaybackClock); it never ticks.
 *
 * @typedef {Object} PlayerState
 * @property {boolean} connected  A Spotify token exists
 * @property {'playing'|'paused'|'idle'|'disconnected'} status
 * @property {Track|null} track
 * @property {number} positionMs  Position at the anchor
 * @property {number} positionAt  Epoch ms the anchor was taken
 * @property {boolean} isPlaying
 * @property {number|null} volume 0–100, null if unknown
 * @property {'spotify-app'|'songside'|null} device  Who is producing audio
 * @property {string|null} color  Dominant album colour (CSS colour string)
 * @property {string[]} palette   Album palette (CSS colour strings); the only
 *                                source of colour for v2 visuals
 */

/**
 * @typedef {Object} LyricWord
 * @property {string} text
 * @property {number} start  ms
 * @property {number} end    ms
 */

/**
 * @typedef {Object} LyricLine
 * @property {number} time     Line start, ms
 * @property {number} endTime  Line end, ms (next line's start, or track end)
 * @property {string} text
 * @property {LyricWord[]} [words]  Optional word timings (task 1.5)
 */

/**
 * The whole lyrics for a track, pushed once per track (not per line).
 *
 * @typedef {Object} LyricsDoc
 * @property {string} trackId
 * @property {'synced'|'plain'|'none'} mode
 * @property {LyricLine[]} lines   Empty unless mode === 'synced'
 * @property {string|null} plain   Unsynced text, if any
 */

/**
 * One analysed audio frame (task 1.7). All bands normalised 0–1.
 *
 * @typedef {Object} AudioFrame
 * @property {number} bass
 * @property {number} mid
 * @property {number} treble
 * @property {number} energy
 * @property {boolean} beat   True on the frame a beat was detected
 * @property {number|null} bpm  Estimated tempo, null until stable
 */

/**
 * @typedef {'christmas'|'rock'|'rain'|'love'|'edm'|'chill'|'hiphop'} SceneName
 */

/**
 * @typedef {Object} SceneChoice
 * @property {string} trackId
 * @property {SceneName} scene
 * @property {number} intensity  0–1
 * @property {string} mood       Short free-text mood
 */

/**
 * @typedef {Object} EffectInitOptions
 * @property {number} width
 * @property {number} height
 * @property {string[]} palette
 * @property {number} intensity
 */

/**
 * A scene effect drawn on its own canvas layer (task 3.3).
 *
 * @typedef {Object} EffectLayer
 * @property {string} id
 * @property {(ctx: CanvasRenderingContext2D, opts: EffectInitOptions) => void} init
 * @property {(t: number, dt: number, audio: AudioFrame, fade?: number) => void} frame
 *   t in ms, dt in SECONDS (clamped). `fade` 0–1 is the scene's crossfade
 *   weight: multiply every globalAlpha by it. Draw in CSS pixels (the stack
 *   sets the DPR transform); the stack save()/restore()s around each frame.
 * @property {(w: number, h: number) => void} resize   CSS pixels
 * @property {() => void} dispose
 * @property {(palette: string[]) => void} [setPalette]  new album palette
 * @property {(intensity: number) => void} [setIntensity]  0–1
 */

/**
 * Everything a voice/gesture/keyboard input can ask the player to do (task 2.1).
 *
 * @typedef {{type:'play'}
 *   | {type:'pause'}
 *   | {type:'toggle'}
 *   | {type:'next'}
 *   | {type:'prev'}
 *   | {type:'seek', positionMs:number}
 *   | {type:'volume', value:number}
 *   | {type:'volumeDelta', delta:number}
 *   | {type:'playUri', uri:string}
 *   | {type:'queue', uri:string}
 *   | {type:'like', trackId?:string}
 *   | {type:'sleep', minutes:number|null}} PlayerCommand
 */

/**
 * @typedef {Object} SearchResult
 * @property {'track'|'artist'|'album'|'playlist'} kind
 * @property {string} id
 * @property {string} uri
 * @property {string} name
 * @property {string} [subtitle]  Artist / owner
 * @property {string|null} [art]
 */

/**
 * A request to the local AI (Ollama qwen3:8b) (task 3.1).
 *
 * @typedef {Object} AiRequest
 * @property {string} task    e.g. 'scene', 'meaning', 'intent', 'memory'
 * @property {*} input        Task-specific payload
 */

/**
 * @typedef {Object} AiResult
 * @property {boolean} ok
 * @property {*} [data]       Task-specific parsed output
 * @property {string} [error]
 * @property {'ollama'|'gemini'|'fallback'} [source]
 */

export {}
