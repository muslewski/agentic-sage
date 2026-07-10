import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkGitRepo } from './helpers.mjs'
import { mkSandboxHome, emit, readSession, eventsFor } from './e2e-helpers.mjs'
import { resolveRepoId } from '../lib/repo-id.mjs'

test('e2e: Claude SessionStart creates a record and an open event', () => {
  const { home } = mkSandboxHome()
  const repo = mkGitRepo()
  const repoId = resolveRepoId(repo)
  const r = emit(home, {
    hook_event_name: 'SessionStart',
    session_id: 'e2e-claude-1',
    cwd: repo,
    source: 'startup',
  })
  assert.equal(r.status, 0)
  const rec = readSession(home, repoId, 'e2e-claude-1')
  assert.ok(rec, 'record file written')
  assert.equal(rec.session_id, 'e2e-claude-1')
  assert.equal(rec.repo_id, repoId)
  assert.equal(rec.status, 'active')
  assert.equal(rec.link_state, 'scoping')
  assert.ok(rec.opened_at)
  assert.ok(eventsFor(home, repoId).some((e) => e.event === 'open' && e.session_id === 'e2e-claude-1'))
})
