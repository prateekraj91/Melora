import 'dotenv/config'

// Which provider to try first. The other one is used automatically as a
// fallback if the primary fails (no key, network error, Ollama not running,
// timeout, bad response). Flip this in .env: LLM_PROVIDER=ollama | gemini
const PRIMARY = (process.env.LLM_PROVIDER || 'gemini').toLowerCase()

const GEMINI_KEY = process.env.GEMINI_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b'
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'

// How long to wait on a provider before giving up and falling back (ms).
const TIMEOUT_MS = 20000

// Small fetch wrapper that aborts after TIMEOUT_MS so a hung request triggers
// the fallback instead of blocking the hover forever.
async function fetchWithTimeout(url, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function geminiComplete(prompt, { maxTokens = 200, json = false } = {}) {
  if (!GEMINI_KEY) throw new Error('gemini: GEMINI_KEY not set')

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(json && { responseMimeType: 'application/json' })
        }
      })
    }
  )

  if (!res.ok) throw new Error(`gemini: HTTP ${res.status}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('gemini: empty response')
  return text.trim()
}

async function ollamaComplete(prompt, { maxTokens = 200, json = false } = {}) {
  const res = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      // Disable reasoning output. Thinking models (e.g. qwen3) otherwise emit
      // their <think> tokens into a separate "thinking" field and can burn the
      // whole num_predict budget on reasoning, leaving "response" empty (or
      // timing out on cold load). Non-thinking models ignore this flag.
      think: false,
      ...(json && { format: 'json' }),
      options: { num_predict: maxTokens }
    })
  })

  if (!res.ok) throw new Error(`ollama: HTTP ${res.status}`)
  const data = await res.json()
  if (!data?.response) throw new Error('ollama: empty response')
  return data.response.trim()
}

const providers = {
  gemini: geminiComplete,
  ollama: ollamaComplete
}

// Try the primary provider, then the other one. Returns the first success.
// Throws only if BOTH fail, with both errors attached.
async function complete(prompt, opts = {}) {
  const order = PRIMARY === 'ollama' ? ['ollama', 'gemini'] : ['gemini', 'ollama']
  const errors = []

  for (const name of order) {
    try {
      const out = await providers[name](prompt, opts)
      if (errors.length) {
        console.warn(`[llm] primary failed, served by fallback "${name}":`, errors[0]?.message)
      }
      return out
    } catch (err) {
      errors.push(err)
      console.warn(`[llm] provider "${name}" failed:`, err.message)
    }
  }

  const detail = errors.map((e) => e.message).join(' | ')
  throw new Error(`[llm] all providers failed: ${detail}`)
}

// ---- prompts (provider-agnostic) -------------------------------------------

function lyricMeaningPrompt(song, artist, lyric) {
  return `In 2 sentences, explain the meaning of this lyric from "${song}" by ${artist}.\nLyric: "${lyric}"\nBe concise and concrete. No preamble.`
}

function moodPrompt(song, artist) {
  return `For the song "${song}" by ${artist}, infer its mood.\nReturn ONLY a JSON object, no markdown, with keys: mood (string), color_hex (string like "#1db954"), intensity (number 0-1).`
}

function digestPrompt(log) {
  return `Here is a listening log for the week:\n${log}\nWrite a short, warm 1-paragraph digest summarizing the listening mood and standout artists. No preamble.`
}

// ---- public API ------------------------------------------------------------

// Bounded lyric-meaning cache. This is an always-on overlay, so an unbounded
// Map would creep upward for every line of every song across a long session.
// Cap it and evict the oldest entry (Map preserves insertion order) once full —
// 50 lines is far more than one screen's worth of context.
const CACHE_MAX = 50
const cache = new Map()

function cachePut(key, value) {
  cache.set(key, value)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
}

export async function getLyricMeaning(song, artist, lyric) {
  const key = `${song}::${lyric}`
  if (cache.has(key)) return cache.get(key)
  const meaning = await complete(lyricMeaningPrompt(song, artist, lyric), { maxTokens: 80 })
  cachePut(key, meaning)
  return meaning
}

export async function getMood(song, artist) {
  const raw = await complete(moodPrompt(song, artist), { maxTokens: 60, json: true })
  return JSON.parse(raw) // { mood, color_hex, intensity }
}

export async function getWeeklyDigest(log) {
  return complete(digestPrompt(log), { maxTokens: 250 })
}

// Optional: warm Ollama on app launch so the first hover isn't a cold load.
// Safe to call regardless of provider — it just no-ops if Ollama is down.
export async function warmOllama() {
  try {
    await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // think:false + a tiny num_predict keep this warm-up cheap. Without them
      // a thinking model (qwen3) spends ~18s reasoning here, and because Ollama
      // serializes requests per model that blocks the first real request long
      // enough to trip its timeout.
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: 'ok',
        stream: false,
        think: false,
        keep_alive: '30m',
        options: { num_predict: 1 }
      })
    })
  } catch {
    // Ollama not running — fine, Gemini will handle requests.
  }
}
