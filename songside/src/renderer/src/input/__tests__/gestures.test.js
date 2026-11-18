import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createGestureClassifier, HOLD_MS } from '../gestures.js'

const FRAME = 16

/**
 * Feed a sequence of wheel deltas at 16ms spacing starting at t0.
 * @returns {{ cmds: object[], t: number }} commands emitted and the last time
 */
function wheelSeq(g, t0, deltas, { ctrlKey = false } = {}) {
  const cmds = []
  let t = t0
  for (const [dx, dy] of deltas) {
    cmds.push(...g.wheel({ t, deltaX: dx, deltaY: dy, ctrlKey }))
    t += FRAME
  }
  return { cmds, t: t - FRAME }
}

const repeat = (n, d) => Array.from({ length: n }, () => d)
/** A fling: strong deltas then a decaying momentum tail. */
const fling = (dir, n = 8, tail = 40) => [
  ...repeat(n, [dir * 25, 1]),
  ...Array.from({ length: tail }, (_, i) => [dir * 25 * Math.pow(0.9, i + 1), 0])
]

describe('horizontal swipes', () => {
  test('swipe left (positive deltaX) → exactly one next', () => {
    const g = createGestureClassifier()
    const { cmds } = wheelSeq(g, 0, repeat(10, [20, 2]))
    assert.deepEqual(cmds, [{ type: 'next' }])
  })

  test('swipe right → exactly one prev', () => {
    const g = createGestureClassifier()
    assert.deepEqual(wheelSeq(g, 0, repeat(10, [-20, -1])).cmds, [{ type: 'prev' }])
  })

  test('below the 120px threshold → nothing', () => {
    const g = createGestureClassifier()
    assert.deepEqual(wheelSeq(g, 0, repeat(5, [20, 0])).cmds, [])
  })

  test('a long momentum tail does not cause a second skip', () => {
    const g = createGestureClassifier()
    assert.deepEqual(wheelSeq(g, 0, fling(1)).cmds, [{ type: 'next' }])
  })

  test('a momentum tail split by a >150ms gap still does not double-skip', () => {
    const g = createGestureClassifier()
    const a = wheelSeq(g, 0, fling(1, 8, 10))
    // new "gesture" 200ms later: more momentum, big enough to cross 120px again
    const b = wheelSeq(g, a.t + 200, repeat(8, [20, 0]))
    assert.deepEqual([...a.cmds, ...b.cmds], [{ type: 'next' }])
  })

  test('a deliberate second swipe after the cooldown skips again', () => {
    const g = createGestureClassifier()
    const a = wheelSeq(g, 0, repeat(10, [20, 0]))
    const b = wheelSeq(g, a.t + 600, repeat(10, [20, 0]))
    assert.deepEqual([...a.cmds, ...b.cmds], [{ type: 'next' }, { type: 'next' }])
  })

  test('diagonal motion that is not clearly horizontal does not skip', () => {
    const g = createGestureClassifier()
    const { cmds } = wheelSeq(g, 0, repeat(12, [15, 10])) // |ΣdX| < 2|ΣdY|
    assert.ok(!cmds.some((c) => c.type === 'next' || c.type === 'prev'))
  })
})

describe('vertical volume', () => {
  test('continuous scroll up → +5 steps, throttled to one per 120ms', () => {
    const g = createGestureClassifier()
    const { cmds } = wheelSeq(g, 0, repeat(40, [0, 8])) // 640ms of scrolling
    assert.ok(cmds.length >= 4 && cmds.length <= 6, `steps: ${cmds.length}`)
    assert.ok(cmds.every((c) => c.type === 'volumeDelta' && c.delta === 5))
  })

  test('scroll down → -5 steps', () => {
    const g = createGestureClassifier()
    const { cmds } = wheelSeq(g, 0, repeat(20, [0, -10]))
    assert.ok(cmds.length >= 2)
    assert.ok(cmds.every((c) => c.delta === -5))
  })

  test('a vertical scroll with horizontal drift never skips', () => {
    const g = createGestureClassifier()
    const { cmds } = wheelSeq(g, 0, [...repeat(10, [3, 12]), ...repeat(10, [14, 2])])
    assert.ok(!cmds.some((c) => c.type === 'next' || c.type === 'prev'))
  })

  test('a horizontal swipe never changes the volume', () => {
    const g = createGestureClassifier()
    const { cmds } = wheelSeq(g, 0, fling(-1))
    assert.deepEqual(cmds, [{ type: 'prev' }])
  })

  test('tiny jitter does not change volume', () => {
    const g = createGestureClassifier()
    assert.deepEqual(wheelSeq(g, 0, repeat(30, [0, 0.5])).cmds, [])
  })
})

test('ctrl+wheel (pinch zoom) is ignored', () => {
  const g = createGestureClassifier()
  assert.deepEqual(wheelSeq(g, 0, repeat(20, [30, 0]), { ctrlKey: true }).cmds, [])
  assert.deepEqual(wheelSeq(g, 1000, repeat(20, [0, 30]), { ctrlKey: true }).cmds, [])
})

describe('click and hold', () => {
  test('quick click → toggle', () => {
    const g = createGestureClassifier()
    g.pointerDown({ t: 0, x: 100, y: 100, button: 0 })
    g.pointerMove({ t: 50, x: 102, y: 101 })
    assert.deepEqual(g.pointerUp({ t: 120, x: 103, y: 101 }), [{ type: 'toggle' }])
  })

  test('slow click (≥ 250ms) → nothing', () => {
    const g = createGestureClassifier()
    g.pointerDown({ t: 0, x: 0, y: 0 })
    assert.deepEqual(g.tick(300), [])
    assert.deepEqual(g.pointerUp({ t: 300, x: 0, y: 0 }), [])
  })

  test('click that moved ≥ 6px → nothing (it was a drag)', () => {
    const g = createGestureClassifier()
    g.pointerDown({ t: 0, x: 0, y: 0 })
    assert.deepEqual(g.pointerUp({ t: 100, x: 8, y: 0 }), [])
  })

  test('right/middle button is ignored', () => {
    const g = createGestureClassifier()
    g.pointerDown({ t: 0, x: 0, y: 0, button: 2 })
    assert.deepEqual(g.pointerUp({ t: 50, x: 0, y: 0 }), [])
  })

  test('press and hold ≥ 600ms → like once, release adds nothing', () => {
    const g = createGestureClassifier()
    g.pointerDown({ t: 0, x: 10, y: 10 })
    assert.deepEqual(g.tick(HOLD_MS - 1), [])
    assert.deepEqual(g.tick(HOLD_MS + 10), [{ type: 'like' }])
    assert.deepEqual(g.tick(HOLD_MS + 500), [])
    assert.deepEqual(g.pointerUp({ t: HOLD_MS + 600, x: 10, y: 10 }), [])
  })

  test('hold while moving → no like', () => {
    const g = createGestureClassifier()
    g.pointerDown({ t: 0, x: 0, y: 0 })
    g.pointerMove({ t: 200, x: 20, y: 0 })
    assert.deepEqual(g.tick(700), [])
  })

  test('pointercancel clears the press', () => {
    const g = createGestureClassifier()
    g.pointerDown({ t: 0, x: 0, y: 0 })
    g.pointerCancel()
    assert.deepEqual(g.tick(700), [])
    assert.deepEqual(g.pointerUp({ t: 100, x: 0, y: 0 }), [])
  })
})
