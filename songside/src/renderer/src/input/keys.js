// Keyboard controls for the fullscreen window (v2 task 2.2).
//
//   Space      toggle play/pause
//   ← / →      previous / next track
//   ↑ / ↓      volume ±10 (auto-repeats while held)
//   L          like (save) the current track
//   Esc        close fullscreen
//
// Keys with ⌘/Ctrl/⌥ held are ignored (never steal shortcuts), as is
// everything while a text field is focused. `keyAction` is pure and tested;
// `useKeyboardControls` attaches it to the window.

import { useEffect, useRef } from 'react'

/** @typedef {import('../../../shared/types.js').PlayerCommand} PlayerCommand */
/** @typedef {{ kind: 'command', cmd: PlayerCommand } | { kind: 'close' }} KeyAction */

export const VOLUME_STEP = 10

/** True if keyboard input should go to `el` instead of the player. */
export function isTextInput(el) {
  if (!el || typeof el !== 'object') return false
  if (el.isContentEditable) return true
  const tag = (el.tagName || '').toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (el.type || 'text').toLowerCase()
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file'].includes(
      type
    )
  }
  return false
}

/**
 * @param {{ key: string, code?: string, metaKey?: boolean, ctrlKey?: boolean,
 *           altKey?: boolean, repeat?: boolean, target?: any }} e
 * @returns {KeyAction|null}
 */
export function keyAction(e) {
  if (!e || e.metaKey || e.ctrlKey || e.altKey) return null
  if (isTextInput(e.target)) return null
  const cmd = (c) => ({ kind: 'command', cmd: c })
  switch (e.key) {
    case 'Escape':
      return e.repeat ? null : { kind: 'close' }
    case ' ':
    case 'Spacebar':
      return e.repeat ? null : cmd({ type: 'toggle' })
    case 'ArrowLeft':
      return e.repeat ? null : cmd({ type: 'prev' })
    case 'ArrowRight':
      return e.repeat ? null : cmd({ type: 'next' })
    case 'ArrowUp':
      return cmd({ type: 'volumeDelta', delta: VOLUME_STEP })
    case 'ArrowDown':
      return cmd({ type: 'volumeDelta', delta: -VOLUME_STEP })
    case 'l':
    case 'L':
      return e.repeat ? null : cmd({ type: 'like' })
    default:
      return null
  }
}

/**
 * Attach keyAction to window keydown.
 * @param {{ onCommand: (cmd: PlayerCommand) => void, onClose: () => void }} handlers
 */
export function useKeyboardControls(handlers) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })
  useEffect(() => {
    const onKey = (e) => {
      const a = keyAction(e)
      if (!a) return
      e.preventDefault()
      if (a.kind === 'close') ref.current.onClose()
      else ref.current.onCommand(a.cmd)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
