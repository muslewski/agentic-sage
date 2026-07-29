// test/agent-status.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  agentStatusDir,
  readAgentStatusRecords,
  toSyntheticSession,
  mergeSynthetic,
} from '../lib/agent-status.mjs'

const REC = {
  schema: 1,
  source_cli: 'grok',
  pid: 424242,
  cwd: '/repo/work',
  model: 'grok-4.5',
  effort: 'high',
  preset: 'grok-high',
  written_by: 'llm-armory',
  started_at: 1785342240517,
  updated_at: 1785342240517,
  ttl_ms: 43200000,
}

test('agentStatusDir prefers AGENT_STATUS_DIR', () => {
  assert.equal(agentStatusDir({ AGENT_STATUS_DIR: '/x', XDG_RUNTIME_DIR: '/y' }), '/x')
})

test('agentStatusDir falls back to XDG_RUNTIME_DIR then HOME state', () => {
  assert.equal(agentStatusDir({ XDG_RUNTIME_DIR: '/run/user/1000' }), '/run/user/1000/agent-status')
  assert.equal(agentStatusDir({ HOME: '/home/k' }), '/home/k/.local/state/agent-status')
})

test('readAgentStatusRecords skips malformed files and missing dirs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'as-'))
  fs.mkdirSync(path.join(tmp, 'sessions'))
  fs.writeFileSync(path.join(tmp, 'sessions', 'a.json'), JSON.stringify(REC))
  fs.writeFileSync(path.join(tmp, 'sessions', 'b.json'), '{ not json')
  fs.writeFileSync(path.join(tmp, 'sessions', 'c.txt'), 'ignored')
  const out = readAgentStatusRecords({ dir: tmp })
  assert.equal(out.length, 1)
  assert.equal(out[0].pid, 424242)
  assert.deepEqual(readAgentStatusRecords({ dir: '/nope/nowhere' }), [])
})

test('toSyntheticSession maps epoch ms to ISO and marks provenance', () => {
  const now = REC.started_at + 5000
  const s = toSyntheticSession(REC, {
    now,
    repoId: 'work-abc12345',
    isAlive: () => true,
    repoIdOf: () => 'work-abc12345',
  })
  assert.equal(s.session_id, 'armory:grok-pid424242')
  assert.equal(s.synthetic, true)
  assert.equal(s.registered_by, 'llm-armory')
  assert.equal(s.agent_kind, 'grok')
  assert.equal(s.managed_by, 'nested')
  assert.equal(s.alive, true)
  assert.equal(s.liveness, 'working')
  assert.equal(s.opened_at, new Date(REC.started_at).toISOString())
  assert.equal(s.model, 'grok-4.5')
})

test('toSyntheticSession reports a dead pid as dead, not working', () => {
  const s = toSyntheticSession(REC, {
    now: REC.started_at + 5000,
    repoId: 'work-abc12345',
    isAlive: () => false,
    repoIdOf: () => 'work-abc12345',
  })
  assert.equal(s.alive, false)
  assert.equal(s.liveness, 'dead')
})

test('toSyntheticSession expires a record past its ttl even if the pid is alive', () => {
  const s = toSyntheticSession(REC, {
    now: REC.updated_at + REC.ttl_ms + 1,
    repoId: 'work-abc12345',
    isAlive: () => true,
    repoIdOf: () => 'work-abc12345',
  })
  assert.equal(s, null)
})

test('toSyntheticSession returns null for a record from another repo', () => {
  const s = toSyntheticSession(REC, {
    now: REC.started_at,
    repoId: 'other-99999999',
    isAlive: () => true,
    repoIdOf: () => 'work-abc12345',
  })
  assert.equal(s, null)
})

test('toSyntheticSession tolerates a record with no pid', () => {
  const s = toSyntheticSession({ ...REC, pid: undefined }, {
    now: REC.started_at,
    repoId: 'work-abc12345',
  })
  assert.equal(s, null)
})

test('mergeSynthetic drops a synthetic row when a real record has the same pid', () => {
  const real = [{ session_id: 'abc', pid: 111, touched_globs: ['src/a.ts'] }]
  const syn = [
    { session_id: 'armory:grok-pid111', pid: 111, synthetic: true },
    { session_id: 'armory:grok-pid222', pid: 222, synthetic: true },
  ]
  const out = mergeSynthetic(real, syn)
  assert.equal(out.length, 2)
  assert.equal(out.filter((r) => r.pid === 111).length, 1)
  assert.equal(out.find((r) => r.pid === 111).session_id, 'abc')
  assert.equal(out.find((r) => r.pid === 222).synthetic, true)
})

test('mergeSynthetic is a no-op on empty synthetic input', () => {
  const real = [{ session_id: 'abc', pid: 111 }]
  assert.deepEqual(mergeSynthetic(real, []), real)
})

test('mergeSynthetic sorts newest updated_at first, matching collectSessions', () => {
  const out = mergeSynthetic(
    [{ session_id: 'a', pid: 1, updated_at: '2026-07-29T10:00:00.000Z' }],
    [{ session_id: 'armory:b', pid: 2, updated_at: '2026-07-29T12:00:00.000Z', synthetic: true }],
  )
  assert.equal(out[0].session_id, 'armory:b')
})
