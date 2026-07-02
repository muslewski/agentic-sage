import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { sessionFile, eventsFile, sageHome, sessionsDir } from '../lib/paths.mjs'
import { readSidecar } from '../lib/handoff.mjs'
import { addGuardPath, setGuardEnabled } from '../lib/guard.mjs'
import { lastToolFile } from '../lib/throttle.mjs'
import { MARKER_DIR, registryPath } from '../lib/roots.mjs'
import { mkTmp, mkGitRepo, writeGlobalConfig } from './helpers.mjs'

const EMIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'agentic-sage-emit.mjs')

const emit = (payload, home) =>
  execFileSync('node', [EMIT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  })

// Non-throwing variant: capture status/stderr for the guard's exit-2 path.
const emitRaw = (payload, home) => {
  try {
    const stdout = execFileSync('node', [EMIT], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, HOME: home },
    })
    return { status: 0, stdout, stderr: '' }
  } catch (e) {
    return { status: e.status, stdout: e.stdout || '', stderr: e.stderr || '' }
  }
}

const pre = (repo, file, tool = 'Edit') => ({
  hook_event_name: 'PreToolUse',
  session_id: 'g1',
  cwd: repo,
  tool_name: tool,
  tool_input: file === null ? null : { file_path: path.join(repo, file) },
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

test('PreCompact auto-dumps md+json and stamps the record', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  const tmpDir = mkTmp('sage-dump-')
  execFileSync('node', [EMIT], {
    input: JSON.stringify({ hook_event_name: 'PreCompact', session_id: 's1', cwd: repo }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home, SAGE_TMPDIR: tmpDir },
  })
  const jsons = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.json'))
  assert.equal(jsons.length, 1)
  const sc = readSidecar(path.join(tmpDir, jsons[0]))
  assert.equal(sc.source, 'precompact')
  const rec = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.ok(rec.handoff_path)
  assert.ok(rec.handoff_at)
  const events = fs.readFileSync(eventsFile(home, id), 'utf8').split('\n').filter(Boolean)
  assert.ok(events.map((l) => JSON.parse(l).event).includes('precompact'))
})

// P8 portability: the handoff sidecar filename is prefixed by the REPO BASENAME,
// never a project literal. Characterization test — the behavior ships from P2
// (emitter: prefix = path.basename(resolveRepoRoot(cwd))); this guards it.
test('PreCompact sidecar prefix is the repo basename (portable, no project literal)', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  // a git repo whose dir basename we control
  const parent = mkTmp('sage-pp-')
  const repo = path.join(parent, 'zzz-portable')
  fs.mkdirSync(repo)
  execFileSync('git', ['-C', repo, 'init', '-q', '-b', 'main'], { stdio: 'ignore' })
  execFileSync('git', ['-C', repo, 'config', 'user.email', 't@t'], { stdio: 'ignore' })
  execFileSync('git', ['-C', repo, 'config', 'user.name', 't'], { stdio: 'ignore' })
  fs.writeFileSync(path.join(repo, 'README.md'), '# t\n')
  execFileSync('git', ['-C', repo, 'add', '-A'], { stdio: 'ignore' })
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'init'], { stdio: 'ignore' })
  const tmpDir = mkTmp('sage-dump-')
  execFileSync('node', [EMIT], {
    input: JSON.stringify({ hook_event_name: 'PreCompact', session_id: 's1', cwd: repo }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home, SAGE_TMPDIR: tmpDir },
  })
  const jsons = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.json'))
  assert.equal(jsons.length, 1)
  assert.ok(jsons[0].startsWith('zzz-portable-handoff-'), `prefix was: ${jsons[0]}`)
  assert.ok(!jsons[0].includes('acme'))
})

const seedOther = (home, id, rec) => {
  fs.mkdirSync(sessionsDir(home, id), { recursive: true })
  fs.writeFileSync(path.join(sessionsDir(home, id), `${rec.session_id}.json`), JSON.stringify(rec))
}

test('SessionStart brief: prints a one-liner when another session exists', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  seedOther(home, id, { session_id: 'other', branch: 'feat-other', touched_globs: ['src/x.ts'], liveness: 'idle', updated_at: '2026-06-28T12:00:00Z' })
  const out = emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  assert.match(out, /sage: \d+ live · nearest feat-other touches src\/x\.ts/)
})

test('SessionStart brief: silent when solo, when disabled, and on non-SessionStart events', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  // solo → no other session → no brief
  assert.equal(emit({ hook_event_name: 'SessionStart', session_id: 'solo', cwd: repo }, home).trim(), '')
  // a Stop with another session present → still no brief (SessionStart-only)
  seedOther(home, id, { session_id: 'other', branch: 'feat-other', touched_globs: ['src/x.ts'], liveness: 'idle', updated_at: '2026-06-28T12:00:00Z' })
  assert.equal(emit({ hook_event_name: 'Stop', session_id: 'solo', cwd: repo }, home).trim(), '')
  // disabled → no brief even on SessionStart with another session present
  const home2 = mkTmp('sage-h-') // no config seeded = disabled
  const repo2 = mkGitRepo()
  seedOther(home2, resolveRepoId(repo2), { session_id: 'other', branch: 'feat-o', touched_globs: ['a.ts'], liveness: 'idle', updated_at: '2026-06-28T12:00:00Z' })
  assert.equal(emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo2 }, home2).trim(), '')
})

// ---- P7 PreToolUse guard ----

test('guard DEFAULT-OFF: listed path but disarmed ⇒ exit 0 (no block)', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  addGuardPath(home, id, 'locked.ts') // listed but NOT armed
  const r = emitRaw(pre(repo, 'locked.ts'), home)
  assert.equal(r.status, 0)
})

test('guard armed: edit to a listed path ⇒ exit 2 + stderr + guard-block event', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  addGuardPath(home, id, 'src/**')
  setGuardEnabled(home, id, true)
  const r = emitRaw(pre(repo, 'src/a.ts'), home)
  assert.equal(r.status, 2)
  assert.match(r.stderr, /src\/a\.ts/)
  assert.match(r.stderr, /sage guard off/)
  const events = fs.readFileSync(eventsFile(home, id), 'utf8').split('\n').filter(Boolean)
  assert.ok(events.map((l) => JSON.parse(l).event).includes('guard-block'))
})

test('guard armed: edit to an UNlisted path ⇒ exit 0', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  addGuardPath(home, id, 'src/**')
  setGuardEnabled(home, id, true)
  assert.equal(emitRaw(pre(repo, 'docs/a.md'), home).status, 0)
})

test('guard armed: a non-edit tool (Bash) ⇒ exit 0', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  addGuardPath(home, id, 'src/**')
  setGuardEnabled(home, id, true)
  assert.equal(emitRaw(pre(repo, 'src/a.ts', 'Bash'), home).status, 0)
})

test('guard armed but SAGE globally OFF ⇒ exit 0 (global gate wins)', () => {
  const home = mkTmp('sage-h-') // no global config = disabled
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  addGuardPath(home, id, 'src/**')
  setGuardEnabled(home, id, true)
  assert.equal(emitRaw(pre(repo, 'src/a.ts'), home).status, 0)
})

test('guard armed: malformed tool_input ⇒ exit 0 (fail-open)', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  addGuardPath(home, id, 'src/**')
  setGuardEnabled(home, id, true)
  assert.equal(emitRaw(pre(repo, null), home).status, 0)
})

test('no guard armed anywhere: PreToolUse fast-skips ⇒ exit 0, no block', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  const r = emitRaw(pre(repo, 'src/a.ts'), home)
  assert.equal(r.status, 0)
  assert.equal(fs.existsSync(eventsFile(home, id)), false) // nothing logged
})

test('PreCompact on a non-repo cwd writes nothing and does not throw', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const notRepo = mkTmp('sage-norepo-')
  const tmpDir = mkTmp('sage-dump-')
  assert.doesNotThrow(() =>
    execFileSync('node', [EMIT], {
      input: JSON.stringify({ hook_event_name: 'PreCompact', session_id: 's1', cwd: notRepo }),
      encoding: 'utf8',
      env: { ...process.env, HOME: home, SAGE_TMPDIR: tmpDir },
    }),
  )
  assert.equal(fs.readdirSync(tmpDir).length, 0)
})

// ---- Step 6: previously-uncovered events + new throttle/trunk mechanics ----

test('UserPromptSubmit sets last_prompt_at and marks the session working', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  emit({ hook_event_name: 'UserPromptSubmit', session_id: 's1', cwd: repo }, home)
  const rec = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.ok(rec.last_prompt_at)
  assert.equal(rec.liveness, 'working')
})

test('SessionEnd closes the record and logs a close event', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  emit({ hook_event_name: 'SessionEnd', session_id: 's1', cwd: repo, reason: 'clear' }, home)
  const rec = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.equal(rec.status, 'closed')
  assert.equal(rec.link_state, 'closed')
  assert.equal(rec.liveness, 'closed')
  const events = fs.readFileSync(eventsFile(home, id), 'utf8').split('\n').filter(Boolean)
  assert.ok(events.map((l) => JSON.parse(l).event).includes('close'))
})

test('PostToolUse first firing sets last_tool_at, marks working, and drops a breadcrumb', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  emit({ hook_event_name: 'PostToolUse', session_id: 's1', cwd: repo, tool_name: 'Edit' }, home)
  const rec = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.ok(rec.last_tool_at)
  assert.equal(rec.liveness, 'working')
  assert.ok(fs.existsSync(lastToolFile(home, 's1')))
})

test('PostToolUse within the throttle window leaves last_tool_at unchanged', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  emit({ hook_event_name: 'PostToolUse', session_id: 's1', cwd: repo, tool_name: 'Edit' }, home)
  const before = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8')).last_tool_at
  emit({ hook_event_name: 'PostToolUse', session_id: 's1', cwd: repo, tool_name: 'Edit' }, home)
  const after = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8')).last_tool_at
  assert.equal(after, before)
})

test('PostToolUse after the throttle window updates last_tool_at', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  emit({ hook_event_name: 'PostToolUse', session_id: 's1', cwd: repo, tool_name: 'Edit' }, home)
  const before = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8')).last_tool_at

  // Backdate both the breadcrumb and the record's last_tool_at past the window.
  const old = new Date(Date.now() - 60_000)
  fs.utimesSync(lastToolFile(home, 's1'), old, old)
  const recPath = sessionFile(home, id, 's1')
  const rec = JSON.parse(fs.readFileSync(recPath, 'utf8'))
  rec.last_tool_at = old.toISOString()
  fs.writeFileSync(recPath, JSON.stringify(rec))

  emit({ hook_event_name: 'PostToolUse', session_id: 's1', cwd: repo, tool_name: 'Edit' }, home)
  const after = JSON.parse(fs.readFileSync(recPath, 'utf8')).last_tool_at
  assert.notEqual(after, before)
})

test('SessionStart stores the derived trunk on the record', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  emit({ hook_event_name: 'SessionStart', session_id: 's1', cwd: repo, source: 'startup' }, home)
  const rec = JSON.parse(fs.readFileSync(sessionFile(home, id, 's1'), 'utf8'))
  assert.equal(rec.trunk, 'main')
})

test('emitter exits 0 even when stdin never closes (never-block backstop)', async () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true })
  const child = spawn('node', [EMIT], {
    env: { ...process.env, HOME: home },
    stdio: ['pipe', 'ignore', 'ignore'],
  })
  child.stdin.write('{"hook_event_name":"Stop","session_id":"s1"')
  // deliberately no end() — the writer holds the pipe open
  const code = await new Promise((resolve) => {
    const killer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve('timed-out')
    }, 5000)
    child.on('exit', (c) => {
      clearTimeout(killer)
      resolve(c)
    })
  })
  assert.equal(code, 0)
})

// ---- Step 3: scope-aware gate + emitter scoping (enable model v2) ----

const mkMarker = (repo, cfg = {}) => {
  const markerDir = path.join(repo, MARKER_DIR)
  fs.mkdirSync(markerDir, { recursive: true })
  fs.writeFileSync(path.join(markerDir, 'config.json'), JSON.stringify(cfg))
  return markerDir
}

test('project scope: SessionStart works with global master OFF; record lands in the marker data dir', () => {
  const home = mkTmp('sage-h-') // no global config at all = master OFF
  const repo = mkGitRepo()
  const markerDir = mkMarker(repo)

  execFileSync('node', [EMIT], {
    input: JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: 'p1',
      cwd: repo,
      source: 'startup',
    }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home, SAGE_SCOPE: 'project' },
  })

  const recPath = path.join(markerDir, 'sessions', 'p1.json')
  assert.ok(fs.existsSync(recPath), 'record should exist in the marker data dir')
  const rec = JSON.parse(fs.readFileSync(recPath, 'utf8'))
  assert.equal(rec.session_id, 'p1')
  assert.equal(rec.link_state, 'scoping')
})

test('--scope=project argv works identically to SAGE_SCOPE env', () => {
  const home = mkTmp('sage-h-') // no global config at all = master OFF
  const repo = mkGitRepo()
  const markerDir = mkMarker(repo)

  execFileSync('node', [EMIT, '--scope=project'], {
    input: JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: 'p2',
      cwd: repo,
      source: 'startup',
    }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  })

  const recPath = path.join(markerDir, 'sessions', 'p2.json')
  assert.ok(fs.existsSync(recPath), 'record should exist in the marker data dir')
})

test('double-fire defer: global hook exits without writing when the repo is project-scoped (marker present)', () => {
  const home = mkTmp('sage-h-')
  writeGlobalConfig(home, { enabled: true }) // global master ON
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  const markerDir = mkMarker(repo)

  // No SAGE_SCOPE / --scope flag ⇒ this is the GLOBAL hook.
  const out = execFileSync('node', [EMIT], {
    input: JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: 'g9',
      cwd: repo,
      source: 'startup',
    }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  })
  assert.equal(out, '') // deferred before the fleet-brief write too

  // Nothing written for this sid anywhere reachable: not the marker dir...
  assert.equal(fs.existsSync(path.join(markerDir, 'sessions', 'g9.json')), false)
  // ...and not the built-in default (where a non-deferred global write would land).
  assert.equal(fs.existsSync(sessionFile(home, id, 'g9')), false)
})

test('registry bootstrap: project-scope SessionStart indexes the repo (scope + dataDir)', () => {
  const home = mkTmp('sage-h-')
  const repo = mkGitRepo()
  const id = resolveRepoId(repo)
  const markerDir = mkMarker(repo)

  execFileSync('node', [EMIT], {
    input: JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: 'p3',
      cwd: repo,
      source: 'startup',
    }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home, SAGE_SCOPE: 'project' },
  })

  const registry = JSON.parse(fs.readFileSync(registryPath(home), 'utf8'))
  assert.equal(registry.repos[id].scope, 'project')
  assert.equal(registry.repos[id].dataDir, markerDir)
})

test('fast path preserved: no global config, no scope flag ⇒ nothing created beyond existing state', () => {
  const home = mkTmp('sage-h-') // no global config seeded
  const repo = mkGitRepo()
  const before = fs.readdirSync(home)

  execFileSync('node', [EMIT], {
    input: JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: 's9',
      cwd: repo,
      source: 'startup',
    }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  })

  assert.deepEqual(fs.readdirSync(home), before) // nothing created under HOME at all
})
