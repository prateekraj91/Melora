import { useState, useEffect, useCallback } from 'react'

const POLL_MS = 5000

// Normalize Spotify's currently-playing payload down to just what the overlay
// needs. Returns null when nothing is playing / not connected.
function normalize(playing) {
  const item = playing?.item
  if (!item) return null
  return {
    id: item.id,
    name: item.name,
    artist: item.artists?.map((a) => a.name).join(', ') ?? '',
    art: item.album?.images?.[0]?.url ?? null,
    isPlaying: playing.is_playing ?? true
  }
}

// Polls the current track every POLL_MS. Exposes `connect` to kick off the
// Spotify OAuth flow and an immediate refetch after it completes.
export function useTrack() {
  const [track, setTrack] = useState(null)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    try {
      const playing = await window.api.getCurrentlyPlaying()
      setTrack(normalize(playing))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const connect = useCallback(async () => {
    try {
      await window.api.spotifyLogin()
      await refetch()
    } catch (err) {
      setError(err.message)
    }
  }, [refetch])

  useEffect(() => {
    refetch()
    const interval = setInterval(refetch, POLL_MS)
    return () => clearInterval(interval)
  }, [refetch])

  return { track, error, connect }
}
