import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  skipDirection,
  createSkipTracker,
  volumeLabel,
  volumeChanged,
  isPausedLook,
  takeFirstRun,
  bloomColour,
  HINT_KEY,
  SKIP_MS,
  SKIP_WAIT_MS
} from '../feedback.js'

test('skipDirection: next slides left, prev right, others none', () => {
  assert.equal(skipDirection({ type: 'next' }), -1)
  assert.equal(skipDirection({ type: 'prev' }), 1)
  assert.equal(skipDirection({ type: 'toggle' }), 0)
  assert.equal(skipDirection(null), 0)
})

describe('createSkipTracker', () => {
  test('non-skip commands do nothing', () => {
    const s = createSkipTracker()
    assert.equal(s.skip({ type: 'like' }, 0, 'a'), 0)
    assert.equal(s.isPending(), false)
    assert.equal(s.update(10, 'b'), null)
  })

  test('waits for a new lyrics doc, then slides in after the slide-out', () => {
    const s = createSkipTracker()
    assert.equal(s.skip({ type: 'next' }, 1000, 'a'), -1)
    assert.equal(s.update(1050, 'a'), null)
    assert.deepEqual(s.update(1100, 'b'), { dir: -1, delay: SKIP_MS - 100 })
    assert.equal(s.isPending(), false)
  })

  test('doc arriving after the slide-out → no delay', () => {
    const s = createSkipTracker()
    s.skip({ type: 'prev' }, 0, 'a')
    assert.deepEqual(s.update(500, 'b'), { dir: 1, delay: 0 })
  })

  test('no new doc → slides back in after the wait', () => {
    const s = createSkipTracker()
    s.skip({ type: 'next' }, 0, 'a')
    assert.equal(s.update(SKIP_WAIT_MS - 1, 'a'), null)
    assert.deepEqual(s.update(SKIP_WAIT_MS, 'a'), { dir: -1, delay: 0 })
  })

  test('double skip keeps the original doc id', () => {
    const s = createSkipTracker()
    s.skip({ type: 'next' }, 0, 'a')
    s.skip({ type: 'next' }, 100, 'a')
    assert.ok(s.update(150, 'b'))
  })
})

test('volumeLabel', () => {
  assert.equal(volumeLabel(60), 'vol 60')
  assert.equal(volumeLabel(59.6), 'vol 60')
  assert.equal(volumeLabel(140), 'vol 100')
  assert.equal(volumeLabel(null), null)
  assert.equal(volumeLabel(NaN), null)
})

test('volumeChanged ignores unknown → known (first load)', () => {
  assert.equal(volumeChanged(undefined, 50), false)
  assert.equal(volumeChanged(null, 50), false)
  assert.equal(volumeChanged(50, 50), false)
  assert.equal(volumeChanged(50, 55), true)
})

test('isPausedLook only for paused', () => {
  assert.equal(isPausedLook('paused'), true)
  for (const s of ['playing', 'idle', 'disconnected', undefined])
    assert.equal(isPausedLook(s), false)
})

describe('takeFirstRun', () => {
  const mem = () => {
    const m = new Map()
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }
  }
  test('true once, then false forever', () => {
    const st = mem()
    assert.equal(takeFirstRun(st), true)
    assert.equal(st.m.get(HINT_KEY), '1')
    assert.equal(takeFirstRun(st), false)
  })
  test('throwing / missing storage → false', () => {
    const bad = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {}
    }
    assert.equal(takeFirstRun(bad), false)
    assert.equal(takeFirstRun(null), false)
  })
})

test('bloomColour picks the lightest entry and lifts it', () => {
  const c = bloomColour([
    [0.2, 0.2, 0.2],
    [0.8, 0.6, 0.6],
    [0.1, 0.5, 0.3]
  ])
  assert.ok(Math.abs(c[0] - 0.85) < 1e-9 && Math.abs(c[1] - 0.7) < 1e-9)
})
