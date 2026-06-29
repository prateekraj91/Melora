import { BrowserWindow } from 'electron'
import crypto from 'crypto'
import { getSpotifyTokens, saveSpotifyTokens } from './store.js'

const REDIRECT_URI = 'http://127.0.0.1:8888/callback'
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
// user-modify-playback-state is required for the click-to-seek feature
// (PUT /me/player/seek); the read scopes cover currently-playing + position.
const SCOPES = 'user-read-playback-state user-read-currently-playing user-modify-playback-state'

function generateRandomString(length) {
  return crypto.randomBytes(60).toString('hex').substring(0, length)
}

function generateCodeChallenge(codeVerifier) {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64')
  return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let authWindow = null

export async function loginSpotify(mainWindow) {
  // Already in progress — focus the existing window instead of opening a
  // second one or leaving a hanging promise. The active flow owns the result.
  if (authWindow) {
    authWindow.focus()
    return false
  }

  return new Promise((resolve, reject) => {
    // Guard so the promise settles exactly once. The window's 'closed' event
    // fires on every path (success, error, user cancel), so without this a
    // successful resolve could be followed by a stray cancel resolve.
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }

    const state = generateRandomString(16)
    const codeVerifier = generateRandomString(128)
    const codeChallenge = generateCodeChallenge(codeVerifier)

    authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    const authUrl = new URL('https://accounts.spotify.com/authorize')
    authUrl.searchParams.append('client_id', CLIENT_ID)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI)
    authUrl.searchParams.append('state', state)
    authUrl.searchParams.append('scope', SCOPES)
    authUrl.searchParams.append('code_challenge_method', 'S256')
    authUrl.searchParams.append('code_challenge', codeChallenge)

    authWindow.loadURL(authUrl.toString())

    // Spotify's final hop to the callback can arrive either as an HTTP redirect
    // (will-redirect) or as a fresh top-level navigation (will-navigate),
    // depending on how the auth page bounces back. Handle both so we always
    // intercept the callback before it hits the network — there's no local
    // server on 8888, so letting it through gives ERR_CONNECTION_REFUSED and a
    // blank window.
    const handleCallback = async (event, url) => {
      if (!url.startsWith(REDIRECT_URI)) return
      event.preventDefault()
      const code = new URL(url).searchParams.get('code')

      if (code) {
        try {
          await exchangeCodeForToken(code, codeVerifier)
          finish(resolve, true)
        } catch (e) {
          finish(reject, e)
        }
      }
      // No code means the user denied or Spotify returned an error. We don't
      // settle here — closing the window below resolves false (a clean cancel).
      if (authWindow) authWindow.close()
    }

    authWindow.webContents.on('will-redirect', handleCallback)
    authWindow.webContents.on('will-navigate', handleCallback)

    authWindow.on('closed', () => {
      authWindow = null
      // Closed before any other outcome settled it → user cancelled.
      // Resolve false (not reject) so the renderer doesn't show an error and
      // the "Connect Spotify" button stays visible for an immediate retry.
      finish(resolve, false)
    })
  })
}

async function exchangeCodeForToken(code, codeVerifier) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier
    })
  })

  if (!response.ok) {
    throw new Error('Failed to exchange token')
  }

  const data = await response.json()
  saveSpotifyTokens(data.access_token, data.refresh_token, data.expires_in)
}

export async function refreshAccessToken() {
  const tokens = getSpotifyTokens()
  if (!tokens.refreshToken) {
    throw new Error('No refresh token available')
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken
    })
  })

  if (!response.ok) {
    throw new Error('Failed to refresh token')
  }

  const data = await response.json()
  // Some APIs don't return a new refresh token on refresh
  saveSpotifyTokens(data.access_token, data.refresh_token || tokens.refreshToken, data.expires_in)
}

export async function getValidAccessToken() {
  const tokens = getSpotifyTokens()
  if (!tokens.accessToken) return null

  // Refresh if within 1 minute of expiring
  if (Date.now() > tokens.expiresAt - 60000) {
    try {
      await refreshAccessToken()
      return getSpotifyTokens().accessToken
    } catch (e) {
      console.error('Failed to refresh token:', e)
      return null
    }
  }

  return tokens.accessToken
}

export async function getCurrentlyPlaying() {
  const token = await getValidAccessToken()
  if (!token) return null

  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (response.status === 204) {
    return null // Nothing playing
  }

  // A 403 here is a benign, expected state (e.g. Spotify dev-mode user
  // restrictions or no Premium), not a bug — treat it like "nothing playing"
  // and soft-log instead of throwing a stack trace every poll.
  if (response.status === 403) {
    console.warn('[spotify] currently-playing 403 — skipping (account/app restriction)')
    return null
  }

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`)
  }

  return response.json()
}

// Seek the active playback to position_ms. Returns true on success. A 404 means
// there's no active device to seek; we treat that (and other failures) as a
// soft no-op rather than throwing, since this is a best-effort UI action.
export async function seekTo(positionMs) {
  const token = await getValidAccessToken()
  if (!token) return false

  const ms = Math.max(0, Math.round(positionMs))
  const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${ms}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  })

  // Spotify returns 204 (No Content) on success, occasionally 202 (Accepted).
  if (response.ok || response.status === 202) return true
  console.warn(`[spotify] seek failed: ${response.status}`)
  return false
}
