import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { keyAction, isTextInput } from '../keys.js'

const k = (key, over = {}) => ({ key, ...over })
const cmd = (c) => ({ kind: 'command', cmd: c })

describe('keyAction', () => {
  test('mapping', () => {
    assert.deepEqual(keyAction(k(' ')), cmd({ type: 'toggle' }))
    assert.deepEqual(keyAction(k('ArrowLeft')), cmd({ type: 'prev' }))
    assert.deepEqual(keyAction(k('ArrowRight')), cmd({ type: 'next' }))
    assert.deepEqual(keyAction(k('ArrowUp')), cmd({ type: 'volumeDelta', delta: 10 }))
    assert.deepEqual(keyAction(k('ArrowDown')), cmd({ type: 'volumeDelta', delta: -10 }))
    assert.deepEqual(keyAction(k('l')), cmd({ type: 'like' }))
    assert.deepEqual(keyAction(k('L')), cmd({ type: 'like' }))
    assert.deepEqual(keyAction(k('Escape')), { kind: 'close' })
  })

  test('unmapped keys → null', () => {
    for (const key of ['a', 'Enter', 'Tab', 'd', 's', 'Shift'])
      assert.equal(keyAction(k(key)), null)
  })

  test('modifier combos are never captured', () => {
    assert.equal(keyAction(k(' ', { metaKey: true })), null)
    assert.equal(keyAction(k('ArrowRight', { ctrlKey: true })), null)
    assert.equal(keyAction(k('l', { altKey: true })), null)
  })

  test('auto-repeat only for volume', () => {
    assert.equal(keyAction(k(' ', { repeat: true })), null)
    assert.equal(keyAction(k('ArrowRight', { repeat: true })), null)
    assert.equal(keyAction(k('l', { repeat: true })), null)
    assert.deepEqual(
      keyAction(k('ArrowUp', { repeat: true })),
      cmd({ type: 'volumeDelta', delta: 10 })
    )
  })

  test('ignored while typing in a text field', () => {
    assert.equal(keyAction(k(' ', { target: { tagName: 'INPUT', type: 'text' } })), null)
    assert.equal(keyAction(k('l', { target: { tagName: 'TEXTAREA' } })), null)
    assert.equal(
      keyAction(k('ArrowUp', { target: { tagName: 'DIV', isContentEditable: true } })),
      null
    )
    // …but not on a checkbox or a plain element
    assert.deepEqual(
      keyAction(k(' ', { target: { tagName: 'INPUT', type: 'checkbox' } })),
      cmd({ type: 'toggle' })
    )
    assert.deepEqual(keyAction(k(' ', { target: { tagName: 'BODY' } })), cmd({ type: 'toggle' }))
  })
})

test('isTextInput', () => {
  assert.equal(isTextInput(null), false)
  assert.equal(isTextInput({ tagName: 'INPUT' }), true)
  assert.equal(isTextInput({ tagName: 'input', type: 'search' }), true)
  assert.equal(isTextInput({ tagName: 'SELECT' }), true)
  assert.equal(isTextInput({ tagName: 'BUTTON' }), false)
})
