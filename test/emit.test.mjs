import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { sessionFile, eventsFile, sageHome } from '../lib/paths.mjs'
import { mkTmp, mkGitRepo, writeGlobalConfig } from './helpers.mjs'

const EMIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'sage-emit.mjs')

const emit = (payload, home) =>
  execFileSync('node', [EMIT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  })

test('SessionStart writes a scoping record; Stop refreshes + logs both events', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)

  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  const rec1 = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.equal(rec1.link_state, 'scoping')
  assert.equal(rec1.repo_id, id)
  assert.equal(rec1.source, 'startup')
  assert.match(rec1.head, /^[0-9a-f]{40}$/)

  emit({ hook_event_name: 'Stop', session_id: 's1', cwd: repo }, home)
  const events = fs.readFileSync(eventsFile(home, id), 'utf8').split('\n').filter(Boolean)
  assert.deepEqual(events.map((l) => JSON.parse(l).event), ['open', 'stop'])
  const rec2 = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.ok(rec2.updated_at)
})

test('DEFAULT-OFF: no global config ⇒ nothing written', () => {
  const home = mkTmp('sage-h-') // no config seeded
  const repo = mkGitRepo()
  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  assert.equal(fs.existsSync(path.join(sageHome(home), 'repos')), false)
})

test('fail-open: malformed stdin exits 0 (does not throw)', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  assert.doesNotThrow(() =>
    execFileSync('node', [EMIT], {
      input: 'not json',
      encoding: 'utf8',
      env: { ...process.env, HOME: home },
    }),
  )
})

test('non-git cwd ⇒ nothing written', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const notRepo = mkTmp('sage-norepo-')
  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: notRepo }, home)
  assert.equal(fs.existsSync(path.join(sageHome(home), 'repos')), false)
})
