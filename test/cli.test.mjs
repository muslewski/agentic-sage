import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { mkTmp, mkGitRepo } from './helpers.mjs'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { sessionsDir, globalConfig, sessionFile } from '../lib/paths.mjs'
import { readGuard } from '../lib/guard.mjs'

const SAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'sage')
const run = (args, home, cwd, extraEnv = {}) =>
  execFileSync('node', [SAGE, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, ...extraEnv },
    cwd,
  })

test('board prints a seeded session branch', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  fs.mkdirSync(sessionsDir(home, id), { recursive: true })
  fs.writeFileSync(
    path.join(sessionsDir(home, id), 's1.json'),
    JSON.stringify({ session_id: 's1', branch: 'feat-cli', updated_at: '2026-06-28T12:00:00Z' }),
  )
  assert.match(run(['board'], home, repo), /feat-cli/)
})

test('on flips the global config; repos lists the repo', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  fs.mkdirSync(sessionsDir(home, id), { recursive: true })
  fs.writeFileSync(path.join(sessionsDir(home, id), 's1.json'), '{}')
  run(['on'], home, repo)
  assert.deepEqual(JSON.parse(fs.readFileSync(globalConfig(home), 'utf8')), { enabled: true })
  assert.match(run(['repos'], home, repo), new RegExp(id))
})

test('unknown command prints usage; exit 0', () => {
  const home = mkTmp('sage-h-')
  assert.match(run(['wat'], home, mkTmp('sage-norepo-')), /usage/i)
})

const seedSession = (home, id, rec) => {
  fs.mkdirSync(sessionsDir(home, id), { recursive: true })
  fs.writeFileSync(path.join(sessionsDir(home, id), `${rec.session_id}.json`), JSON.stringify(rec))
}

test('territory names the overlapping branch; a clear query says clear', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedSession(home, id, { session_id: 'a', branch: 'feat-a', touched_globs: ['src/auth/x.ts'], updated_at: '2026-06-28T12:00:00Z' })
  assert.match(run(['territory', 'src/auth/**'], home, repo), /feat-a/)
  assert.match(run(['territory', 'docs/**'], home, repo), /clear/i)
  assert.match(run(['territory'], home, repo), /usage/i) // no globs → usage
})

test('why-diverged + merge-brief surface a contested file', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  for (const s of ['a', 'b'])
    seedSession(home, id, { session_id: s, branch: `feat-${s}`, touched_globs: ['shared.ts'], updated_at: '2026-06-28T12:00:00Z' })
  assert.match(run(['why-diverged', 'shared.ts'], home, repo), /feat-a/)
  const brief = run(['merge-brief'], home, repo)
  assert.match(brief, /shared\.ts/)
  assert.match(brief, /feat-a/)
})

test('fleet prints the nearest-neighbour line; board renders with tmux best-effort', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedSession(home, id, { session_id: 'a', branch: 'feat-a', touched_globs: ['src/a.ts'], liveness: 'idle', updated_at: '2026-06-28T11:00:00Z' })
  seedSession(home, id, { session_id: 'b', branch: 'feat-b', touched_globs: ['src/b.ts'], liveness: 'idle', updated_at: '2026-06-28T12:00:00Z' })
  assert.match(run(['fleet'], home, repo), /sage: 2 live · nearest feat-b touches src\/b\.ts/)
  assert.match(run(['board'], home, repo), /feat-b/) // board still renders (tmux column optional)
})

test('fleet with no other sessions says so', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  assert.match(run(['fleet'], home, repo), /no other sessions/)
})

test('guard add/list/on/off/rm round-trip', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  run(['guard', 'add', 'locked.ts'], home, repo)
  const list = run(['guard', 'list'], home, repo)
  assert.match(list, /locked\.ts/)
  assert.match(list, /disarmed/)
  run(['guard', 'on'], home, repo)
  assert.equal(readGuard(home, id).enabled, true)
  assert.match(run(['guard', 'list'], home, repo), /armed/)
  run(['guard', 'off'], home, repo)
  assert.equal(readGuard(home, id).enabled, false)
  run(['guard', 'rm', 'locked.ts'], home, repo)
  assert.deepEqual(readGuard(home, id).paths, [])
})

test('claim writes claimed_globs + link_state=linked onto the current record', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedSession(home, id, { session_id: 'g1', branch: 'feat-x', updated_at: '2026-06-28T12:00:00Z' })
  run(['claim', 'src/**', 'docs/**'], home, repo, { SAGE_SELF_SID: 'g1' })
  const rec = JSON.parse(fs.readFileSync(sessionFile(home, id, 'g1'), 'utf8'))
  assert.deepEqual(rec.claimed_globs, ['src/**', 'docs/**'])
  assert.equal(rec.link_state, 'linked')
})

test('claim with no resolvable session prints a clear hint; exit 0', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  assert.match(run(['claim', 'src/**'], home, repo), /SAGE_SELF_SID/)
})

test('claim refuses an unsafe SAGE_SELF_SID (path traversal)', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  assert.match(run(['claim', 'src/**'], home, repo, { SAGE_SELF_SID: '../../evil' }), /unsafe/)
})

test('claim onto a sid with no record prints a hint (no ghost row)', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  assert.match(run(['claim', 'src/**'], home, repo, { SAGE_SELF_SID: 'ghost' }), /no open record/)
})

test('guard add normalizes a ./-prefixed path to repo-relative', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  run(['guard', 'add', './src/x.ts'], home, repo)
  assert.deepEqual(readGuard(home, id).paths, ['src/x.ts'])
})

test('an adapter enriches board (row) + territory (zone); none → unchanged', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedSession(home, id, { session_id: 'a', branch: 'main', touched_globs: ['src/auth/x.ts'], updated_at: '2026-06-28T12:00:00Z' })
  // no adapter → bare board, no zone/row tokens
  assert.doesNotMatch(run(['board'], home, repo), /↳|zone:/)
  // add a repo-local adapter
  fs.mkdirSync(path.join(repo, '.sage'), { recursive: true })
  fs.writeFileSync(path.join(repo, '.sage', 'adapter.mjs'),
    'export const ownsZone = (p) => p.startsWith("src/auth") ? "auth" : null\n' +
    'export const claimedWork = (rec) => rec.branch === "main" ? { row: "D7", status: "🟡" } : null\n')
  assert.match(run(['board'], home, repo), /D7/)
  assert.match(run(['territory', 'src/auth/**'], home, repo), /zone: auth/)
})
