import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { mkTmp, mkGitRepo } from './helpers.mjs'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { sessionsDir, globalConfig, sessionFile, repoDir } from '../lib/paths.mjs'
import { readGuard } from '../lib/guard.mjs'
import { markAsking, askingFile } from '../lib/asking.mjs'

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

test('sage adapter init scaffolds .sage/adapter.mjs; re-run won’t overwrite; non-git → clear line', () => {
  const home = mkTmp('sage-ai-')
  const repo = mkGitRepo()
  const out1 = run(['adapter', 'init'], home, repo)
  assert.match(out1, /scaffolded \.sage\/adapter\.mjs/)
  assert.ok(fs.existsSync(path.join(repo, '.sage', 'adapter.mjs')))
  const out2 = run(['adapter', 'init'], home, repo)
  assert.match(out2, /already exists/)
  const out3 = run(['adapter', 'init'], home, mkTmp('sage-ai-norepo-'))
  assert.match(out3, /not a git repo/)
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

test('statusline: fresh breadcrumb prints the label; stale prints nothing + self-cleans', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedSession(home, id, { session_id: 's1' })
  run(['on'], home, repo)
  markAsking(home, 's1', 'territory') // fresh
  assert.match(run(['statusline', '--session', 's1', '--cwd', repo], home, repo), /Asking Sage/)
  const f = askingFile(home, 's1')
  const old = new Date(Date.now() - 60_000)
  fs.utimesSync(f, old, old) // make it stale
  assert.equal(run(['statusline', '--session', 's1', '--cwd', repo], home, repo), '')
  assert.equal(fs.existsSync(f), false) // self-cleaned on the stale read
})

test('statusline: empty when SAGE off, when absent, and on garbage stdin (fail-open)', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedSession(home, id, { session_id: 's1' })
  markAsking(home, 's1', 'fleet')
  assert.equal(run(['statusline', '--session', 's1', '--cwd', repo], home, repo), '') // SAGE off
  run(['on'], home, repo)
  assert.equal(run(['statusline', '--session', 'sX', '--cwd', repo], home, repo), '') // absent
  const garbage = execFileSync('node', [SAGE, 'statusline'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
    cwd: repo,
    input: 'not json',
  })
  assert.equal(garbage, '') // fail-open, exit 0 (execFileSync would throw on non-zero)
})

test('statusline: reads session/cwd from a stdin JSON payload; honors config label', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedSession(home, id, { session_id: 's1' })
  run(['on'], home, repo)
  const gc = globalConfig(home)
  const cur = JSON.parse(fs.readFileSync(gc, 'utf8'))
  fs.writeFileSync(gc, JSON.stringify({ ...cur, statuslineLabel: '🧭 SAGE' })) // merge-preserve enabled
  markAsking(home, 's1', 'merge-brief')
  const out = execFileSync('node', [SAGE, 'statusline'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
    cwd: repo,
    input: JSON.stringify({ session_id: 's1', cwd: repo }),
  })
  assert.match(out, /🧭 SAGE/)
})

test('consult verbs stamp the breadcrumb for a known session; board does not; unknown sid does not', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedSession(home, id, { session_id: 's1' })
  run(['on'], home, repo)
  run(['territory', 'src/**'], home, repo, { SAGE_SELF_SID: 's1' })
  assert.equal(fs.existsSync(askingFile(home, 's1')), true) // territory stamped
  fs.unlinkSync(askingFile(home, 's1'))
  run(['board'], home, repo, { SAGE_SELF_SID: 's1' })
  assert.equal(fs.existsSync(askingFile(home, 's1')), false) // board excluded
  run(['fleet'], home, repo, { SAGE_SELF_SID: 'ghost' })
  assert.equal(fs.existsSync(askingFile(home, 'ghost')), false) // no record ⇒ no stamp
})

// P11 — backlog coordination. Symlink the syndcast adapter into the state dir so
// the repo gets backlogRows; seed a BACKLOG.md under the repo's syndcast-mind/.
const ADAPTER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'adapters', 'syndcast.mjs')
const wireBacklog = (home, id, repo, backlog) => {
  fs.mkdirSync(repoDir(home, id), { recursive: true })
  fs.symlinkSync(ADAPTER, path.join(repoDir(home, id), 'adapter.mjs'))
  fs.mkdirSync(path.join(repo, 'syndcast-mind'), { recursive: true })
  fs.writeFileSync(path.join(repo, 'syndcast-mind', 'BACKLOG.md'), backlog)
}
const D_BACKLOG = `## D
| ID | Mission | Status | Lands | Notes |
|---|---|---|---|---|
| D11 | next | ⬜ | feat-x | — |
`

test('backlog: no adapter → clean line; with adapter → row board', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedSession(home, id, { session_id: 's1', branch: 'feat-x', updated_at: '2026-06-28T12:00:00Z' })
  assert.match(run(['backlog'], home, repo), /no backlog adapter/i) // no adapter yet
  wireBacklog(home, id, repo, D_BACKLOG)
  const out = run(['backlog'], home, repo)
  assert.match(out, /D11/)                 // row surfaced
  assert.match(out, /held-but-open|mark 🟡/) // s1's branch feat-x is the D11 Lands → inferred holder
})

test('backlog claim: stamps claimed_row + the asking breadcrumb; guards a missing record', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  run(['on'], home, repo)
  seedSession(home, id, { session_id: 's1', pid: process.pid, branch: 'main', updated_at: '2026-06-28T12:00:00Z' })
  wireBacklog(home, id, repo, D_BACKLOG)
  // claim A5 explicitly as s1 (SAGE_SELF_SID pins identity in the test)
  const ok = run(['backlog', 'claim', 'A5'], home, repo, { SAGE_SELF_SID: 's1' })
  assert.match(ok, /claimed row A5 on s1/)
  const rec = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.equal(rec.claimed_row, 'A5')
  assert.ok(fs.existsSync(askingFile(home, 's1'))) // breadcrumb stamped
  // a sid with no record is refused (never fabricated)
  assert.match(run(['backlog', 'claim', 'D11'], home, repo, { SAGE_SELF_SID: 'ghost' }), /no open record/i)
  assert.ok(!fs.existsSync(sessionFile(home, id, 'ghost')))
})

test('backlog claim: bad input → usage; explicit claim overrides branch inference', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  run(['on'], home, repo)
  seedSession(home, id, { session_id: 's1', pid: process.pid, branch: 'feat-x', claimed_row: 'A5', updated_at: '2026-06-28T12:00:00Z' })
  wireBacklog(home, id, repo, D_BACKLOG)
  assert.match(run(['backlog', 'claim'], home, repo, { SAGE_SELF_SID: 's1' }), /usage/i) // no row arg
  assert.match(run(['backlog', 'claim', 'D1!'], home, repo, { SAGE_SELF_SID: 's1' }), /usage/i) // punctuation rejected
  assert.match(run(['backlog', 'claim', 'a b'], home, repo, { SAGE_SELF_SID: 's1' }), /usage/i) // space rejected
  // s1's branch feat-x would infer D11, but claimed_row:A5 wins → D11 shows no live holder
  const out = run(['backlog'], home, repo)
  assert.doesNotMatch(out, /held by s1/)
})
