// Vendored fleet-devlog tests (from work-kb reference) + drift guard.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { devlogEnabled, installId, sanitizeEvent, emit, referencePath } from '../lib/fleet-devlog.mjs'

test('off by default with no env and no config', () => {
  assert.equal(devlogEnabled({ env: {}, argv: [], config: null }), false)
})

test('machine config is the only persistent enable source', () => {
  assert.equal(devlogEnabled({ env: {}, argv: [], config: { enabled: true } }), true)
  assert.equal(devlogEnabled({ env: {}, argv: [], config: { enabled: false } }), false)
})

test('env outranks config in both directions', () => {
  assert.equal(devlogEnabled({ env: { FLEET_DEVLOG: '1' }, argv: [], config: { enabled: false } }), true)
  assert.equal(devlogEnabled({ env: { FLEET_DEVLOG: '0' }, argv: [], config: { enabled: true } }), false)
})

test('--no-devlog beats an enabling config', () => {
  assert.equal(devlogEnabled({ env: {}, argv: ['--no-devlog'], config: { enabled: true } }), false)
})

test('installId is stable across calls and shared by root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devlog-'))
  const a = installId({ root })
  const b = installId({ root })
  assert.equal(a, b)
  assert.match(a, /^[0-9a-f]{16,}$/)
})

test('sanitizeEvent drops every field not in the contract', () => {
  const out = sanitizeEvent(
    {
      v: 1, tool: 'memory-atlas', cmd: 'check', exit: 0, ms: 5,
      prompt: 'secret user text',
      path: '/home/kento/Repositories/syndcast/src/secret.ts',
      apiKey: 'sk-live-123',
      counts: { zones: 4 },
    },
    { safeFlags: [] },
  )
  assert.equal(out.prompt, undefined)
  assert.equal(out.path, undefined)
  assert.equal(out.apiKey, undefined)
  assert.deepEqual(out.counts, { zones: 4 })
  assert.equal(out.cmd, 'check')
})

test('sanitizeEvent rejects a non-numeric value inside counts', () => {
  const out = sanitizeEvent({ v: 1, tool: 'agentic-sage', cmd: 'board', counts: { zones: 4, name: 'syndcast' } }, { safeFlags: [] })
  assert.deepEqual(out.counts, { zones: 4 })
})

test('argv_shape keeps only allow-listed flags and never their values', () => {
  const out = sanitizeEvent(
    { v: 1, tool: 'memory-atlas', cmd: 'check', argv_shape: ['--strict', '--profile', 'code', '--secret-thing'] },
    { safeFlags: ['--strict', '--profile'] },
  )
  assert.deepEqual(out.argv_shape, ['--strict', '--profile'])
})

test('an unknown tool name is rejected', () => {
  assert.equal(sanitizeEvent({ v: 1, tool: 'evil-tool', cmd: 'x' }, { safeFlags: [] }), null)
})

test('emit writes nothing when disabled', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devlog-'))
  emit({ v: 1, tool: 'memory-atlas', cmd: 'check', exit: 0 }, { root, env: {}, argv: [], config: null })
  assert.equal(fs.existsSync(path.join(root, 'events.jsonl')), false)
})

test('emit appends one line when enabled', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devlog-'))
  emit({ v: 1, tool: 'memory-atlas', cmd: 'check', exit: 0 }, { root, env: { FLEET_DEVLOG: '1' }, argv: [], config: null })
  const lines = fs.readFileSync(path.join(root, 'events.jsonl'), 'utf8').trim().split('\n')
  assert.equal(lines.length, 1)
  const e = JSON.parse(lines[0])
  assert.equal(e.tool, 'memory-atlas')
  assert.ok(e.install_id)
  assert.ok(e.ts)
})

test('emit never throws on an unwritable root', () => {
  assert.doesNotThrow(() =>
    emit({ v: 1, tool: 'memory-atlas', cmd: 'check' }, {
      root: '/proc/definitely/not/writable',
      env: { FLEET_DEVLOG: '1' }, argv: [], config: null,
    }),
  )
})

test('referencePath honours FLEET_DEVLOG_REF; default is this module (portable)', () => {
  // Unset → this vendored file (import.meta.url), never a hardcoded desk path.
  const def = referencePath({})
  assert.ok(typeof def === 'string' && def.endsWith(`${path.sep}fleet-devlog.mjs`))
  assert.equal(referencePath({ FLEET_DEVLOG_REF: '' }), def)
  assert.equal(referencePath({ FLEET_DEVLOG_REF: '/tmp/alt-ref.mjs' }), '/tmp/alt-ref.mjs')
  // Source must not embed a private /home/... absolute for a *different* ref path.
  const src = fs.readFileSync(new URL('../lib/fleet-devlog.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /\/home\/[A-Za-z0-9._-]+\/Repositories\//)
})

test('FLEET_DEVLOG_REF set but missing fails loudly (never silent pass)', () => {
  const missing = '/nonexistent/fleet-devlog.reference.mjs'
  assert.equal(referencePath({ FLEET_DEVLOG_REF: missing }), missing)
  assert.equal(fs.existsSync(missing), false)
})

/**
 * Discover a work-kb contract without hardcoding a desk username path.
 * Tries FLEET_DEVLOG_REF, then portable relative layouts from this package root.
 */
function discoverFleetDevlogRef() {
  const fromEnv = referencePath(process.env)
  if (fromEnv) return fromEnv
  const here = path.dirname(fileURLToPath(import.meta.url))
  const pkgRoot = path.resolve(here, '..')
  const candidates = [
    // main clone next to work-kb under Repositories/
    path.resolve(pkgRoot, '..', 'work-kb', 'contracts', 'fleet-devlog.reference.mjs'),
    // worktree: <repo>/.claude/worktrees/<name> → up to Repositories/work-kb
    path.resolve(pkgRoot, '..', '..', '..', '..', 'work-kb', 'contracts', 'fleet-devlog.reference.mjs'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

test('vendored emitter matches the work-kb reference', (t) => {
  const fromEnv = referencePath(process.env)
  if (fromEnv && !fs.existsSync(fromEnv)) {
    assert.fail(
      `FLEET_DEVLOG_REF is set to ${fromEnv} but the file is missing — drift guard cannot run silently`,
    )
  }
  const ref = discoverFleetDevlogRef()
  if (!ref) {
    t.skip('no fleet-devlog reference installed (set FLEET_DEVLOG_REF to enable drift check)')
    return
  }
  assert.ok(fs.existsSync(ref), `reference unresolvable at ${ref}`)
  const a = crypto.createHash('sha256').update(fs.readFileSync(ref)).digest('hex')
  const b = crypto.createHash('sha256').update(
    fs.readFileSync(new URL('../lib/fleet-devlog.mjs', import.meta.url))).digest('hex')
  assert.equal(b, a, 'vendored copy has drifted from the reference')
})
