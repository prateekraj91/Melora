import { getColor } from 'colorthief'

// Cache computed colors per album-art URL. Art URLs are stable per album, and
// the renderer polls on an interval, so this avoids re-fetching + re-decoding
// the same image every few seconds.
const cache = new Map()

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
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`art fetch failed: HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())

    const dominant = await getColor(buffer)
    const [r, g, b] = dominant.array()

    let { h, s, l } = rgbToHsl(r, g, b)
    s = Math.min(s * 1.3, 0.9)
    if (l < 0.25) l = 0.35
    else if (l > 0.75) l = 0.65

    const color = `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
    cache.set(imageUrl, color)
    return color
  } catch (e) {
    console.warn('[color] failed to extract album color:', e.message)
    return null
  }
}
