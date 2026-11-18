import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  commandToRequest,
  optimisticPatch,
  createCommandRunner,
  positionNow
} from '../spotify/commands.js'

const state = (over = {}) => ({
  connected: true,
  status: 'playing',
  track: { id: 'abc', uri: 'spotify:track:abc', durationMs: 200000 },
  positionMs: 10000,
  positionAt: 1000,
  isPlaying: true,
  volume: 40,
  device: 'spotify-app',
  color: null,
  palette: [],
  ...over
})

describe('commandToRequest', () => {
  const cases = [
    [{ type: 'play' }, state(), { method: 'PUT', path: '/me/player/play' }],
    [{ type: 'pause' }, state(), { method: 'PUT', path: '/me/player/pause' }],
    [{ type: 'toggle' }, state(), { method: 'PUT', path: '/me/player/pause' }],
    [{ type: 'toggle' }, state({ isPlaying: false }), { method: 'PUT', path: '/me/player/play' }],
    [{ type: 'next' }, state(), { method: 'POST', path: '/me/player/next' }],
    [{ type: 'prev' }, state(), { method: 'POST', path: '/me/player/previous' }],
    [
      { type: 'seek', positionMs: 61234.6 },
      state(),
      { method: 'PUT', path: '/me/player/seek?position_ms=61235' }
    ],
    [
      { type: 'seek', positionMs: -5 },
      state(),
      { method: 'PUT', path: '/me/player/seek?position_ms=0' }
    ],
    [
      { type: 'volume', value: 73.4 },
      state(),
      { method: 'PUT', path: '/me/player/volume?volume_percent=73' }
    ],
    [
      { type: 'volume', value: 140 },
      state(),
      { method: 'PUT', path: '/me/player/volume?volume_percent=100' }
    ],
    [
      { type: 'volumeDelta', delta: 10 },
      state(),
      { method: 'PUT', path: '/me/player/volume?volume_percent=50' }
    ],
    [
      { type: 'volumeDelta', delta: -50 },
      state(),
      { method: 'PUT', path: '/me/player/volume?volume_percent=0' }
    ],
    [
      { type: 'volumeDelta', delta: 5 },
      state({ volume: null }),
      { method: 'PUT', path: '/me/player/volume?volume_percent=55' }
    ],
    [
      { type: 'playUri', uri: 'spotify:track:xyz' },
      state(),
      { method: 'PUT', path: '/me/player/play', body: { uris: ['spotify:track:xyz'] } }
    ],
    [
      { type: 'playUri', uri: 'spotify:playlist:pl1' },
      state(),
      { method: 'PUT', path: '/me/player/play', body: { context_uri: 'spotify:playlist:pl1' } }
    ],
    [
      { type: 'queue', uri: 'spotify:track:q 1' },
      state(),
      { method: 'POST', path: '/me/player/queue?uri=spotify%3Atrack%3Aq%201' }
    ],
    [{ type: 'like' }, state(), { method: 'PUT', path: '/me/tracks?ids=abc' }],
    [{ type: 'like', trackId: 'other' }, state(), { method: 'PUT', path: '/me/tracks?ids=other' }]
  ]
  for (const [cmd, st, expected] of cases) {
    test(`${JSON.stringify(cmd)}${st.isPlaying ? '' : ' (paused)'}`, () =>
      assert.deepEqual(commandToRequest(cmd, st), expected))
  }

  test('invalid commands → null', () => {
    assert.equal(commandToRequest({ type: 'seek' }, state()), null)
    assert.equal(commandToRequest({ type: 'volume', value: 'loud' }, state()), null)
    assert.equal(commandToRequest({ type: 'playUri', uri: 'https://x' }, state()), null)
    assert.equal(commandToRequest({ type: 'like' }, state({ track: null })), null)
    assert.equal(commandToRequest({ type: 'sleep', minutes: 10 }, state()), null)
    assert.equal(commandToRequest({ type: 'dance' }, state()), null)
    assert.equal(commandToRequest(null, state()), null)
  })
})

describe('optimisticPatch', () => {
  test('pause freezes the interpolated position', () => {
    const p = optimisticPatch({ type: 'toggle' }, state(), 6000)
    assert.deepEqual(p, { isPlaying: false, status: 'paused', positionMs: 15000, positionAt: 6000 })
  })
  test('play re-anchors from the paused position', () => {
    const p = optimisticPatch({ type: 'play' }, state({ isPlaying: false }), 9000)
    assert.deepEqual(p, { isPlaying: true, status: 'playing', positionMs: 10000, positionAt: 9000 })
  })
  test('volume and volumeDelta set the clamped volume', () => {
    assert.deepEqual(optimisticPatch({ type: 'volumeDelta', delta: 70 }, state()), { volume: 100 })
    assert.deepEqual(optimisticPatch({ type: 'volume', value: 12 }, state()), { volume: 12 })
  })
  test('next / like have no optimistic patch', () => {
    assert.equal(optimisticPatch({ type: 'next' }, state()), null)
    assert.equal(optimisticPatch({ type: 'like' }, state()), null)
  })
  test('positionNow clamps to the track length', () => {
    assert.equal(positionNow(state(), 1_000_000), 200000)
    assert.equal(positionNow(state({ isPlaying: false }), 1_000_000), 10000)
  })
})

/** A scripted fake fetch: returns responses in order and records requests. */
function fakeFetch(statuses) {
  const calls = []
  const queue = [...statuses]
  const fn = async (url, init) => {
    calls.push({ url, ...init })
    const s = queue.length ? queue.shift() : 204
    const status = typeof s === 'number' ? s : s.status
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => (typeof s === 'object' ? s.body : {})
    }
  }
  fn.calls = calls
  return fn
}

function runner(statuses, over = {}) {
  const fetch = fakeFetch(statuses)
  const log = []
  const updates = []
  let polls = 0
  const timers = []
  let token = 'tok1'
  let refreshes = 0
  const run = createCommandRunner({
    fetch,
    getToken: async () => token,
    refreshToken: async () => {
      refreshes++
      token = 'tok2'
    },
    getState: () => state(),
    updateState: (p) => updates.push(p),
    pollNow: () => polls++,
    log: (...a) => log.push(a.join(' ')),
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    ...over
  })
  return {
    run,
    fetch,
    log,
    updates,
    get polls() {
      return polls
    },
    timers,
    get refreshes() {
      return refreshes
    }
  }
}

describe('runCommand', () => {
  test('success: sends the request with auth, patches the store, polls now and again', async () => {
    const r = runner([204])
    assert.equal(await r.run({ type: 'volumeDelta', delta: -10 }), true)
    assert.equal(r.fetch.calls.length, 1)
    const call = r.fetch.calls[0]
    assert.equal(call.url, 'https://api.spotify.com/v1/me/player/volume?volume_percent=30')
    assert.equal(call.method, 'PUT')
    assert.equal(call.headers.Authorization, 'Bearer tok1')
    assert.deepEqual(r.updates, [{ volume: 30 }])
    assert.equal(r.polls, 1)
    assert.equal(r.timers[0].ms, 700)
    r.timers[0].fn()
    assert.equal(r.polls, 2)
  })

  test('JSON body for playUri', async () => {
    const r = runner([204])
    await r.run({ type: 'playUri', uri: 'spotify:album:al' })
    const call = r.fetch.calls[0]
    assert.equal(call.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(call.body), { context_uri: 'spotify:album:al' })
  })

  test('401 → refresh token and retry once', async () => {
    const r = runner([401, 204])
    assert.equal(await r.run({ type: 'next' }), true)
    assert.equal(r.refreshes, 1)
    assert.equal(r.fetch.calls.length, 2)
    assert.equal(r.fetch.calls[1].headers.Authorization, 'Bearer tok2')
  })

  test('404 (no active device) → false, logged, no store patch', async () => {
    const r = runner([404])
    assert.equal(await r.run({ type: 'pause' }), false)
    assert.match(r.log.join('\n'), /no active Spotify device/)
    assert.deepEqual(r.updates, [])
    assert.equal(r.polls, 0)
  })

  test('403 (not Premium) → false with the reason logged', async () => {
    const r = runner([{ status: 403, body: { error: { reason: 'PREMIUM_REQUIRED' } } }])
    assert.equal(await r.run({ type: 'play' }), false)
    assert.match(r.log.join('\n'), /PREMIUM_REQUIRED/)
  })

  test('other HTTP errors and network failures → false', async () => {
    assert.equal(await runner([500]).run({ type: 'next' }), false)
    const r = runner([], {
      fetch: async () => {
        throw new Error('offline')
      }
    })
    assert.equal(await r.run({ type: 'next' }), false)
    assert.match(r.log.join('\n'), /offline/)
  })

  test('not connected → false without calling the API', async () => {
    const r = runner([], { getToken: async () => null })
    assert.equal(await r.run({ type: 'play' }), false)
    assert.equal(r.fetch.calls.length, 0)
  })

  test('unknown / invalid / sleep commands → false without calling the API', async () => {
    const r = runner([])
    assert.equal(await r.run({ type: 'dance' }), false)
    assert.equal(await r.run({ type: 'seek' }), false)
    assert.equal(await r.run({ type: 'sleep', minutes: 5 }), false)
    assert.equal(r.fetch.calls.length, 0)
  })
})
