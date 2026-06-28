import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  readGuard,
  targetPath,
  relForRepo,
  shouldBlock,
  blockMessage,
  renderGuard,
  addGuardPath,
  rmGuardPath,
  setGuardEnabled,
  guardsActive,
} from '../lib/guard.mjs'

const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sage-guard-'))
const ID = 'r1'

test('readGuard defaults to disarmed/empty when absent', () => {
  assert.deepEqual(readGuard(tmpHome(), ID), { enabled: false, paths: [] })
})

test('targetPath maps edit tools, nulls the rest', () => {
  assert.equal(targetPath('Edit', { file_path: '/r/a.ts' }), '/r/a.ts')
  assert.equal(targetPath('Write', { file_path: '/r/b.ts' }), '/r/b.ts')
  assert.equal(targetPath('MultiEdit', { file_path: '/r/c.ts' }), '/r/c.ts')
  assert.equal(targetPath('NotebookEdit', { notebook_path: '/r/n.ipynb' }), '/r/n.ipynb')
  assert.equal(targetPath('Bash', { command: 'rm x' }), null)
  assert.equal(targetPath('Read', { file_path: '/r/a.ts' }), null)
  assert.equal(targetPath('Edit', {}), null)
  assert.equal(targetPath('Edit', null), null)
})

test('relForRepo strips the repo root', () => {
  assert.equal(relForRepo('/r/src/a.ts', '/r'), 'src/a.ts')
  assert.equal(relForRepo('src/a.ts', '/r'), 'src/a.ts')
  assert.equal(relForRepo('/other/a.ts', '/r'), '/other/a.ts')
})

test('shouldBlock is default-OFF and glob-aware', () => {
  assert.deepEqual(shouldBlock('src/a.ts', { enabled: false, paths: ['src/**'] }), {
    blocked: false,
    matched: null,
  })
  assert.deepEqual(shouldBlock('src/a.ts', { enabled: true, paths: [] }), {
    blocked: false,
    matched: null,
  })
  assert.deepEqual(shouldBlock('docs/a.md', { enabled: true, paths: ['src/**'] }), {
    blocked: false,
    matched: null,
  })
  assert.deepEqual(shouldBlock('src/a.ts', { enabled: true, paths: ['src/**'] }), {
    blocked: true,
    matched: 'src/**',
  })
})

test('writers round-trip + maintain the guards-active breadcrumb', () => {
  const h = tmpHome()
  addGuardPath(h, ID, 'locked.ts')
  addGuardPath(h, ID, 'locked.ts') // dedupe
  assert.deepEqual(readGuard(h, ID).paths, ['locked.ts'])
  assert.equal(guardsActive(h), false) // adding a path does not arm

  setGuardEnabled(h, ID, true)
  assert.equal(readGuard(h, ID).enabled, true)
  assert.equal(guardsActive(h), true) // armed → breadcrumb appears

  setGuardEnabled(h, ID, false)
  assert.equal(guardsActive(h), false) // last guard disarmed → breadcrumb gone

  rmGuardPath(h, ID, 'locked.ts')
  assert.deepEqual(readGuard(h, ID).paths, [])
})

test('breadcrumb tracks the last armed guard across repos', () => {
  const h = tmpHome()
  setGuardEnabled(h, 'a', true)
  setGuardEnabled(h, 'b', true)
  assert.equal(guardsActive(h), true)
  setGuardEnabled(h, 'a', false)
  assert.equal(guardsActive(h), true) // b still armed
  setGuardEnabled(h, 'b', false)
  assert.equal(guardsActive(h), false) // none armed
})

test('blockMessage names path + override', () => {
  const m = blockMessage('src/a.ts', 'src/**')
  assert.match(m, /src\/a\.ts/)
  assert.match(m, /src\/\*\*/)
  assert.match(m, /sage guard off/)
})

test('renderGuard lists enabled + paths', () => {
  const out = renderGuard({ enabled: true, paths: ['a.ts', 'src/**'] })
  assert.match(out, /armed/)
  assert.match(out, /a\.ts/)
  assert.match(out, /src\/\*\*/)
  assert.match(renderGuard({ enabled: false, paths: [] }), /disarmed/)
})
