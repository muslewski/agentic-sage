import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SPINNER_FRAMES, SPINNER_INTERVAL_MS } from '../lib/spinner.mjs'

test('SPINNER_FRAMES is 10 dense single-cell braille frames', () => {
  assert.equal(SPINNER_FRAMES.length, 10)
  for (const f of SPINNER_FRAMES) assert.equal([...f].length, 1) // one codepoint each
})

test('SPINNER_INTERVAL_MS is 100', () => {
  assert.equal(SPINNER_INTERVAL_MS, 100)
})
