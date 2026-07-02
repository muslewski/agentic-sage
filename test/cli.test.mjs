import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { mkTmp, mkGitRepo, git } from './helpers.mjs'
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

test('sage adapter init scaffolds .agentic-sage/adapter.mjs; re-run won’t overwrite; non-git → clear line', () => {
  const home = mkTmp('sage-ai-')
  const repo = mkGitRepo()
  const out1 = run(['adapter', 'init'], home, repo)
  assert.match(out1, /scaffolded \.agentic-sage\/adapter\.mjs/)
  assert.ok(fs.existsSync(path.join(repo, '.agentic-sage', 'adapter.mjs')))
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

const HAS_PROC = fs.existsSync('/proc/self/stat')

test('read verbs exclude the current session via pid-walk (no SAGE_SELF_SID)', { skip: !HAS_PROC }, () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  // "me" = a record whose pid is an ancestor of the spawned CLI (the test process)
  seedSession(home, id, {
    session_id: 'me',
    pid: process.pid,
    branch: 'feat-me',
    touched_globs: ['src/a.ts'],
    updated_at: '2026-06-28T12:00:00Z',
  })
  const env = { SAGE_SELF_SID: '' } // neutralize any ambient value; '' is falsy in the resolver
  assert.match(run(['fleet'], home, repo, env), /no other sessions/)
  assert.match(run(['territory', 'src/**'], home, repo, env), /clear/i)
  assert.match(run(['merge-brief'], home, repo, env), /no contested paths/i)
  assert.match(run(['why-diverged', 'src/a.ts'], home, repo, env), /no other session/i)
})

test('read verbs still report a genuinely OTHER session alongside self', { skip: !HAS_PROC }, () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedSession(home, id, { session_id: 'me', pid: process.pid, branch: 'feat-me', touched_globs: ['src/a.ts'], updated_at: '2026-06-28T12:00:00Z' })
  seedSession(home, id, { session_id: 'other', branch: 'feat-other', touched_globs: ['src/a.ts'], updated_at: '2026-06-28T11:00:00Z' })
  const env = { SAGE_SELF_SID: '' }
  const out = run(['territory', 'src/**'], home, repo, env)
  assert.match(out, /feat-other/)
  assert.doesNotMatch(out, /feat-me/)
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

// P11 — backlog coordination. Symlink the acme adapter into the state dir so
// the repo gets backlogRows; seed a BACKLOG.md under the repo's acme-mind/.
const ADAPTER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'adapters', 'acme.mjs')
const wireBacklog = (home, id, repo, backlog) => {
  fs.mkdirSync(repoDir(home, id), { recursive: true })
  fs.symlinkSync(ADAPTER, path.join(repoDir(home, id), 'adapter.mjs'))
  fs.mkdirSync(path.join(repo, 'acme-mind'), { recursive: true })
  fs.writeFileSync(path.join(repo, 'acme-mind', 'BACKLOG.md'), backlog)
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

// P10 — sage init wizard/flags, sage where, sage enable|disable. Every `run()`
// spawn here has a piped (non-TTY) stdin, so the wizard branch never fires —
// exercised directly against lib/init.mjs in test/init-wizard.test.mjs.

test('init --global: prints the exact 4-line DISABLED summary; wires the hook', () => {
  const home = mkTmp('sage-i-')
  const out = run(['init', '--global'], home, mkTmp('sage-i-cwd-'))
  const lines = out.trimEnd().split('\n')
  assert.equal(lines[0], '✓ SAGE wired · global · DISABLED')
  assert.ok(lines.length <= 5)
  assert.equal(fs.lstatSync(path.join(home, '.claude', 'hooks', 'agentic-sage-emit.mjs')).isSymbolicLink(), true)
})

test('init --global --enable: prints ENABLED and flips the global config on', () => {
  const home = mkTmp('sage-i-')
  const out = run(['init', '--global', '--enable'], home, mkTmp('sage-i-cwd-'))
  assert.match(out, /^✓ SAGE wired · global · ENABLED/)
  assert.equal(JSON.parse(fs.readFileSync(globalConfig(home), 'utf8')).enabled, true)
})

test('init --project: DISABLED by default (never auto-enable); wires project settings + marker', () => {
  const home = mkTmp('sage-i-')
  const repo = mkGitRepo()
  const out = run(['init', '--project'], home, repo)
  assert.match(out, /^✓ SAGE wired · project · DISABLED/)
  assert.ok(fs.existsSync(path.join(repo, '.agentic-sage', 'config.json')))
  assert.ok(fs.existsSync(path.join(repo, '.claude', 'settings.json')))
  const marker = JSON.parse(fs.readFileSync(path.join(repo, '.agentic-sage', 'config.json'), 'utf8'))
  assert.equal(marker.enabled, false)
})

test('init --project --enable: prints ENABLED; repo config.json has enabled:true', () => {
  const home = mkTmp('sage-i-')
  const repo = mkGitRepo()
  const out = run(['init', '--project', '--enable'], home, repo)
  assert.match(out, /^✓ SAGE wired · project · ENABLED/)
  const marker = JSON.parse(fs.readFileSync(path.join(repo, '.agentic-sage', 'config.json'), 'utf8'))
  assert.equal(marker.enabled, true)
})

test('init --show: prints the full breakdown, writes nothing', () => {
  const home = mkTmp('sage-i-')
  const cwd = mkTmp('sage-i-cwd-')
  const out = run(['init', '--show'], home, cwd)
  assert.match(out, /SAGE — full breakdown/)
  assert.equal(fs.existsSync(path.join(home, '.claude')), false)
})

test('init with no flags and non-TTY stdin defaults to global, OFF', () => {
  const home = mkTmp('sage-i-')
  const out = run(['init'], home, mkTmp('sage-i-cwd-'))
  assert.match(out, /^✓ SAGE wired · global · DISABLED/)
})

test('init: unknown flag prints a clear hint (usage), no crash', () => {
  const home = mkTmp('sage-i-')
  const out = run(['init', '--bogus'], home, mkTmp('sage-i-cwd-'))
  assert.match(out, /unknown flag --bogus/)
})

test('init --repair: re-asserts current wiring without changing enablement', () => {
  const home = mkTmp('sage-i-')
  const cwd = mkTmp('sage-i-cwd-')
  run(['init', '--global', '--enable'], home, cwd)
  const out = run(['init', '--repair'], home, cwd)
  assert.match(out, /re-asserted global wiring/)
  assert.match(out, /ENABLED/)
})

// ── plan 011: legacy-install upgrade (npm-update-no-re-init guarantee) ─────

test('plan 011 e2e: a legacy install (~/.claude/sage) reads fine via fallback with no init; `sage init --global` migrates it in place; a second init is a noop', () => {
  const home = mkTmp('sage-mig-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)

  // Seed a fake LEGACY install (pre-rename on-disk shape) — as if this
  // were a real ~/.claude/sage/ left behind by a pre-plan-011 install.
  const legacyHome = path.join(home, '.claude', 'sage')
  fs.mkdirSync(legacyHome, { recursive: true })
  fs.writeFileSync(path.join(legacyHome, 'config.json'), JSON.stringify({ enabled: true }))
  const legacySessions = path.join(legacyHome, 'repos', id, 'sessions')
  fs.mkdirSync(legacySessions, { recursive: true })
  const seededRecord = { session_id: 's1', branch: 'feat-legacy', updated_at: '2026-06-28T12:00:00Z' }
  fs.writeFileSync(path.join(legacySessions, 's1.json'), JSON.stringify(seededRecord))

  // Reads work via the legacy fallback WITHOUT running init — the
  // npm-update-no-re-init guarantee: an upgraded npm package must not
  // require a re-init just to keep reading an existing install.
  assert.match(run(['board'], home, repo), /feat-legacy/)
  assert.equal(fs.existsSync(path.join(home, '.claude', 'agentic-sage')), false) // read-only: untouched

  // `sage init --global` migrates the state dir in place (safe rename).
  const out = run(['init', '--global'], home, repo)
  assert.match(out, /migrated legacy state dir/)
  assert.equal(fs.existsSync(legacyHome), false) // legacy dir gone (renamed, not copied)
  const newSessionFile = path.join(home, '.claude', 'agentic-sage', 'repos', id, 'sessions', 's1.json')
  assert.equal(fs.existsSync(newSessionFile), true) // the record moved intact
  assert.deepEqual(JSON.parse(fs.readFileSync(newSessionFile, 'utf8')), seededRecord)
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(home, '.claude', 'agentic-sage', 'config.json'), 'utf8')),
    { enabled: true },
  )

  // A second init is a noop for the migration (state dir is new-only now).
  const out2 = run(['init', '--global'], home, repo)
  assert.doesNotMatch(out2, /migrated legacy state dir/)
  assert.doesNotMatch(out2, /both .* exist/)
  assert.equal(fs.existsSync(newSessionFile), true) // record still intact, untouched
})

test('where: not a git repo → clear line', () => {
  const home = mkTmp('sage-w-')
  assert.match(run(['where'], home, mkTmp('sage-w-nogit-')), /not a git repo/)
})

test('where: fresh repo before any init → built-in rule, global scope', () => {
  const home = mkTmp('sage-w-')
  const repo = mkGitRepo()
  const out = run(['where'], home, repo)
  assert.match(out, /scope\s+global/)
  assert.match(out, /matched\s+built-in/)
})

test('where: after project init → marker rule, project scope', () => {
  const home = mkTmp('sage-w-')
  const repo = mkGitRepo()
  run(['init', '--project'], home, repo)
  const out = run(['where'], home, repo)
  assert.match(out, /scope\s+project/)
  assert.match(out, /matched\s+marker/)
})

test('enable/disable: flips the resolved repo data dir config.json', () => {
  const home = mkTmp('sage-ed-')
  const repo = mkGitRepo()
  run(['init', '--project'], home, repo) // DISABLED by default
  let out = run(['disable'], home, repo)
  assert.match(out, /disabled for/)
  let marker = JSON.parse(fs.readFileSync(path.join(repo, '.agentic-sage', 'config.json'), 'utf8'))
  assert.equal(marker.enabled, false)
  out = run(['enable'], home, repo)
  assert.match(out, /enabled for/)
  marker = JSON.parse(fs.readFileSync(path.join(repo, '.agentic-sage', 'config.json'), 'utf8'))
  assert.equal(marker.enabled, true)
})

test('enable/disable: non-git cwd → clear line', () => {
  const home = mkTmp('sage-ed-')
  const cwd = mkTmp('sage-ed-nogit-')
  assert.match(run(['enable'], home, cwd), /not a git repo/)
  assert.match(run(['disable'], home, cwd), /not a git repo/)
})

test('init --project from a linked worktree with repo-root storage refuses and redirects to the main checkout', () => {
  const home = mkTmp('sage-wt-')
  const main = mkGitRepo()
  const wt = path.join(mkTmp('sage-wtp-'), 'wt')
  git(main, 'worktree', 'add', '-q', wt, '-b', 'wt-branch')
  const out = run(['init', '--project'], home, wt)
  assert.match(out, /repo-root storage must be set up from the main checkout/)
  assert.match(out, new RegExp(main.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.equal(fs.existsSync(path.join(wt, '.agentic-sage')), false)
  assert.equal(fs.existsSync(path.join(main, '.agentic-sage')), false)
})

test('init --project --storage sibling from a linked worktree is allowed (writes land at the main root)', () => {
  const home = mkTmp('sage-wt-')
  const main = mkGitRepo()
  const wt = path.join(mkTmp('sage-wtp-'), 'wt')
  git(main, 'worktree', 'add', '-q', wt, '-b', 'wt-branch2')
  const out = run(['init', '--project', '--storage', 'sibling'], home, wt)
  assert.match(out, /^✓ SAGE wired · project · DISABLED/)
  assert.equal(fs.existsSync(path.join(main, '.claude', 'settings.json')), true)
  assert.equal(fs.existsSync(path.join(wt, '.claude', 'settings.json')), false)
})
