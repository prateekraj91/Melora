import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  countSyllables,
  wordWeight,
  singingSpan,
  timeLine,
  addWordTimings,
  MS_PER_WORD,
  SPAN_PADDING_MS,
  PUNCTUATION_BONUS
} from '../wordTiming.js'
import { getActiveAt, getTimedDoc, NO_ACTIVE } from '../activeWord.js'

const line = (time, endTime, text) => ({ time, endTime, text })

/** Every line's words start at line.time, are contiguous and never go backwards. */
function assertWellFormed(timedLine) {
  const { words } = timedLine
  if (!words.length) return
  assert.equal(words[0].start, timedLine.time)
  for (let i = 0; i < words.length; i++) {
    assert.ok(words[i].end > words[i].start, `word ${i} has positive duration`)
    if (i > 0)
      assert.equal(words[i].start, words[i - 1].end, `word ${i} starts where ${i - 1} ends`)
  }
  assert.ok(words.at(-1).end <= timedLine.endTime, 'last word ends by the next line')
}

describe('countSyllables', () => {
  for (const [word, n] of [
    ['a', 1],
    ['love', 1],
    ['time', 1],
    ['the', 1],
    ['little', 2],
    ['baby', 2],
    ['heaven', 2],
    ['beautiful', 3],
    ['remember', 3],
    ['rhythm', 1],
    ['hmm', 1],
    ['café', 2]
  ]) {
    test(`${word} → ${n}`, () => assert.equal(countSyllables(word), n))
  }

  test('ignores punctuation', () => {
    assert.equal(countSyllables('baby,'), 2)
    assert.equal(countSyllables('"love"'), 1)
  })

  test('minimum is 1 (numbers, symbols)', () => {
    assert.equal(countSyllables('2024'), 1)
    assert.equal(countSyllables('—'), 1)
  })

  test('Devanagari counts letters, not vowel signs', () => {
    assert.equal(countSyllables('तुम'), 2) // त ु म → 2 letters
    assert.equal(countSyllables('ही'), 1) // ह ी → 1 letter
    assert.equal(countSyllables('हवाएँ'), 3) // ह व ा ए ँ → 3 letters + 2 signs
  })

  test('other scripts fall back to letter count', () => {
    assert.equal(countSyllables('любовь'), 6)
    assert.equal(countSyllables('愛してる'), 4)
  })
})

describe('wordWeight', () => {
  test('adds a bonus for trailing punctuation only', () => {
    assert.equal(wordWeight('baby'), 2)
    assert.equal(wordWeight('baby,'), 2 + PUNCTUATION_BONUS)
    assert.equal(wordWeight('oh!'), 1 + PUNCTUATION_BONUS)
    assert.equal(wordWeight("don't"), 1)
  })
})

describe('singing span', () => {
  test('a long instrumental gap is capped at words × 420 + 300', () => {
    const l = line(10_000, 30_000, 'hold me')
    assert.equal(singingSpan(l, 2), 2 * MS_PER_WORD + SPAN_PADDING_MS)
    const words = timeLine(l)
    assert.equal(words.at(-1).end, 10_000 + 2 * MS_PER_WORD + SPAN_PADDING_MS)
  })

  test('a short gap uses the full gap', () => {
    const l = line(0, 1000, 'one two three four five six')
    assert.equal(singingSpan(l, 6), 1000)
    assert.equal(timeLine(l).at(-1).end, 1000)
  })

  test('a zero/negative gap yields zero-length span without throwing', () => {
    assert.equal(singingSpan(line(500, 500, 'x'), 1), 0)
    assert.equal(singingSpan(line(500, 400, 'x'), 1), 0)
  })
})

describe('timeLine', () => {
  test('words are monotonic, contiguous and non-overlapping', () => {
    const l = line(1000, 6000, 'Never gonna give you up, never gonna let you down')
    const words = timeLine(l)
    assert.equal(words.length, 10)
    assertWellFormed({ ...l, words })
  })

  test('longer words get more time', () => {
    const words = timeLine(line(0, 10_000, 'a beautiful day'))
    const dur = (w) => w.end - w.start
    assert.ok(dur(words[1]) > dur(words[0]))
    assert.ok(dur(words[1]) > dur(words[2]))
  })

  test('single word spans the whole (capped) span', () => {
    const words = timeLine(line(2000, 2500, 'Hello'))
    assert.deepEqual(words, [{ text: 'Hello', start: 2000, end: 2500 }])
  })

  test('empty and whitespace-only lines have no words', () => {
    assert.deepEqual(timeLine(line(0, 1000, '')), [])
    assert.deepEqual(timeLine(line(0, 1000, '   ')), [])
    assert.deepEqual(timeLine({ time: 0, endTime: 1000 }), [])
  })

  test('collapses repeated whitespace', () => {
    assert.deepEqual(
      timeLine(line(0, 5000, '  so   much  ')).map((w) => w.text),
      ['so', 'much']
    )
  })

  test('Hindi line is timed and well-formed', () => {
    const l = line(5000, 9000, 'तुम ही हो, अब तुम ही हो')
    const words = timeLine(l)
    assert.equal(words.length, 7)
    assertWellFormed({ ...l, words })
    // "तुम" (2 letters) gets more time than "ही" (1 letter).
    assert.ok(words[0].end - words[0].start > words[1].end - words[1].start)
  })

  test('mixed Hindi + English line is well-formed', () => {
    const l = line(0, 4000, 'Hawayein ये बता, oh baby')
    assertWellFormed({ ...l, words: timeLine(l) })
  })
})

describe('addWordTimings', () => {
  const doc = {
    trackId: 't1',
    mode: 'synced',
    plain: null,
    lines: [line(1000, 3000, 'first line here'), line(3000, 3100, 'quick'), line(3100, 9000, '')]
  }

  test('returns a new doc and does not mutate the input', () => {
    const before = JSON.stringify(doc)
    const timed = addWordTimings(doc)
    assert.notEqual(timed, doc)
    assert.equal(JSON.stringify(doc), before)
    assert.equal(timed.lines.length, 3)
    assert.equal(timed.lines[0].words.length, 3)
    assert.deepEqual(timed.lines[2].words, [])
    timed.lines.forEach(assertWellFormed)
  })

  test('plain / none docs pass through with no lines', () => {
    const plain = addWordTimings({ trackId: 't', mode: 'plain', lines: [], plain: 'la la' })
    assert.deepEqual(plain.lines, [])
    assert.equal(plain.plain, 'la la')
  })
})

describe('getActiveAt', () => {
  // Line 0: 1000–5000, "one two" → span capped at 2×420+300 = 1140 → sung 1000–2140
  // Line 1: 5000–6000, "three"   → span min(1000, 720) = 720       → sung 5000–5720
  // Line 2: 6000–8000, ""        → no words
  const timed = addWordTimings({
    trackId: 'x',
    mode: 'synced',
    plain: null,
    lines: [line(1000, 5000, 'one two'), line(5000, 6000, 'three'), line(6000, 8000, '')]
  })
  const [w0, w1] = timed.lines[0].words

  test('before the first line → line -1', () => {
    assert.deepEqual(getActiveAt(timed, 0), NO_ACTIVE)
    assert.deepEqual(getActiveAt(timed, 999), NO_ACTIVE)
  })

  test('exactly at the first line start → line 0, word 0, progress 0', () => {
    assert.deepEqual(getActiveAt(timed, 1000), {
      line: 0,
      word: 0,
      wordProgress: 0,
      lineProgress: 0
    })
  })

  test('exactly at a word boundary → the next word, progress 0', () => {
    const a = getActiveAt(timed, w1.start)
    assert.equal(a.line, 0)
    assert.equal(a.word, 1)
    assert.equal(a.wordProgress, 0)
  })

  test('just before a word boundary → previous word almost done', () => {
    const a = getActiveAt(timed, w0.end - 1)
    assert.equal(a.word, 0)
    assert.ok(a.wordProgress > 0.99 && a.wordProgress < 1)
  })

  test('instrumental tail holds the last word at progress 1', () => {
    assert.deepEqual(getActiveAt(timed, 4000), {
      line: 0,
      word: 1,
      wordProgress: 1,
      lineProgress: 1
    })
  })

  test('exactly at the next line start switches line', () => {
    assert.deepEqual(getActiveAt(timed, 5000), {
      line: 1,
      word: 0,
      wordProgress: 0,
      lineProgress: 0
    })
  })

  test('line with no words → word -1, lineProgress over the whole line', () => {
    assert.deepEqual(getActiveAt(timed, 7000), {
      line: 2,
      word: -1,
      wordProgress: 0,
      lineProgress: 0.5
    })
  })

  test('after the last line ends → stays on the last line at progress 1', () => {
    assert.equal(getActiveAt(timed, 99_000).line, 2)
    assert.equal(getActiveAt(timed, 99_000).lineProgress, 1)
  })

  test('null / empty docs → NO_ACTIVE', () => {
    assert.deepEqual(getActiveAt(null, 1000), NO_ACTIVE)
    assert.deepEqual(
      getActiveAt({ trackId: 'y', mode: 'none', lines: [], plain: null }, 1000),
      NO_ACTIVE
    )
  })
})

describe('getTimedDoc', () => {
  test('memoises per trackId across fresh objects with the same content', () => {
    const make = () => ({
      trackId: 'memo',
      mode: 'synced',
      plain: null,
      lines: [line(0, 1000, 'hi there')]
    })
    const a = getTimedDoc(make())
    const b = getTimedDoc(make())
    assert.equal(a, b)
    assert.equal(a.lines[0].words.length, 2)
  })

  test('different tracks get different timed docs; null passes through', () => {
    const a = getTimedDoc({ trackId: 'A', mode: 'synced', plain: null, lines: [line(0, 1, 'a')] })
    const b = getTimedDoc({ trackId: 'B', mode: 'synced', plain: null, lines: [line(0, 1, 'a')] })
    assert.notEqual(a, b)
    assert.equal(getTimedDoc(null), null)
  })
})
