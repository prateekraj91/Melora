import { getColor, getPalette } from 'colorthief'
import { pastelPalette, PALETTE_SIZE } from './palette.js'

// Cache computed colors per album-art URL. Art URLs are stable per album, and
// the renderer polls on an interval, so this avoids re-fetching + re-decoding
// the same image every few seconds.
const cache = new Map()
// v2: pastel palettes per art URL (see palette.js), and the fetched image
// bytes so colour + palette extraction share one download.
const paletteCache = new Map()
const bufferCache = new Map()
const MAX_CACHED = 64

function remember(map, key, value) {
  map.set(key, value)
  if (map.size > MAX_CACHED) map.delete(map.keys().next().value)
  return value
}

// One download per art URL, shared by getAlbumColor and getAlbumPalette.
function fetchArt(imageUrl) {
  if (bufferCache.has(imageUrl)) return bufferCache.get(imageUrl)
  const p = (async () => {
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`art fetch failed: HTTP ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  })()
  // Don't cache failures — the next track change can retry.
  p.catch(() => bufferCache.delete(imageUrl))
  return remember(bufferCache, imageUrl, p)
}

/**
 * v2: 5-colour pastel palette (`#rrggbb` strings, OKLCH-pastelised) from album
 * art. Returns [] if there's no art or extraction fails.
 * @param {string|null} imageUrl
 * @returns {Promise<string[]>}
 */
export async function getAlbumPalette(imageUrl) {
  if (!imageUrl) return []
  if (paletteCache.has(imageUrl)) return paletteCache.get(imageUrl)
  try {
    const buffer = await fetchArt(imageUrl)
    const colors = (await getPalette(buffer, { colorCount: PALETTE_SIZE })) || []
    const palette = pastelPalette(colors.map((c) => c.array()))
    return remember(paletteCache, imageUrl, palette)
  } catch (e) {
    console.warn('[color] failed to extract album palette:', e.message)
    return []
  }
}

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h, s, l } // h in [0,360], s/l in [0,1]
}

// Extract the dominant color from album art and apply the plan's HSL transforms
// so the tint stays vivid but never too dark or too washed out:
//   - saturation ×1.3, clamped to 90%
//   - if lightness < 25%, bump to 35%
//   - if lightness > 75%, pull down to 65%
// Returns a CSS `hsl(...)` string, or null if there's no art / extraction fails.
export async function getAlbumColor(imageUrl) {
  if (!imageUrl) return null
  if (cache.has(imageUrl)) return cache.get(imageUrl)

  try {
    const buffer = await fetchArt(imageUrl)

    const dominant = await getColor(buffer)
    const [r, g, b] = dominant.array()

    let { h, s, l } = rgbToHsl(r, g, b)
    s = Math.min(s * 1.3, 0.9)
    if (l < 0.25) l = 0.35
    else if (l > 0.75) l = 0.65

    const color = `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
    remember(cache, imageUrl, color)
    return color
  } catch (e) {
    console.warn('[color] failed to extract album color:', e.message)
    return null
  }
}
