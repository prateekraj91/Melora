import { useEffect, useRef } from 'react'
import { SCENE_FACTORIES } from './scenes.js'
import { DEFAULT_SCENE, stepWeight, smooth } from './kit.js'

const MAX_DPR = 1.5
const MAX_DT_S = 0.05

/**
 * One Canvas2D above the background that draws the scene's EffectLayer
 * (v2 task 3.3). Scene changes crossfade over 1.5s: every live layer has a
 * weight that moves towards 1 (current scene) or 0 (others); a layer is
 * disposed once its weight reaches 0. Everything runs in one rAF loop off
 * refs — props only update refs, never re-create the loop.
 *
 * @param {{
 *   scene?: import('../../../../shared/types.js').SceneName,
 *   palette: string[]|null|undefined,
 *   intensity?: number,
 *   getAudio: () => import('../../../../shared/types.js').AudioFrame
 * }} props
 */
export default function EffectStack({ scene = DEFAULT_SCENE, palette, intensity = 0.6, getAudio }) {
  const canvasRef = useRef(null)
  const sceneRef = useRef(scene)
  const paletteRef = useRef(palette)
  const intensityRef = useRef(intensity)
  const audioRef = useRef(getAudio)
  /** @type {React.MutableRefObject<{ layer: any, weight: number }[]>} */
  const entries = useRef([])

  useEffect(() => {
    sceneRef.current = scene
    audioRef.current = getAudio
  }, [scene, getAudio])

  useEffect(() => {
    paletteRef.current = palette
    for (const e of entries.current) e.layer.setPalette?.(palette ?? [])
  }, [palette])

  useEffect(() => {
    intensityRef.current = intensity
    for (const e of entries.current) e.layer.setIntensity?.(intensity)
  }, [intensity])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return undefined
    const list = entries.current
    let w = 0
    let h = 0
    let dpr = 1

    const size = () => {
      dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      for (const e of list) e.layer.resize(w, h)
    }
    size()

    const add = (name) => {
      const make = SCENE_FACTORIES[name] ?? SCENE_FACTORIES[DEFAULT_SCENE]
      const layer = make()
      layer.init(ctx, {
        width: w,
        height: h,
        palette: paletteRef.current ?? [],
        intensity: intensityRef.current
      })
      list.push({ layer, weight: list.length ? 0 : 1 })
    }

    let raf = 0
    let last = 0
    const loop = (t) => {
      raf = requestAnimationFrame(loop)
      const dtMs = last ? Math.min(MAX_DT_S * 1000, t - last) : 16
      last = t
      const want = sceneRef.current
      let have = false
      for (let i = 0; i < list.length; i++) if (list[i].layer.id === want) have = true
      if (!have) add(want)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const audio = audioRef.current()
      for (let i = 0; i < list.length; i++) {
        const e = list[i]
        e.weight = stepWeight(e.weight, e.layer.id === want ? 1 : 0, dtMs)
        if (e.weight <= 0) {
          e.layer.dispose()
          list.splice(i, 1)
          i--
          continue
        }
        ctx.save()
        e.layer.frame(t, dtMs / 1000, audio, smooth(e.weight))
        ctx.restore()
      }
    }

    const start = () => {
      if (!raf && !document.hidden) {
        last = 0
        raf = requestAnimationFrame(loop)
      }
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    const onVisibility = () => (document.hidden ? stop() : start())

    start()
    window.addEventListener('resize', size)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      window.removeEventListener('resize', size)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const e of list) e.layer.dispose()
      list.length = 0
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
