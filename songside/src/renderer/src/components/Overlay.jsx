import { useTrack } from '../hooks/useTrack'
import { useColor } from '../hooks/useColor'
import { useLyrics } from '../hooks/useLyrics'

function Overlay() {
  const { track, error, connect } = useTrack()
  // Drives the --album-color CSS variable; the pill tints from it.
  useColor(track?.art)
  // Synced/plain lyric frames pushed from the main process for this track.
  const lyrics = useLyrics(track?.id)
  const synced = lyrics?.mode === 'synced' && (lyrics.active || lyrics.prev || lyrics.next)

  return (
    <div className="flex h-screen w-screen items-center justify-center p-3 text-white">
      {!track && (
        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-white/15 bg-black/40 backdrop-blur-md">
          {error ? (
            <span className="px-3 text-center text-[11px] text-red-300">{error}</span>
          ) : (
            <button
              onClick={connect}
              className="rounded-full bg-green-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-600"
            >
              Connect Spotify
            </button>
          )}
        </div>
      )}

      {track && (
        // key={track.id} remounts the pill on every song change so the
        // enter animation replays.
        <div
          key={track.id}
          className="album-pill animate-overlay-in flex h-full w-full items-center gap-3 rounded-2xl border px-3"
        >
          <img
            src={track.art}
            alt=""
            className="h-14 w-14 flex-shrink-0 rounded-xl object-cover shadow-lg"
          />
          <div className="flex min-w-0 flex-col justify-center text-left">
            {synced ? (
              // Three-line karaoke view: prev/next faded, active line bright.
              // The active line is keyed so it re-fades-in each time it changes.
              <>
                <span className="truncate text-[11px] leading-tight text-white/35">
                  {lyrics.prev || ' '}
                </span>
                <span
                  key={lyrics.active}
                  className="animate-line-in truncate text-sm font-semibold leading-snug text-white"
                >
                  {lyrics.active || track.name}
                </span>
                <span className="truncate text-[11px] leading-tight text-white/35">
                  {lyrics.next || ' '}
                </span>
              </>
            ) : (
              <>
                <span className="truncate text-sm font-bold leading-tight">{track.name}</span>
                <span className="truncate text-xs text-white/70">{track.artist}</span>
                {lyrics?.mode === 'plain' && (
                  <span className="truncate text-[10px] text-white/40">♪ lyrics (unsynced)</span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Overlay
