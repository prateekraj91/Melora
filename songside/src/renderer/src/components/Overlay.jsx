import { useState } from 'react'
import { useTrack } from '../hooks/useTrack'
import { useColor } from '../hooks/useColor'
import { useLyrics } from '../hooks/useLyrics'

// Opacity ramp for the upcoming lines below the active one — each step further
// out fades toward the desktop.
const UPCOMING_OPACITY = [0.6, 0.42, 0.29, 0.2, 0.14]

// Seek playback to a line's timestamp. Guarded so a missing time (intro frame)
// is a no-op.
function seekTo(time) {
  if (typeof time === 'number') window.api.seek(time)
}

// Album art floating on the desktop — a soft drop-shadow grounds it without a
// container. Falls back to an album-tinted tile if there's no URL or it fails to
// load, so a missing image never renders as a broken-image icon.
function AlbumArt({ art, size = 'sm' }) {
  const [broken, setBroken] = useState(false)
  const box = size === 'lg' ? 'h-16 w-16 rounded-xl' : 'h-7 w-7 rounded-md'
  const shadow = 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]'

  if (!art || broken) {
    return (
      <div
        className={`${box} ${shadow} flex-shrink-0`}
        style={{ background: 'color-mix(in srgb, var(--album-color) 55%, rgba(0,0,0,0.45))' }}
      />
    )
  }
  return (
    <img
      src={art}
      alt=""
      onError={() => setBroken(true)}
      className={`${box} ${shadow} flex-shrink-0 object-cover`}
    />
  )
}

// Compact now-playing header for the synced view.
function Header({ track }) {
  return (
    <div className="flex items-center gap-2.5">
      <AlbumArt art={track.art} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[12px] font-semibold leading-tight text-white/[0.9]">
          {track.name}
        </span>
        <span className="truncate text-[11px] leading-tight text-white/[0.45]">{track.artist}</span>
      </div>
    </div>
  )
}

// The karaoke stack: 1 previous line (faded), the active line (bright, marked by
// the playhead), then up to 5 upcoming lines fading progressively away. Every
// line is clickable to seek playback to its timestamp.
function LyricStack({ lyrics, next }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-[5px]">
      {lyrics.prev && (
        <span
          onClick={() => seekTo(lyrics.prev.time)}
          className="lyric-line truncate pl-[13px] text-[13px] leading-snug text-white/[0.3]"
        >
          {lyrics.prev.text}
        </span>
      )}

      <div className="flex items-center gap-2.5">
        <span className="playhead h-[1.05em] w-[3px] flex-shrink-0 rounded-full" />
        <span
          key={lyrics.active?.text}
          onClick={() => lyrics.active && seekTo(lyrics.active.time)}
          className="lyric-line animate-line-in truncate text-[16px] font-semibold leading-snug tracking-[-0.01em] text-white/[0.96]"
        >
          {lyrics.active?.text || '♪'}
        </span>
      </div>

      {next.map((line, i) => (
        <span
          key={`${i}-${line.text}`}
          onClick={() => seekTo(line.time)}
          className="lyric-line truncate pl-[13px] text-[13px] leading-snug"
          style={{ color: `rgba(255,255,255,${UPCOMING_OPACITY[i] ?? 0.12})` }}
        >
          {line.text}
        </span>
      ))}
    </div>
  )
}

// Fallback view when there are no synced lyrics: centered now-playing. Used for
// unsynced ('plain') and no-match ('none') tracks.
function NowPlaying({ track, mode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <AlbumArt art={track.art} size="lg" />
      <div className="flex max-w-full flex-col gap-0.5">
        <span className="truncate text-[16px] font-semibold tracking-[-0.01em] text-white/[0.96]">
          {track.name}
        </span>
        <span className="truncate text-[13px] text-white/[0.5]">{track.artist}</span>
        {mode === 'plain' && (
          <span className="mt-1 text-[11px] text-white/[0.35]">♪ lyrics available, not synced</span>
        )}
        {mode === 'none' && (
          <span className="mt-1 text-[11px] text-white/[0.3]">no lyrics found</span>
        )}
      </div>
    </div>
  )
}

function Overlay() {
  const { track, error, connect } = useTrack()
  // Drives the --album-color CSS variable; the ambient glow and playhead read it.
  useColor(track?.art)
  // Synced/plain lyric frames pushed from the main process for this track.
  const lyrics = useLyrics(track?.id)
  const next = Array.isArray(lyrics?.next) ? lyrics.next : []
  const synced = lyrics?.mode === 'synced' && (lyrics.active || lyrics.prev || next.length)

  return (
    <div className="float-content relative h-screen w-screen text-white">
      {/* Soft album glow + legibility scrim, fading to transparent at the edges.
          Non-interactive so it never blocks the clickable lyric lines. */}
      <div className="float-bg pointer-events-none absolute inset-0" />

      <div className="animate-overlay-in relative z-10 flex h-full w-full flex-col gap-3 px-4 py-3.5">
        {!track ? (
          <div className="flex h-full w-full items-center justify-center">
            {error ? (
              <span className="px-3 text-center text-[11px] text-red-300">{error}</span>
            ) : (
              <button
                onClick={connect}
                className="rounded-full bg-green-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-green-600"
              >
                Connect Spotify
              </button>
            )}
          </div>
        ) : synced ? (
          // key remounts the stack on track change so the enter animation replays.
          <div key={track.id} className="flex min-h-0 flex-1 flex-col gap-3">
            <Header track={track} />
            <LyricStack lyrics={lyrics} next={next} />
          </div>
        ) : (
          <NowPlaying key={track.id} track={track} mode={lyrics?.mode} />
        )}
      </div>
    </div>
  )
}

export default Overlay
