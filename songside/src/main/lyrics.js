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

import { getCurrentlyPlaying } from './spotify.js'

const LRCLIB_BASE = 'https://lrclib.net/api'
// LRCLIB asks clients to identify themselves with a User-Agent.
const USER_AGENT = 'songside (https://github.com/songside/songside)'

const SPOTIFY_POLL_MS = 3000
const TICK_MS = 500

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

async function lrclibGet(path) {
  try {
    const res = await fetch(`${LRCLIB_BASE}${path}`, {
      headers: { 'User-Agent': USER_AGENT }
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    console.warn('[lyrics] LRCLIB request failed:', e.message)
    return null
  }
}

// Resolve lyrics for a track. Tries the exact signature match first (which is
// fastest and most accurate), then falls back to a fuzzy search. Returns:
//   { mode: 'synced', synced: [...], plain }  — timed lyrics available
//   { mode: 'plain',  synced: [],   plain }   — only unsynced text available
//   { mode: 'none',   synced: [],   plain: null } — no match at all
export async function fetchLyrics({ artist, track, album, durationSec }) {
  const params = new URLSearchParams({ artist_name: artist, track_name: track })
  if (album) params.set('album_name', album)
  if (durationSec) params.set('duration', String(durationSec))

  let data = await lrclibGet(`/get?${params}`)

  if (!data) {
    // Signature match failed — usually an album/duration mismatch. Fall back to
    // a fuzzy search and prefer the first candidate that actually has synced
    // lyrics, otherwise take the top result.
    const results = await lrclibGet(
      `/search?${new URLSearchParams({ track_name: track, artist_name: artist })}`
    )
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

    if (item.id !== this.trackId) {
      this.trackId = item.id
      this.songName = item.name
      this.activeIdx = -1
      await this.loadLyrics(item)
    }
  }

  async loadLyrics(item) {
    if (this.fetching) return
    this.fetching = true
    const forId = item.id

    const lyrics = await fetchLyrics({
      artist: item.artists?.map((a) => a.name).join(', ') ?? '',
      track: item.name,
      album: item.album?.name,
      durationSec: item.duration_ms ? Math.round(item.duration_ms / 1000) : undefined
    })

    this.fetching = false
    // The track may have changed while we were fetching — drop stale results.
    if (forId !== this.trackId) return
    this.lyrics = lyrics

    if (lyrics.mode === 'synced') {
      // Emit an initial frame so the overlay enters synced mode immediately
      // (during the intro, before the first line, active is null). tick() takes
      // over from here as the position advances past each timestamp.
      this.send({
        mode: 'synced',
        trackId: forId,
        songName: this.songName,
        prev: null,
        active: null,
        next: lyrics.synced[0]?.text ?? null
      })
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

    this.send({
      mode: 'synced',
      trackId: this.trackId,
      songName: this.songName,
      prev: idx > 0 ? lines[idx - 1].text : null,
      active: idx >= 0 ? lines[idx].text : null,
      next: idx + 1 < lines.length ? lines[idx + 1].text : null
    })
  }

  send(payload) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('lyrics:update', payload)
    }
  }
}
