// Every IPC channel name in SongSide, in one place.
//
// Imported by main, preload and (indirectly, via preload) the renderer so a
// channel string is never typed twice. The v1 strings are unchanged.
//
//   INVOKE — renderer → main, request/response (ipcRenderer.invoke / ipcMain.handle)
//   SEND   — renderer → main, fire-and-forget (ipcRenderer.send / ipcMain.on)
//   PUSH   — main → renderer (webContents.send / ipcRenderer.on)

export const INVOKE = Object.freeze({
  // v1
  SPOTIFY_LOGIN: 'spotify:login',
  SPOTIFY_CURRENTLY_PLAYING: 'spotify:currently-playing',
  SPOTIFY_IS_CONNECTED: 'spotify:is-connected',
  SPOTIFY_SEEK: 'spotify:seek',
  COLOR_ALBUM: 'color:album',
  LLM_LYRIC_MEANING: 'llm:lyric-meaning',
  LLM_MOOD: 'llm:mood',
  LLM_WEEKLY_DIGEST: 'llm:weekly-digest',
  // v2
  PLAYER_GET_STATE: 'player:get-state',
  LYRICS_GET_DOC: 'lyrics:get-doc',
  PLAYER_COMMAND: 'player:command',
  SPOTIFY_SEARCH: 'spotify:search',
  AI_RUN: 'ai:run',
  SCENE_GET: 'scene:get',
  MEMORY_ASK: 'memory:ask',
  CARD_SAVE: 'card:save',
  VOICE_START: 'voice:start',
  VOICE_STOP: 'voice:stop'
})

export const SEND = Object.freeze({
  // v1
  PING: 'ping',
  OVERLAY_SET_INTERACTIVE: 'overlay:set-interactive',
  // v2
  WINDOW_FULLSCREEN_TOGGLE: 'window:fullscreen-toggle',
  WINDOW_FULLSCREEN_CLOSE: 'window:fullscreen-close',
  AUDIO_BEAT: 'audio:beat'
})

export const PUSH = Object.freeze({
  // v1
  LYRICS_UPDATE: 'lyrics:update',
  // v2
  PLAYER_STATE: 'player:state',
  LYRICS_DOC: 'lyrics:doc',
  SCENE_UPDATE: 'scene:update',
  VOICE_RESULT: 'voice:result',
  SLEEP_UPDATE: 'sleep:update'
})

const invokeSet = new Set(Object.values(INVOKE))
const sendSet = new Set(Object.values(SEND))
const pushSet = new Set(Object.values(PUSH))

/** @param {string} ch */
export const isInvokeChannel = (ch) => invokeSet.has(ch)
/** @param {string} ch */
export const isSendChannel = (ch) => sendSet.has(ch)
/** @param {string} ch */
export const isPushChannel = (ch) => pushSet.has(ch)
