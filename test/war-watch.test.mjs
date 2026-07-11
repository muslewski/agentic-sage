import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkTmp } from './helpers.mjs'

const BIN = fileURLToPath(new URL('../bin/sage', import.meta.url))

// Over a pipe (never a TTY in a child) `sage war` must render ONE static frame
// and exit — no alt-screen, no raw-mode hang. A live loop would trip the timeout.
test('war over a pipe is a single static render (no alt-screen, exits)', () => {
  const out = execFileSync('node', [BIN, 'war'], {
    env: { ...process.env, HOME: mkTmp('sage-ww-'), NO_COLOR: '1' },
    encoding: 'utf8',
    timeout: 5000,
  })
  assert.match(out, /SAGE WAR ROOM/)
  assert.ok(!out.includes('\x1b[?1049h')) // did not enter alt-screen
  assert.ok(!out.includes('\x1b[?25l')) // did not hide cursor
})
