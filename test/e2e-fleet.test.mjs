import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { mkGitRepo } from './helpers.mjs'
import { mkSandboxHome, emit, readSession, eventsFor, EMITTER_PATH } from './e2e-helpers.mjs'
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

test('e2e: Claude lifecycle — prompt, tool, stop, precompact, end', () => {
  const { home } = mkSandboxHome()
  const repo = mkGitRepo()
  const repoId = resolveRepoId(repo)
  const sid = 'e2e-claude-life'
  const base = { session_id: sid, cwd: repo }

  emit(home, { ...base, hook_event_name: 'SessionStart', source: 'startup' })

  emit(home, { ...base, hook_event_name: 'UserPromptSubmit', prompt: 'do the thing' })
  let rec = readSession(home, repoId, sid)
  assert.ok(rec.last_prompt_at, 'UserPromptSubmit stamps last_prompt_at')
  assert.equal(rec.liveness, 'working')

  emit(home, { ...base, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: {} })
  rec = readSession(home, repoId, sid)
  assert.ok(rec.last_tool_at, 'first PostToolUse stamps last_tool_at (not throttled)')

  emit(home, { ...base, hook_event_name: 'Stop' })
  rec = readSession(home, repoId, sid)
  assert.equal(rec.liveness, 'idle')

  // PreCompact: emitter always does autoDump for handoff (ignores transcript_path).
  // We include a transcript file to match plan example, but it is not required by emitter.
  const transcript = path.join(repo, 'transcript.jsonl')
  fs.writeFileSync(transcript, `${JSON.stringify({ role: 'user', content: 'hi' })}\n`)
  const pc = emit(home, { ...base, hook_event_name: 'PreCompact', transcript_path: transcript })
  assert.equal(pc.status, 0)
  rec = readSession(home, repoId, sid)
  assert.ok(rec.handoff_at, 'PreCompact stamps handoff_at')

  emit(home, { ...base, hook_event_name: 'SessionEnd' })
  rec = readSession(home, repoId, sid)
  assert.equal(rec.status, 'closed')
  assert.equal(rec.link_state, 'closed')
})

test('e2e: emitter is fail-open — garbage input still exits 0', () => {
  const { home } = mkSandboxHome()
  const r = spawnSync(process.execPath, [EMITTER_PATH], {
    input: 'not json at all {{{',
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
    timeout: 15_000,
  })
  assert.equal(r.status, 0)
})
