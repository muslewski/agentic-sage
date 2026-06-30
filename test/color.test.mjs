import { test } from 'node:test'
import assert from 'node:assert/strict'

// paint() reads env at call time, so set FORCE_COLOR before importing-safe use.
import { paint } from '../lib/color.mjs'

const withEnv = (env, fn) => {
  const saved = {}
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] == null) delete process.env[k]; else process.env[k] = env[k] }
  try { return fn() } finally {
    for (const k of Object.keys(env)) { if (saved[k] == null) delete process.env[k]; else process.env[k] = saved[k] }
  }
}

test('NO_COLOR disables coloring (output is identity)', () => {
  withEnv({ NO_COLOR: '1', FORCE_COLOR: null }, () => {
    assert.equal(paint('sesh-12  active  src/auth/**'), 'sesh-12  active  src/auth/**')
  })
})

test('FORCE_COLOR wraps status words in ANSI', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const out = paint('sesh-12  active  done  dead')
    assert.match(out, /\x1b\[33mactive\x1b\[0m/) // gold
    assert.match(out, /\x1b\[36mdone\x1b\[0m/) // cyan
    assert.match(out, /\x1b\[31mdead\x1b\[0m/) // red
  })
})

test('coloring preserves the plain text when stripped of ANSI', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const line = 'SAGE board · acme-web · 3 session(s)'
    const stripped = paint(line).replace(/\x1b\[[0-9;]*m/g, '')
    assert.equal(stripped, line)
  })
})

test('the real CLI "working" status word is painted gold', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    assert.match(paint('● feat/a  working · 71%  src/a/'), /\x1b\[33mworking\x1b\[0m/)
  })
})

test('an active-row spinner frame is painted gold', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const out = paint('⠋ feat/a  active  src/a/')
    assert.match(out, /\x1b\[33m⠋\x1b\[0m/) // gold spinner frame
  })
})

test('multiline text is colorized per line', () => {
  withEnv({ NO_COLOR: null, FORCE_COLOR: '1' }, () => {
    const out = paint('SAGE doctor\n  ✓ sage home — ok\n  ✗ broken — bad')
    assert.match(out, /\x1b\[32m✓\x1b\[0m/) // olive check
    assert.match(out, /\x1b\[31m✗\x1b\[0m/) // red cross
  })
})
