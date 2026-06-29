import Store from 'electron-store'

const store = new Store()

export function getSpotifyTokens() {
  return {
    accessToken: store.get('spotifyAccessToken'),
    refreshToken: store.get('spotifyRefreshToken'),
    expiresAt: store.get('spotifyExpiresAt')
  }
}

export function saveSpotifyTokens(accessToken, refreshToken, expiresIn) {
  store.set('spotifyAccessToken', accessToken)
  if (refreshToken) {
    store.set('spotifyRefreshToken', refreshToken)
  }
  // expiresIn is in seconds, store expiresAt as timestamp
  const expiresAt = Date.now() + expiresIn * 1000
  store.set('spotifyExpiresAt', expiresAt)
}

export function clearSpotifyTokens() {
  store.delete('spotifyAccessToken')
  store.delete('spotifyRefreshToken')
  store.delete('spotifyExpiresAt')
}

export default store
