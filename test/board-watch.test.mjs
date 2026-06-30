import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkTmp, mkGitRepo } from './helpers.mjs'

const BIN = fileURLToPath(new URL('../bin/sage', import.meta.url))

// `sage board --watch` over a pipe (no TTY) must NOT animate: it renders one
// static frame and exits, with no alternate-screen escape codes. Piped stdout
// in a child process is never a TTY, so this exercises the guard directly.
test('board --watch over a pipe is a single static render (no alt-screen, exits)', () => {
  const home = mkTmp('sage-w-')
  const repo = mkGitRepo()
  const out = execFileSync('node', [BIN, 'board', '--watch'], {
    cwd: repo,
    env: { ...process.env, HOME: home, NO_COLOR: '1' },
    encoding: 'utf8',
    timeout: 5000, // a hung watch loop would trip this; a one-shot returns at once
  })
  assert.match(out, /SAGE ·/) // the board rendered
  assert.ok(!out.includes('\x1b[?1049h')) // no alternate screen — not animating
  assert.ok(!out.includes('\x1b[?25l')) // cursor was never hidden
})
