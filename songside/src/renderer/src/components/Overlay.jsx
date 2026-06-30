import { useState } from 'react'
import { useTrack } from '../hooks/useTrack'
import { useColor } from '../hooks/useColor'
import { useLyrics } from '../hooks/useLyrics'
import { useLyricMeaning } from '../hooks/useLyricMeaning'

// Opacity ramp for the upcoming lines below the active one — kept very low so
// the context lines are barely-there, ghosted, well behind the active line.
const UPCOMING_OPACITY = [0.32, 0.23, 0.16, 0.11, 0.08]

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
  // Held back to match the quiet, translucent text: dimmed and softly shadowed.
  const tone = 'opacity-75 drop-shadow-[0_2px_5px_rgba(0,0,0,0.4)]'

  if (!art || broken) {
    return (
      <div
        className={`${box} ${tone} flex-shrink-0`}
        style={{ background: 'color-mix(in srgb, var(--album-color) 55%, rgba(0,0,0,0.45))' }}
      />
    )
  }
  return (
    <img
      src={art}
      alt=""
      onError={() => setBroken(true)}
      className={`${box} ${tone} flex-shrink-0 object-cover`}
    />
  )
}

// Compact now-playing header for the synced view.
function Header({ track }) {
  return (
    <div className="flex items-center gap-2.5">
      <AlbumArt art={track.art} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[12px] font-medium leading-tight text-white/[0.55]">
          {track.name}
        </span>
        <span className="truncate text-[11px] leading-tight text-white/[0.28]">{track.artist}</span>
      </div>
    </div>
  )
}

// Wires a lyric line's hover-meaning + click-to-seek without the two fighting.
// The 600ms dwell (in useLyricMeaning) keeps a quick click from triggering the
// tooltip; onClick here dismisses any tooltip *before* seeking; and the tooltip
// itself is pointer-events:none, so even when shown it never swallows the click.
function lyricHandlers(text, time, meaning) {
  return {
    onMouseEnter: (e) => meaning.enter(text, e.currentTarget),
    onMouseLeave: meaning.leave,
    onClick: () => {
      meaning.dismiss()
      seekTo(time)
    }
  }
}

// The karaoke stack: 1 previous line (faded), the active line (bright, marked by
// the playhead), then up to 5 upcoming lines fading progressively away. Every
// line is clickable to seek playback to its timestamp, and a deliberate ~600ms
// hover surfaces an AI meaning tooltip for that line.
function LyricStack({ lyrics, next, meaning }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-[5px]">
      {lyrics.prev && (
        <span
          {...lyricHandlers(lyrics.prev.text, lyrics.prev.time, meaning)}
          className="lyric-line truncate pl-[13px] text-[13px] leading-snug text-white/[0.16]"
        >
          {lyrics.prev.text}
        </span>
      )}

      <div className="flex items-center gap-2.5">
        <span className="playhead h-[1.05em] w-[3px] flex-shrink-0 rounded-full" />
        <span
          key={lyrics.active?.text}
          {...(lyrics.active ? lyricHandlers(lyrics.active.text, lyrics.active.time, meaning) : {})}
          className="lyric-line animate-line-in truncate text-[15px] font-normal leading-snug tracking-[-0.01em] text-white/[0.68]"
        >
          {lyrics.active?.text || '♪'}
        </span>
      </div>

      {next.map((line, i) => (
        <span
          key={`${i}-${line.text}`}
          {...lyricHandlers(line.text, line.time, meaning)}
          className="lyric-line truncate pl-[13px] text-[13px] leading-snug"
          style={{ color: `rgba(255,255,255,${UPCOMING_OPACITY[i] ?? 0.12})` }}
        >
          {line.text}
        </span>
      ))}
    </div>
  )
}

// Floating meaning tooltip for a dwelt-on lyric line. Anchored just above or
// just below the line (whichever side the line leaves room for) so it never
// covers the line you're reading, and pointer-events:none so a click always
// falls through to the lyric beneath it — the tooltip can't intercept the seek.
function MeaningTip({ tip }) {
  if (!tip) return null
  const GAP = 8
  // Place below when the line sits in the top half of the window, above when it
  // sits in the bottom half — keeps the tip inside the small frameless window.
  const below = tip.rect.top < window.innerHeight / 2
  const pos = { left: 16, right: 16 }
  if (below) pos.top = tip.rect.bottom + GAP
  else pos.bottom = window.innerHeight - tip.rect.top + GAP

  return (
    <div style={{ position: 'fixed', ...pos }} className="meaning-tip pointer-events-none z-20">
      <div className="meaning-tip-body rounded-xl px-3 py-2 text-[11px] leading-[1.5] text-white/[0.74]">
        {tip.loading ? (
          <span className="meaning-tip-loading text-white/[0.5]">reading the line…</span>
        ) : (
          <span>
            <span className="meaning-tip-spark" style={{ color: 'var(--album-color)' }}>
              ✦{' '}
            </span>
            {tip.meaning}
          </span>
        )}
      </div>
    </div>
  )
}

// Second rung of the fallback chain: a track with unsynced ('plain') lyrics —
// common for a lot of Indian/regional music LRCLIB only has as plain text. We
// can't run the karaoke playhead, so we present the words themselves: the same
// header, then the full lyric scrolled in a soft-masked column. Reads as a
// deliberate "here are the lyrics" view, not a degraded one.
function PlainLyrics({ track, text }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Header track={track} />
      <div className="plain-scroll min-h-0 flex-1 overflow-y-auto pl-[13px] pr-1">
        <p className="whitespace-pre-line text-[12.5px] leading-[1.65] text-white/[0.34]">{text}</p>
      </div>
    </div>
  )
}

// Last rung: no lyrics matched at all. Just the album art, song, and artist —
// floating and complete on its own, with a faint marker so it reads as a
// finished state rather than something still loading.
function NowPlaying({ track }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <AlbumArt art={track.art} size="lg" />
      <div className="flex max-w-full flex-col gap-0.5">
        <span className="truncate text-[15px] font-normal tracking-[-0.01em] text-white/[0.68]">
          {track.name}
        </span>
        <span className="truncate text-[13px] text-white/[0.32]">{track.artist}</span>
        <span className="mt-1 text-[10px] tracking-wide text-white/[0.2]">lyrics unavailable</span>
      </div>
    </div>
  )
}

// Calm resting state for paused or idle playback. Shown instead of stale lyrics
// the moment music isn't actively playing. If a (paused) track is loaded we keep
// its dimmed art so the overlay stays warm rather than going blank; pure idle
// gets a soft glyph. Either way the message is a gentle nudge, not an error.
function IdlePrompt({ track }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
      {track?.art ? (
        <div className="opacity-50">
          <AlbumArt art={track.art} size="lg" />
        </div>
      ) : (
        <span className="text-[15px] text-white/[0.3]">♪</span>
      )}
      <div className="flex max-w-full flex-col gap-0.5">
        <span className="text-[13px] text-white/[0.5]">Play something on Spotify</span>
        {track && (
          <span className="truncate text-[11px] text-white/[0.26]">{track.name} · paused</span>
        )}
      </div>
    </div>
  )
}

function Overlay() {
  const { track, connected, error, connect } = useTrack()
  // Drives the --album-color CSS variable; the ambient glow and playhead read it.
  useColor(track?.art)
  // Synced/plain lyric frames pushed from the main process for this track.
  const lyrics = useLyrics(track?.id)
  const next = Array.isArray(lyrics?.next) ? lyrics.next : []
  const synced = lyrics?.mode === 'synced' && (lyrics.active || lyrics.prev || next.length)
  // A loaded track that isn't actively playing → paused. Shown as the calm
  // resting state rather than a frozen, stale lyric stack.
  const paused = track && track.isPlaying === false
  // Deliberate-hover AI meaning tooltip for lyric lines (local Ollama).
  const meaning = useLyricMeaning(track)

  // Pick the view down the fallback chain: not-connected → idle/paused →
  // synced karaoke → plain lyrics → bare now-playing. Every branch renders a
  // complete, intentional state — never blank or broken.
  let content
  if (!track) {
    content = error ? (
      <div className="flex h-full w-full items-center justify-center">
        <span className="px-3 text-center text-[11px] text-red-300">{error}</span>
      </div>
    ) : connected ? (
      <IdlePrompt />
    ) : (
      <div className="flex h-full w-full items-center justify-center">
        <button
          onClick={connect}
          className="rounded-full bg-green-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-green-600"
        >
          Connect Spotify
        </button>
      </div>
    )
  } else if (paused) {
    content = <IdlePrompt track={track} />
  } else if (synced) {
    // key remounts the stack on track change so the enter animation replays.
    content = (
      <div key={track.id} className="flex min-h-0 flex-1 flex-col gap-3">
        <Header track={track} />
        <LyricStack lyrics={lyrics} next={next} meaning={meaning} />
      </div>
    )
  } else if (lyrics?.mode === 'plain' && lyrics.plain) {
    content = <PlainLyrics key={track.id} track={track} text={lyrics.plain} />
  } else {
    content = <NowPlaying key={track.id} track={track} />
  }

  return (
    <div className="float-content relative h-screen w-screen text-white">
      {/* Soft album glow + legibility scrim, fading to transparent at the edges.
          Non-interactive so it never blocks the clickable lyric lines. */}
      <div className="float-bg pointer-events-none absolute inset-0" />

      <div className="animate-overlay-in relative z-10 flex h-full w-full flex-col gap-3 px-4 py-3.5">
        {content}
      </div>

      {/* Floating, click-through meaning tooltip. Lives above the content layer
          and outside the lyric flow so it can be anchored anywhere in the window. */}
      <MeaningTip tip={meaning.tip} />
    </div>
  )
}

export default Overlay
