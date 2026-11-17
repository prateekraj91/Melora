// Word-level timing estimated from line-level LRC timestamps (v2 task 1.5).
//
// LRCLIB only times whole lines, so we spread each line's words across a
// "singing span" in proportion to a per-word weight:
//   • Latin text: syllables (vowel groups, silent trailing 'e' dropped, min 1)
//   • Non-Latin text (Devanagari, CJK, Cyrillic…): letter count (combining
//     marks such as Devanagari matras don't count), min 1
//   • plus a small bonus for trailing punctuation (singers hold before a pause)
//
// The span is NOT the whole gap to the next line: an 8-second instrumental
// after a short line would otherwise drag its last word out for seconds. It is
// capped at min(endTime - time, words × 420ms + 300ms).
//
// Pure, no React / DOM — unit-tested with node:test.

/** @typedef {import('../../../shared/types.js').LyricsDoc} LyricsDoc */
/** @typedef {import('../../../shared/types.js').LyricLine} LyricLine */
/** @typedef {import('../../../shared/types.js').LyricWord} LyricWord */

export const MS_PER_WORD = 420
export const SPAN_PADDING_MS = 300
export const PUNCTUATION_BONUS = 0.5

const TRAILING_PUNCT = /[,.;:!?…\-–—)"'”’]+$/u
const LATIN_LETTER = /[a-z]/
const LETTER = /\p{L}/gu

/**
 * Syllable estimate for one word (punctuation ignored). Latin words count
 * vowel groups; words with no Latin letters fall back to their letter count.
 * Always ≥ 1.
 * @param {string} word
 * @returns {number}
 */
export function countSyllables(word) {
  // Strip accents (é → e) so accented Latin still counts as Latin.
  const base = word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const latin = base.replace(/[^a-z]/g, '')

  if (!LATIN_LETTER.test(base)) {
    // Non-Latin script: count letters on the ORIGINAL word so Devanagari
    // vowel signs (combining marks, \p{M}) aren't counted as extra units.
    const letters = word.match(LETTER)
    return Math.max(1, letters ? letters.length : 0)
  }

  const groups = latin.match(/[aeiouy]+/g)
  let n = groups ? groups.length : 0
  // Silent trailing 'e' ("love", "time") — but not "-le" ("little"), "the",
  // or an accented final é ("café"), which is checked on the un-stripped word.
  const endsWithPlainE = /e$/.test(word.toLowerCase().replace(/[^\p{L}]/gu, ''))
  if (n > 1 && endsWithPlainE && /[^aeiouy]e$/.test(latin) && !/[^aeiouy]le$/.test(latin)) n -= 1
  return Math.max(1, n)
}

/**
 * Relative singing weight of a word: syllables + trailing-punctuation bonus.
 * @param {string} word
 * @returns {number}
 */
export function wordWeight(word) {
  return countSyllables(word) + (TRAILING_PUNCT.test(word) ? PUNCTUATION_BONUS : 0)
}

/**
 * How long the words of a line are actually sung, in ms.
 * @param {LyricLine} line
 * @param {number} wordCount
 * @returns {number}
 */
export function singingSpan(line, wordCount) {
  const gap = Math.max(0, (line.endTime ?? line.time) - line.time)
  return Math.min(gap, wordCount * MS_PER_WORD + SPAN_PADDING_MS)
}

/**
 * Word timings for one line. Words are contiguous, monotonic and
 * non-overlapping: words[0].start === line.time, words[i].end ===
 * words[i+1].start, and the last end === line.time + singingSpan.
 * @param {LyricLine} line
 * @returns {LyricWord[]}
 */
export function timeLine(line) {
  const texts = (line.text ?? '').split(/\s+/).filter(Boolean)
  if (!texts.length) return []

  const weights = texts.map(wordWeight)
  const total = weights.reduce((a, b) => a + b, 0)
  const span = singingSpan(line, texts.length)

  const words = []
  let acc = 0
  let start = line.time
  for (let i = 0; i < texts.length; i++) {
    acc += weights[i]
    const end = i === texts.length - 1 ? line.time + span : line.time + (span * acc) / total
    words.push({ text: texts[i], start, end })
    start = end
  }
  return words
}

/**
 * Returns a NEW doc where every line has `words`. The input is not mutated.
 * Docs without synced lines (plain / none) come back as a shallow copy.
 * @param {LyricsDoc} doc
 * @returns {LyricsDoc}
 */
export function addWordTimings(doc) {
  return {
    ...doc,
    lines: (doc.lines ?? []).map((line) => ({ ...line, words: timeLine(line) }))
  }
}
