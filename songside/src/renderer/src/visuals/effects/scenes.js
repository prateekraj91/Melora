// Scene name → EffectLayer factory (v2 task 3.3).
import { createChill } from './chill.js'
import { createChristmas } from './christmas.js'
import { createRock } from './rock.js'
import { createRain } from './rain.js'
import { createLove } from './love.js'
import { createEdm } from './edm.js'
import { createHiphop } from './hiphop.js'

/** @type {Record<import('../../../../shared/types.js').SceneName, () => import('../../../../shared/types.js').EffectLayer>} */
export const SCENE_FACTORIES = {
  chill: createChill,
  christmas: createChristmas,
  rock: createRock,
  rain: createRain,
  love: createLove,
  edm: createEdm,
  hiphop: createHiphop
}
