import { useState, useEffect } from 'react'

const DEFAULT_COLOR = 'hsl(141 73% 42%)' // Spotify green, used before art loads

// Given an album-art URL, asks the main process (color.js) for the dominant,
// transformed album color and publishes it to the `--album-color` CSS variable
// so any element can tint from it. Falls back to the default on failure.
export function useColor(art) {
  const [color, setColor] = useState(DEFAULT_COLOR)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      if (!art) {
        setColor(DEFAULT_COLOR)
        return
      }
      const next = (await window.api.getAlbumColor(art)) || DEFAULT_COLOR
      if (!cancelled) setColor(next)
    }
    resolve()

    return () => {
      cancelled = true
    }
  }, [art])

  useEffect(() => {
    document.documentElement.style.setProperty('--album-color', color)
  }, [color])

  return color
}
