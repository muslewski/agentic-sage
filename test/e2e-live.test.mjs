import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { globalConfig, repoDir, sessionFile } from '../lib/paths.mjs'

const LIVE = process.env.SAGE_E2E_LIVE === '1'
const home = os.homedir()

// Recompute using the same builder as lib/paths.mjs + roots.mjs precedence.
// For an unconfigured throwaway repo this resolves to the agent-home built-in
// (rules 3/4): <home>/.claude/agentic-sage/repos/<repoId>
const dataDirFor = (repoId) => repoDir(home, repoId)

const sageEnabled = () => {
  try {
    return JSON.parse(
      fs.readFileSync(globalConfig(home), 'utf8'),
    ).enabled === true
  } catch {
    return false
  }
}
const grokWired = () =>
  fs.existsSync(path.join(home, '.grok', 'hooks', 'agentic-sage.json')) ||
  fs.existsSync(path.join(home, '.grok', 'hooks', 'sage.json'))

test('LIVE: grok -p child fires hooks into sage records', { skip: !LIVE && 'set SAGE_E2E_LIVE=1 to run' }, (t) => {
  if (!sageEnabled()) return t.skip('sage not enabled globally — run the go-live runbook first')
  if (!grokWired()) return t.skip('grok hooks not wired — run: sage init --global --harness both')

  // throwaway repo OUTSIDE any judged project
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sage-live-'))
  execFileSync('git', ['-C', repo, 'init', '-q'])
  execFileSync('git', ['-C', repo, 'commit', '--allow-empty', '-m', 'init', '-q'], {
    env: { ...process.env, GIT_AUTHOR_NAME: 'e2e', GIT_AUTHOR_EMAIL: 'e2e@local',
           GIT_COMMITTER_NAME: 'e2e', GIT_COMMITTER_EMAIL: 'e2e@local' },
  })
  const repoId = resolveRepoId(repo)

  try {
    const r = spawnSync('grok', ['-p', 'Reply with exactly: OK', '--output-format', 'json'], {
      cwd: repo, encoding: 'utf8', timeout: 180_000,
    })
    assert.equal(r.status, 0, `grok -p failed: ${r.stderr}`)
    const sid = JSON.parse(r.stdout).sessionId
    assert.ok(sid, 'grok --output-format json returned a sessionId')

    const recPath = sessionFile(home, repoId, sid)
    // hooks are async-ish at session close; allow a short settle
    const deadline = Date.now() + 10_000
    let rec = null
    while (Date.now() < deadline && !rec) {
      try { rec = JSON.parse(fs.readFileSync(recPath, 'utf8')) } catch { execFileSync('sleep', ['1']) }
    }
    assert.ok(rec, `VERDICT: print-mode hooks did NOT fire (no record for ${sid} at ${recPath}) — armory launcher needs the SessionStart/SessionEnd shim; log this in docs/dogfood-log.md`)
    assert.equal(rec.session_id, sid)
    console.log(`VERDICT: print-mode hooks FIRE — record present, status=${rec.status}, liveness=${rec.liveness}`)
  } finally {
    fs.rmSync(repo, { recursive: true, force: true })
    if (repoId) fs.rmSync(dataDirFor(repoId), { recursive: true, force: true }) // cleanup real-home state for the throwaway repo only
  }
})
