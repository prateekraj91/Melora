import { useState, useEffect } from 'react'

// Subscribes to the synced-lyrics frames pushed by the main process and returns
// the latest one. Frames carry their own trackId; we ignore any whose trackId
// doesn't match the track currently shown, so during the brief overlap between
// the lyrics poll and the renderer's track poll we never paint the previous
// song's lines over the new album art.
export function useLyrics(trackId) {
  const [frame, setFrame] = useState(null)

  useEffect(() => {
    const unsubscribe = window.api.onLyrics((data) => setFrame(data))
    return unsubscribe
  }, [])

  if (frame && trackId && frame.trackId && frame.trackId !== trackId) {
    return null
  }
  return frame
}
