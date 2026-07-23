import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkTmp } from './helpers.mjs'
import { sessionsDir } from '../lib/paths.mjs'

const BIN = fileURLToPath(new URL('../bin/sage', import.meta.url))
// cwd defaults to a fresh non-git temp dir so `war`/`board` never accidentally
// resolve THIS repo (the test runner's cwd is a git repo).
const run = (args, home, cwd = mkTmp('sage-cwd-')) =>
  execFileSync('node', [BIN, ...args], {
    cwd,
    env: { ...process.env, HOME: home, NO_COLOR: '1' },
    encoding: 'utf8',
    timeout: 5000,
  })
const seed = (home, repoId, sid, rec) => {
  const dir = sessionsDir(home, repoId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${sid}.json`), JSON.stringify({ session_id: sid, ...rec }))
}

test('war --json emits a schema-1 sage.war envelope', () => {
  const home = mkTmp('sage-warj-')
  seed(home, 'alpha-aaaa1111', 'w', { branch: 'main', updated_at: new Date().toISOString(), last_tool_at: new Date().toISOString() })
  const env = JSON.parse(run(['war', '--json'], home))
  assert.equal(env.schema, 1)
  assert.equal(env.kind, 'sage.war')
  assert.equal(typeof env.generated_at, 'string')
  assert.ok(Array.isArray(env.repos))
  assert.equal(env.repos[0].repo_id, 'alpha-aaaa1111')
  assert.ok(Array.isArray(env.repos[0].sessions))
  assert.equal(env.totals.sessions, 1)
})

test('war --json on empty fleet is a valid empty envelope', () => {
  const env = JSON.parse(run(['war', '--json'], mkTmp('sage-warj-')))
  assert.deepEqual(env.repos, [])
  assert.equal(env.totals.repos, 0)
})

test('war (piped, non-TTY) renders one static frame, no alt-screen', () => {
  const home = mkTmp('sage-wars-')
  seed(home, 'alpha-aaaa1111', 'w', { branch: 'main', updated_at: new Date().toISOString(), last_tool_at: new Date().toISOString() })
  const out = run(['war'], home)
  assert.match(out, /SAGE WAR/)
  assert.ok(!out.includes('\x1b[?1049h')) // no alternate screen
  assert.ok(!out.includes('\x1b[?25l')) // cursor never hidden
})

test('board outside a repo hints at sage war', () => {
  const out = run(['board'], mkTmp('sage-hint-')) // HOME set, cwd is not a git repo
  assert.match(out, /sage war/)
})
