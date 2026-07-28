import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { findAtlasConfigDir, resolveBin, runDeskGate } from '../scripts/desk-gate.mjs'

const capture = () => {
  const out = []
  const err = []
  return {
    stdout: { write: (s) => out.push(String(s)) },
    stderr: { write: (s) => err.push(String(s)) },
    out: () => out.join(''),
    err: () => err.join(''),
  }
}

test('findAtlasConfigDir walks to ancestor', () => {
  const root = mkTmp('desk-atlas-')
  fs.writeFileSync(path.join(root, 'atlas.config.json'), '{}\n')
  const child = path.join(root, 'a', 'b')
  fs.mkdirSync(child, { recursive: true })
  assert.equal(findAtlasConfigDir(child), root)
  assert.equal(findAtlasConfigDir(mkTmp('no-atlas-')), null)
})

test('resolveBin finds local node_modules/.bin', () => {
  const root = mkTmp('desk-bin-')
  const binDir = path.join(root, 'node_modules', '.bin')
  fs.mkdirSync(binDir, { recursive: true })
  const fake2 = path.join(binDir, 'desk-fake-tool')
  fs.writeFileSync(fake2, '#!/bin/sh\n')
  fs.chmodSync(fake2, 0o755)
  assert.equal(resolveBin('desk-fake-tool', root), fake2)
})

test('desk-gate exits 0 when neither tool present', () => {
  const c = capture()
  const code = runDeskGate([], {
    cwd: mkTmp('desk-none-'),
    stdout: c.stdout,
    stderr: c.stderr,
    which: () => null,
  })
  assert.equal(code, 0)
  assert.match(c.out(), /no desk tools ran/)
})

test('desk-gate soft-skips atlas without config even if atlas on PATH', () => {
  const calls = []
  const c = capture()
  const code = runDeskGate([], {
    cwd: mkTmp('desk-no-cfg-'),
    stdout: c.stdout,
    stderr: c.stderr,
    which: (cmd) => (cmd === 'atlas' ? '/bin/atlas' : null),
    spawn: (bin, args) => {
      calls.push({ bin, args })
      return { status: 0, stdout: '', stderr: '' }
    },
  })
  assert.equal(code, 0)
  assert.equal(calls.length, 0)
  assert.match(c.out(), /no desk tools ran/)
})

test('desk-gate runs atlas + sage when both present', () => {
  const root = mkTmp('desk-both-')
  fs.writeFileSync(path.join(root, 'atlas.config.json'), '{}\n')
  const calls = []
  const c = capture()
  const code = runDeskGate([], {
    cwd: root,
    stdout: c.stdout,
    stderr: c.stderr,
    which: (cmd) =>
      cmd === 'atlas' ? '/usr/bin/atlas' : cmd === 'sage' ? '/usr/bin/sage' : null,
    spawn: (bin, args) => {
      calls.push({ bin, args })
      return { status: 0, stdout: `${path.basename(bin)} gate: ok\n`, stderr: '' }
    },
  })
  assert.equal(code, 0)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].args, ['gate'])
  assert.deepEqual(calls[1].args, ['gate'])
  assert.match(c.out(), /desk-gate: ok/)
})

test('desk-gate --strict fails when a present gate returns non-zero', () => {
  const c = capture()
  const code = runDeskGate(['--strict'], {
    cwd: mkTmp('desk-strict-'),
    stdout: c.stdout,
    stderr: c.stderr,
    which: (cmd) => (cmd === 'sage' ? '/usr/bin/sage' : null),
    spawn: () => ({ status: 1, stdout: 'sage gate: fail\n', stderr: '' }),
  })
  assert.equal(code, 1)
  assert.match(c.err(), /fail \(strict\)/)
})

test('desk-gate soft mode stays 0 when child gate fails', () => {
  const c = capture()
  const code = runDeskGate([], {
    cwd: mkTmp('desk-soft-'),
    stdout: c.stdout,
    stderr: c.stderr,
    which: (cmd) => (cmd === 'sage' ? '/usr/bin/sage' : null),
    spawn: () => ({ status: 1, stdout: 'sage gate: fail\n', stderr: '' }),
  })
  assert.equal(code, 0)
})

test('desk-gate --strict passes --strict to children', () => {
  const root = mkTmp('desk-strict-pass-')
  fs.writeFileSync(path.join(root, 'atlas.config.json'), '{}\n')
  const calls = []
  const c = capture()
  runDeskGate(['--strict'], {
    cwd: root,
    stdout: c.stdout,
    stderr: c.stderr,
    which: (cmd) => (cmd === 'atlas' ? '/a' : cmd === 'sage' ? '/s' : null),
    spawn: (_bin, args) => {
      calls.push(args)
      return { status: 0, stdout: '', stderr: '' }
    },
  })
  assert.deepEqual(calls[0], ['gate', '--strict'])
  assert.deepEqual(calls[1], ['gate', '--strict'])
})
