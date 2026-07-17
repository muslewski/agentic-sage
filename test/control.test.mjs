import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp, mkGitRepo } from './helpers.mjs'
import { sessionsDir, globalConfig, sageHome } from '../lib/paths.mjs'
import { readRecord } from '../lib/store.mjs'
import { writeRegistryEntry, legacySageHome, migrateStateDir } from '../lib/roots.mjs'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { wireProject, wireAll } from '../lib/wiring.mjs'
import { fileURLToPath } from 'node:url'
import {
  setEnabled,
  readEnabled,
  setRepoEnabled,
  linkSession,
  unlinkSession,
  listRepos,
  doctor,
  renderDoctor,
} from '../lib/control.mjs'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

test('setEnabled/readEnabled roundtrip + creates dir', () => {
  const home = mkTmp('sage-c-')
  setEnabled(home, true)
  assert.equal(readEnabled(home), true)
  assert.deepEqual(JSON.parse(fs.readFileSync(globalConfig(home), 'utf8')), { enabled: true })
  setEnabled(home, false)
  assert.equal(readEnabled(home), false)
})

test('setEnabled on legacy-only install does not create new agentic-sage home', () => {
  const home = mkTmp('sage-c-')
  const legacyCfg = path.join(legacySageHome(home), 'config.json')
  fs.mkdirSync(path.dirname(legacyCfg), { recursive: true })
  fs.writeFileSync(legacyCfg, JSON.stringify({ enabled: false }))
  assert.equal(fs.existsSync(sageHome(home)), false)
  setEnabled(home, true)
  assert.equal(fs.existsSync(sageHome(home)), false, 'must not poison migrate with empty new home')
  assert.equal(JSON.parse(fs.readFileSync(legacyCfg, 'utf8')).enabled, true)
  assert.equal(migrateStateDir(home), 'renamed')
})

test('listRepos includes legacy-home repos when new home is empty', () => {
  const home = mkTmp('sage-c-')
  const legacySidDir = path.join(legacySageHome(home), 'repos', 'legacy-repo', 'sessions')
  fs.mkdirSync(legacySidDir, { recursive: true })
  fs.writeFileSync(path.join(legacySidDir, 's1.json'), '{}')
  const repos = listRepos(home)
  assert.ok(repos.some((r) => r.repoId === 'legacy-repo' && r.sessions === 1))
})

test('linkSession/unlinkSession set link_state', () => {
  const home = mkTmp('sage-c-')
  linkSession(home, 'repo-x', 's1', 'linked')
  assert.equal(readRecord(home, 'repo-x', 's1').link_state, 'linked')
  unlinkSession(home, 'repo-x', 's1')
  assert.equal(readRecord(home, 'repo-x', 's1').link_state, 'closed')
})

test('listRepos counts sessions; empty → []', () => {
  const home = mkTmp('sage-c-')
  assert.deepEqual(listRepos(home), [])
  fs.mkdirSync(sessionsDir(home, 'repo-a'), { recursive: true })
  fs.writeFileSync(path.join(sessionsDir(home, 'repo-a'), 's1.json'), '{}')
  fs.writeFileSync(path.join(sessionsDir(home, 'repo-a'), 's2.json'), '{}')
  const repos = listRepos(home)
  assert.equal(repos.find((r) => r.repoId === 'repo-a').sessions, 2)
})

test('doctor reports checks without throwing; hook absent → not ok', () => {
  const home = mkTmp('sage-c-')
  setEnabled(home, true)
  const checks = doctor(home, mkTmp('sage-norepo-'))
  const byName = Object.fromEntries(checks.map((c) => [c.name, c]))
  assert.equal(byName['global config'].ok, true)
  assert.equal(byName['emitter hook'].ok, false)
  assert.match(renderDoctor(checks), /global config/)
})

// --- P8: token-forecast doctor check is config-driven (portable) ---

const writeConfig = (home, cfg) => {
  fs.mkdirSync(sageHome(home), { recursive: true })
  fs.writeFileSync(globalConfig(home), JSON.stringify(cfg))
}
const tfCheck = (home) => doctor(home, mkTmp('sage-norepo-')).find((c) => c.name === 'token-forecast')

test('token-forecast: configured + present ⇒ ok', () => {
  const home = mkTmp('sage-tf-')
  const tf = path.join(home, 'tf')
  fs.mkdirSync(tf, { recursive: true })
  writeConfig(home, { enabled: false, tokenForecastPath: tf })
  const c = tfCheck(home)
  assert.equal(c.ok, true)
  assert.match(c.detail, /present/)
})

test('token-forecast: configured + absent ⇒ not ok', () => {
  const home = mkTmp('sage-tf-')
  writeConfig(home, { enabled: false, tokenForecastPath: path.join(home, 'nope') })
  const c = tfCheck(home)
  assert.equal(c.ok, false)
  assert.match(c.detail, /absent/)
})

test('token-forecast: unset ⇒ not configured (optional), no hardcoded path', () => {
  const home = mkTmp('sage-tf-')
  writeConfig(home, { enabled: false })
  const c = tfCheck(home)
  assert.equal(c.ok, true)
  assert.match(c.detail, /not configured/)
})

test('token-forecast: ~ expands under HOME', () => {
  const home = mkTmp('sage-tf-')
  fs.mkdirSync(path.join(home, 'tfx'), { recursive: true })
  writeConfig(home, { enabled: false, tokenForecastPath: '~/tfx' })
  const c = tfCheck(home)
  assert.equal(c.ok, true)
  assert.match(c.detail, /present/)
})

test('setEnabled merges — preserves tokenForecastPath across on/off', () => {
  const home = mkTmp('sage-tf-')
  writeConfig(home, { enabled: false, tokenForecastPath: '~/tfx' })
  setEnabled(home, true)
  const cfg = JSON.parse(fs.readFileSync(globalConfig(home), 'utf8'))
  assert.equal(cfg.enabled, true)
  assert.equal(cfg.tokenForecastPath, '~/tfx')
})

// --- P12: skills-linked doctor check + verdict summary ---

test('doctor: skills-linked check — absent ⇒ not ok; both linked ⇒ ok', () => {
  const home = mkTmp('sage-sk-')
  const c0 = doctor(home, mkTmp('sage-norepo-')).find((c) => c.name === 'skills linked')
  assert.equal(c0.ok, false)
  assert.match(c0.detail, /missing/)
  const sk = path.join(home, '.claude', 'skills')
  fs.mkdirSync(sk, { recursive: true })
  for (const n of ['sage-fleet', 'sage-doctor']) fs.symlinkSync(mkTmp('sage-tgt-'), path.join(sk, n))
  const c1 = doctor(home, mkTmp('sage-norepo-')).find((c) => c.name === 'skills linked')
  assert.equal(c1.ok, true)
})

test('renderDoctor ends with a verdict summary', () => {
  const home = mkTmp('sage-v-')
  assert.match(renderDoctor(doctor(home, mkTmp('sage-norepo-'))), /\d+ ok · \d+ need attention/)
})

test('doctor: project adapter check — none ⇒ ok + "core-only"', () => {
  const home = mkTmp('sage-ad-')
  const c = doctor(home, mkTmp('sage-norepo-')).find((c) => c.name === 'project adapter')
  assert.equal(c.ok, true)
  assert.match(c.detail, /none/)
})

// --- P10: doctor remedies + listRepos aggregation ---

test('doctor: failing checks carry a fix; renderDoctor prints the remedy line', () => {
  const home = mkTmp('sage-fix-')
  const checks = doctor(home, mkTmp('sage-norepo-'))
  const hook = checks.find((c) => c.name === 'emitter hook')
  assert.equal(hook.ok, false)
  assert.equal(hook.fix, 'sage init --repair')
  const rendered = renderDoctor(checks)
  assert.match(rendered, /✗ emitter hook — [^\n]*\n\s+→ run: sage init --repair/)
})

test('doctor: missing global config recommends `sage init` (not --repair)', () => {
  const home = mkTmp('sage-fix-')
  const gc = doctor(home, mkTmp('sage-norepo-')).find((c) => c.name === 'global config')
  assert.equal(gc.ok, false)
  assert.equal(gc.fix, 'sage init')
})

test('doctor: a passing check never gets a remedy line', () => {
  const home = mkTmp('sage-fix-')
  setEnabled(home, true)
  const checks = doctor(home, mkTmp('sage-norepo-'))
  const gc = checks.find((c) => c.name === 'global config')
  assert.equal(gc.ok, true)
  assert.equal('fix' in gc, false)
  // the line directly under "global config" must NOT be a remedy line (other,
  // still-failing checks further down legitimately have their own → run:)
  assert.doesNotMatch(renderDoctor(checks), /global config[^\n]*\n\s*→ run:/)
})

test('doctor: scope + storage check is informational inside a repo (built-in, before any init)', () => {
  const home = mkTmp('sage-fix-')
  const repo = mkGitRepo()
  const c = doctor(home, repo).find((cc) => cc.name === 'scope + storage')
  assert.equal(c.ok, true)
  assert.match(c.detail, /global · .* · via built-in/)
})

test('doctor: storage dir + scope check are informational (n/a) outside a git repo', () => {
  const home = mkTmp('sage-fix-')
  const checks = doctor(home, mkTmp('sage-norepo-'))
  assert.equal(checks.find((c) => c.name === 'storage dir').detail, 'n/a (not a git repo)')
  assert.equal(checks.find((c) => c.name === 'scope + storage').detail, 'n/a (not a git repo)')
})

test('setRepoEnabled: read-merge-write roundtrip, preserves other keys', () => {
  const home = mkTmp('sage-re-')
  const dataDir = path.join(home, 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify({ storageRoot: '/x' }))
  setRepoEnabled(dataDir, true)
  let cfg = JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'), 'utf8'))
  assert.equal(cfg.enabled, true)
  assert.equal(cfg.storageRoot, '/x')
  setRepoEnabled(dataDir, false)
  cfg = JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'), 'utf8'))
  assert.equal(cfg.enabled, false)
})

test('listRepos: unions the repos/ scan with registry-only entries (dedupe by id)', () => {
  const home = mkTmp('sage-lr-')
  fs.mkdirSync(sessionsDir(home, 'repo-built-in'), { recursive: true })
  fs.writeFileSync(path.join(sessionsDir(home, 'repo-built-in'), 's1.json'), '{}')

  const extDir = mkTmp('sage-ext-')
  fs.mkdirSync(path.join(extDir, 'sessions'), { recursive: true })
  fs.writeFileSync(path.join(extDir, 'sessions', 's1.json'), '{}')
  fs.writeFileSync(path.join(extDir, 'sessions', 's2.json'), '{}')
  writeRegistryEntry(home, 'repo-external', { dataDir: extDir, scope: 'project', mainRoot: extDir })

  const repos = listRepos(home)
  const byId = Object.fromEntries(repos.map((r) => [r.repoId, r]))
  assert.equal(byId['repo-built-in'].sessions, 1)
  assert.equal(byId['repo-external'].sessions, 2)
})

test('listRepos: a repo present in BOTH the scan and the registry is not double-counted', () => {
  const home = mkTmp('sage-lr-')
  const repo = mkGitRepo()
  wireProject({ home, repoRoot: REPO_ROOT, projectRoot: repo, storage: 'agent-home' })
  const id = resolveRepoId(repo)
  fs.mkdirSync(sessionsDir(home, id), { recursive: true })
  fs.writeFileSync(path.join(sessionsDir(home, id), 's1.json'), '{}')
  const matches = listRepos(home).filter((r) => r.repoId === id)
  assert.equal(matches.length, 1)
})

// ── plan 014: grok wiring doctor check ─────────────────────────────────────

test('doctor: grok wiring ok when hook file + emitter present', () => {
  const home = mkTmp('sage-c-')
  wireAll({ home, repoRoot: REPO_ROOT, harness: 'grok' })
  const checks = doctor(home, mkTmp('sage-norepo-'))
  const row = checks.find((c) => /grok/i.test(c.name))
  assert.ok(row && row.ok)
})

test('doctor: grok wiring flagged when ~/.grok exists but unwired', () => {
  const home = mkTmp('sage-c-')
  fs.mkdirSync(path.join(home, '.grok'), { recursive: true })
  const checks = doctor(home, mkTmp('sage-norepo-'))
  const row = checks.find((c) => /grok/i.test(c.name))
  assert.ok(row && !row.ok)
  assert.match(String(row.fix || row.remedy || row.detail), /--harness both/)
})

test('doctor: grok check absent/na when ~/.grok missing', () => {
  const home = mkTmp('sage-c-')
  const checks = doctor(home, mkTmp('sage-norepo-'))
  const row = checks.find((c) => /grok/i.test(c.name))
  assert.ok(!row || row.ok !== false)
})

// ── Phase 5 Child B s4: health banner + checklist + fix hints ───────────────

test('s4: renderDoctor health banner shows HEALTH ok/total + gauge + pct', () => {
  const home = mkTmp('sage-s4-')
  const checks = doctor(home, mkTmp('sage-norepo-'))
  const ok = checks.filter((c) => c.ok).length
  const n = checks.length
  const txt = renderDoctor(checks)
  assert.match(txt, new RegExp(`SAGE doctor · HEALTH ${ok}/${n}`))
  assert.match(txt, /[█░]+/)
  assert.match(txt, /\d+%/)
  // checklist + verdict still present
  assert.match(txt, /[✓✗]/)
  assert.match(txt, /\d+ ok · \d+ need attention/)
})

test('s4: every failing check carries a fix; renderDoctor prints a hint under each', () => {
  const home = mkTmp('sage-s4-')
  // force token-forecast absent + missing install surface
  fs.mkdirSync(sageHome(home), { recursive: true })
  fs.writeFileSync(
    globalConfig(home),
    JSON.stringify({ enabled: false, tokenForecastPath: path.join(home, 'missing-tf') }),
  )
  const checks = doctor(home, mkTmp('sage-norepo-'))
  const fails = checks.filter((c) => !c.ok)
  assert.ok(fails.length >= 1)
  for (const f of fails) {
    assert.ok(f.fix, `failing check "${f.name}" must carry a fix hint`)
  }
  const rendered = renderDoctor(checks)
  for (const f of fails) {
    // each failure line is followed (next non-empty indent) by → run: …
    const re = new RegExp(
      `✗ ${f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — [^\\n]*\\n\\s+→ run: ${f.fix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    )
    assert.match(rendered, re)
  }
})

test('s4: doctor exit stays 0 regardless of failures (CLI wiring contract)', async () => {
  // Pure contract: renderDoctor / doctor never throw; process exit is bin's job
  // and remains always-0 for doctor. Guarded here as a pure non-throw invariant.
  const home = mkTmp('sage-s4-')
  assert.doesNotThrow(() => renderDoctor(doctor(home, mkTmp('sage-norepo-'))))
})
