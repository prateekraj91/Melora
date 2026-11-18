import { useEffect, useRef, useState } from 'react'
import { VERTEX, FRAGMENT } from './shader.js'
import { normalisePalette, mixPalettes, easeInOut, rgbCss } from '../palette.js'

const MAX_DPR = 1.5
const CROSSFADE_MS = 2000
// Shader time runs a little faster than wall time so the drift is visible but
// still very slow (blob orbits take a couple of minutes).
const TIME_SCALE = 1.6

function compile(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`shader compile failed: ${log}`)
  }
  return sh
}

function createProgram(gl) {
  const prog = gl.createProgram()
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(prog)}`)
  }
  // One oversized triangle covering the viewport.
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a_pos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  gl.useProgram(prog)
  return {
    res: gl.getUniformLocation(prog, 'u_res'),
    time: gl.getUniformLocation(prog, 'u_time'),
    energy: gl.getUniformLocation(prog, 'u_energy'),
    colors: gl.getUniformLocation(prog, 'u_colors')
  }
}

function initialColours(palette) {
  const p = normalisePalette(palette)
  return { from: p, to: p, current: p.map((c) => [...c]), start: 0 }
}

/**
 * Fullscreen WebGL "dreamy" colour field (v2 task 1.4): five soft blobs, one
 * per palette colour, slowly drifting with low-frequency noise warping.
 * Palette changes crossfade over 2s. `energy()` (0–1) gently grows the blobs
 * and brightens them. Pauses while the document is hidden; survives
 * context loss; falls back to a CSS radial-gradient if WebGL is unavailable.
 *
 * @param {{ palette: string[]|null|undefined, energy?: () => number }} props
 */
export default function DreamyBackground({ palette, energy }) {
  const canvasRef = useRef(/** @type {HTMLCanvasElement|null} */ (null))
  const [failed, setFailed] = useState(false)

  // Colour state lives in a ref: { from, to, current, start }.
  const colours = useRef(initialColours(palette))
  const energyRef = useRef(energy)
  useEffect(() => {
    energyRef.current = energy
  }, [energy])

  // Palette change → crossfade from whatever is on screen now.
  const key = (palette ?? []).join('|')
  useEffect(() => {
    const c = colours.current
    c.from = c.current.map((x) => [...x])
    c.to = normalisePalette(key ? key.split('|') : [])
    c.start = performance.now()
  }, [key])

  useEffect(() => {
    if (failed) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let gl = null
    let loc = null
    let raf = 0
    const flat = new Float32Array(15)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      if (gl) gl.viewport(0, 0, w, h)
    }

    const init = () => {
      gl = canvas.getContext('webgl', {
        antialias: false,
        depth: false,
        stencil: false,
        alpha: false,
        powerPreference: 'low-power',
        preserveDrawingBuffer: false
      })
      if (!gl) throw new Error('WebGL unavailable')
      loc = createProgram(gl)
      resize()
    }

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (!gl || gl.isContextLost()) return
      const c = colours.current
      const t = easeInOut((now - c.start) / CROSSFADE_MS)
      mixPalettes(c.from, c.to, t, c.current)
      for (let i = 0; i < 5; i++) flat.set(c.current[i], i * 3)
      let e = 0
      try {
        e = Math.min(1, Math.max(0, energyRef.current?.() ?? 0))
      } catch {
        e = 0
      }
      gl.uniform2f(loc.res, canvas.width, canvas.height)
      gl.uniform1f(loc.time, (now / 1000) * TIME_SCALE)
      gl.uniform1f(loc.energy, e)
      gl.uniform3fv(loc.colors, flat)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const start = () => {
      if (!raf && document.visibilityState === 'visible') raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop())
    const onLost = (e) => {
      e.preventDefault()
      stop()
    }
    const onRestored = () => {
      try {
        init()
        start()
      } catch (err) {
        console.warn('[background] WebGL restore failed:', err.message)
        setFailed(true)
      }
    }

    try {
      init()
    } catch (err) {
      console.warn('[background] WebGL failed, using CSS fallback:', err.message)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability fallback
      setFailed(true)
      return undefined
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    document.addEventListener('visibilitychange', onVisibility)
    start()

    return () => {
      stop()
      ro.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [failed])

  if (failed) {
    const p = normalisePalette(palette)
    const spots = ['20% 30%', '75% 25%', '60% 75%', '25% 80%', '50% 50%']
    const bg = p
      .map(
        (c, i) => `radial-gradient(circle at ${spots[i]}, ${rgbCss(c, 0.3)} 0%, transparent 55%)`
      )
      .join(', ')
    return (
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `${bg}, ${rgbCss(p[0].map((v) => v * 0.05))}`,
          transition: 'background 2s'
        }}
      />
    )
  }

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
}
