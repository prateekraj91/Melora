// LRCLIB synced-lyrics engine.
//
// Fetches time-stamped lyrics from lrclib.net, parses the LRC format into
// { time, text } lines, and runs a 500ms sync loop that figures out which line
// is "now" and pushes prev/active/next to the renderer over IPC.
//
// Playback position: we poll Spotify only every SPOTIFY_POLL_MS for a
// ground-truth anchor (progress_ms + the wall-clock moment we read it), then
// interpolate locally on every 500ms tick. That keeps the visible line moving
// smoothly without hammering the Spotify API at 2 req/s.

import { getCurrentlyPlaying, isConnected } from './spotify.js'

const LRCLIB_BASE = 'https://lrclib.net/api'
// LRCLIB asks clients to identify themselves with a User-Agent.
const USER_AGENT = 'songside (https://github.com/songside/songside)'

const SPOTIFY_POLL_MS = 3000
const TICK_MS = 500
// Abort an LRCLIB request that stalls, so a hung connection can't wedge the
// fetch flag and leave the overlay stuck on "finding lyrics…" forever.
const LRCLIB_TIMEOUT_MS = 8000
// How many upcoming lines to send below the active one (the renderer fades them
// out progressively). Plus the single previous line above.
const UPCOMING = 5

// Build the synced-lyrics IPC frame for a given active index. idx === -1 means
// we're before the first line (intro) — active is null and we preview the
// opening lines as the upcoming stack. Each line carries its { text, time } so
// the renderer can seek playback to a line on click.
function buildSyncedFrame(lines, idx, meta) {
  const start = Math.max(idx + 1, 0)
  const lineOf = (l) => ({ text: l.text, time: l.time })
  return {
    mode: 'synced',
    trackId: meta.trackId,
    songName: meta.songName,
    prev: idx > 0 ? lineOf(lines[idx - 1]) : null,
    active: idx >= 0 ? lineOf(lines[idx]) : null,
    next: lines.slice(start, start + UPCOMING).map(lineOf)
  }
}

// ---- LRC parsing -----------------------------------------------------------

// Parse LRC text into a time-sorted [{ time, text }] array (time in ms).
// A single line can carry several timestamps (repeated choruses), e.g.
// "[00:12.34][01:02.00] words". Metadata/blank lines (no text after the tags)
// are dropped.
export function parseLRC(lrc) {
  const out = []
  const tag = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g

  for (const raw of lrc.split('\n')) {
    const times = []
    tag.lastIndex = 0
    let m
    while ((m = tag.exec(raw)) !== null) {
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      // Fraction can be centi- or milliseconds; right-pad to ms.
      const frac = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0
      times.push(min * 60000 + sec * 1000 + frac)
    }
    if (!times.length) continue

    const text = raw.replace(tag, '').trim()
    if (!text) continue

    for (const t of times) out.push({ time: t, text })
  }

  return out.sort((a, b) => a.time - b.time)
}

// ---- LRCLIB fetch ----------------------------------------------------------

// One LRCLIB request. A 404 is a genuine "no match" → null. Anything else (5xx
// like the gateway 504s LRCLIB throws under load, a network blip, or a timeout)
// throws, so the caller can RETRY rather than caching a false "no lyrics" that
// sticks until the track changes.
async function lrclibGet(path) {
  const res = await fetch(`${LRCLIB_BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(LRCLIB_TIMEOUT_MS)
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

// Resolve lyrics for a track. Tries the exact signature match first (which is
// fastest and most accurate), then falls back to a fuzzy search. Returns:
//   { mode: 'synced', synced: [...], plain }  — timed lyrics available
//   { mode: 'plain',  synced: [],   plain }   — only unsynced text available
//   { mode: 'none',   synced: [],   plain: null } — confirmed no match
// THROWS if LRCLIB is unreachable / erroring (so the caller retries instead of
// treating a transient outage as "no lyrics"). 'none' means LRCLIB answered and
// genuinely had nothing.
export async function fetchLyrics({ artist, track, album, durationSec }) {
  const params = new URLSearchParams({ artist_name: artist, track_name: track })
  if (album) params.set('album_name', album)
  if (durationSec) params.set('duration', String(durationSec))
  const searchParams = new URLSearchParams({ track_name: track, artist_name: artist })

  // Fire the exact signature match and the fuzzy search together. A signature
  // miss is common (the album/duration LRCLIB has don't line up, especially for
  // regional tracks), and running these in parallel means that miss no longer
  // costs a second sequential round-trip — the single biggest source of the
  // "finding lyrics…" wait. We still prefer the exact /get match when it lands
  // and only consult the search as the fallback.
  const [getRes, searchRes] = await Promise.allSettled([
    lrclibGet(`/get?${params}`),
    lrclibGet(`/search?${searchParams}`)
  ])

  let data = getRes.status === 'fulfilled' ? getRes.value : null

  if (!data) {
    // No exact match. If the fallback search itself errored (a transient LRCLIB
    // outage rather than a clean "no results"), throw so the caller retries
    // instead of caching a false "no lyrics" that sticks until the track changes.
    if (searchRes.status === 'rejected') throw searchRes.reason
    const results = searchRes.value
    // Prefer the first candidate that actually has synced lyrics, else the top.
    data = Array.isArray(results) ? results.find((r) => r.syncedLyrics) || results[0] : null
  }

  if (data?.syncedLyrics) {
    return { mode: 'synced', synced: parseLRC(data.syncedLyrics), plain: data.plainLyrics || null }
  }
  if (data?.plainLyrics) {
    return { mode: 'plain', synced: [], plain: data.plainLyrics }
  }
  return { mode: 'none', synced: [], plain: null }
}

// ---- sync engine -----------------------------------------------------------

let engine = null

// Playback-state subscription. The engine already polls Spotify, so it's the
// single source of truth for playback. States:
//   'playing'      — a track is actively playing → overlay should be visible
//   'paused'       — a track is loaded but paused → overlay should hide
//   'none'         — connected, but nothing playing / Spotify quit → overlay hides
//   'disconnected' — no Spotify token yet → keep overlay up so Connect stays reachable
// The main process subscribes to drive the overlay's automatic show/hide.
let playbackListener = null
let lastPlaybackState = null

export function onPlaybackState(cb) {
  playbackListener = cb
}

function emitPlayback(state) {
  if (state === lastPlaybackState) return
  lastPlaybackState = state
  playbackListener?.(state)
}

export function startLyricsSync(mainWindow) {
  if (engine) return
  engine = new SyncEngine(mainWindow)
  engine.start()
}

export function stopLyricsSync() {
  if (engine) {
    engine.stop()
    engine = null
  }
}

// Called right after a user-initiated seek: move the interpolation anchor to the
// new position and re-run the tick so the active line jumps to the clicked line
// immediately, rather than lagging until the next 3s Spotify poll.
export function applySeek(positionMs) {
  if (!engine) return
  engine.anchorMs = Math.max(0, positionMs)
  engine.anchorAt = Date.now()
  engine.activeIdx = -1 // force tick() to recompute and push a fresh frame
  engine.tick()
}

class SyncEngine {
  constructor(mainWindow) {
    this.win = mainWindow
    this.trackId = null
    this.songName = ''
    this.lyrics = { mode: 'none', synced: [], plain: null }

    // Position anchor: at wall-clock `anchorAt`, playback was `anchorMs` into
    // the track. Between Spotify polls we interpolate from here.
    this.anchorMs = 0
    this.anchorAt = 0
    this.isPlaying = false

    this.activeIdx = -1
    this.fetching = false
    // Whether lyrics for the current track resolved (a real answer, including a
    // confirmed "none"). Stays false after a transient LRCLIB failure so poll()
    // keeps retrying instead of leaving the track wrongly marked unavailable.
    this.lyricsLoaded = false
    this.spotifyTimer = null
    this.tickTimer = null
  }

  start() {
    this.poll()
    this.spotifyTimer = setInterval(() => this.poll(), SPOTIFY_POLL_MS)
    this.tickTimer = setInterval(() => this.tick(), TICK_MS)
  }

  stop() {
    clearInterval(this.spotifyTimer)
    clearInterval(this.tickTimer)
  }

  // Re-read ground truth from Spotify: current track + playback position.
  async poll() {
    let playing
    try {
      playing = await getCurrentlyPlaying()
    } catch {
      return // transient API error — keep interpolating from the last anchor
    }

    const item = playing?.item
    if (!item) {
      // Nothing playing. Distinguish "connected but idle / Spotify quit" (hide
      // the overlay) from "never connected" (keep it up for the Connect button).
      emitPlayback(isConnected() ? 'none' : 'disconnected')
      if (this.trackId !== null) {
        this.trackId = null
        this.songName = ''
        this.lyrics = { mode: 'none', synced: [], plain: null }
        this.send({ mode: 'none', trackId: null, songName: '' })
      }
      return
    }

    // Refresh the interpolation anchor on every poll.
    this.anchorMs = playing.progress_ms ?? 0
    this.anchorAt = Date.now()
    this.isPlaying = playing.is_playing ?? true
    emitPlayback(this.isPlaying ? 'playing' : 'paused')

    if (item.id !== this.trackId) {
      this.trackId = item.id
      this.songName = item.name
      this.activeIdx = -1
      this.lyricsLoaded = false
      // Drop the previous song's lines immediately so tick() can't push them
      // (tagged with the new trackId) during the fetch/retry window.
      this.lyrics = { mode: 'none', synced: [], plain: null }
      await this.loadLyrics(item)
    } else if (!this.lyricsLoaded && !this.fetching) {
      // Same track, but its lyrics never resolved (a prior LRCLIB outage) —
      // retry on this poll. ~3s cadence until LRCLIB answers.
      await this.loadLyrics(item)
    }
  }

  async loadLyrics(item) {
    if (this.fetching) return
    this.fetching = true
    const forId = item.id

    let lyrics
    try {
      lyrics = await fetchLyrics({
        artist: item.artists?.map((a) => a.name).join(', ') ?? '',
        track: item.name,
        album: item.album?.name,
        durationSec: item.duration_ms ? Math.round(item.duration_ms / 1000) : undefined
      })
    } catch (e) {
      // LRCLIB unreachable/erroring. Leave lyricsLoaded false so poll() retries;
      // the overlay keeps showing "finding lyrics…" rather than "unavailable".
      console.warn(`[lyrics] fetch failed for "${item.name}" — will retry:`, e.message)
      this.fetching = false
      return
    }
    console.log(
      `[lyrics] "${item.name}" id=${forId} → ${lyrics.mode} (${lyrics.synced.length} synced lines)`
    )

    this.fetching = false
    // The track may have changed while we were fetching — drop stale results.
    if (forId !== this.trackId) return
    this.lyrics = lyrics
    this.lyricsLoaded = true

    if (lyrics.mode === 'synced') {
      // Emit an initial frame so the overlay enters synced mode immediately
      // (during the intro, before the first line, active is null). tick() takes
      // over from here as the position advances past each timestamp.
      this.send(buildSyncedFrame(lyrics.synced, -1, this))
    } else if (lyrics.mode === 'plain') {
      this.send({ mode: 'plain', trackId: forId, songName: this.songName, plain: lyrics.plain })
    } else {
      this.send({ mode: 'none', trackId: forId, songName: this.songName })
    }
  }

  // Interpolated playback position in ms.
  position() {
    const elapsed = this.isPlaying ? Date.now() - this.anchorAt : 0
    return this.anchorMs + elapsed
  }

  tick() {
    if (this.lyrics.mode !== 'synced' || !this.lyrics.synced.length) return

    const lines = this.lyrics.synced
    const pos = this.position()

    // Binary search for the last line whose timestamp is <= pos.
    let lo = 0
    let hi = lines.length - 1
    let idx = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (lines[mid].time <= pos) {
        idx = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    if (idx === this.activeIdx) return // still on the same line — nothing to push
    this.activeIdx = idx

    this.send(buildSyncedFrame(lines, idx, this))
  }

  send(payload) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('lyrics:update', payload)
    }
  }
}
