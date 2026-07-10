import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { parseInitArgs, runWizard, renderSummary, renderShow } from '../lib/init.mjs'
import { mkTmp, mkGitRepo } from './helpers.mjs'
import { wireProject } from '../lib/wiring.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── parseInitArgs ────────────────────────────────────────────────────────

test('parseInitArgs: no flags → wizard mode, global default', () => {
  const r = parseInitArgs([])
  assert.equal(r.mode, 'wizard')
  assert.equal(r.scope, 'global')
  assert.equal(r.harness, 'claude')
  assert.equal(r.yes, false)
  assert.equal(r.enable, false)
})

test('parseInitArgs: --global → apply mode, global scope', () => {
  const r = parseInitArgs(['--global'])
  assert.equal(r.mode, 'apply')
  assert.equal(r.scope, 'global')
})

test('parseInitArgs: --global --enable --storage <path>', () => {
  const r = parseInitArgs(['--global', '--enable', '--storage', '/tmp/custom-root'])
  assert.equal(r.mode, 'apply')
  assert.equal(r.scope, 'global')
  assert.equal(r.enable, true)
  assert.equal(r.storage, '/tmp/custom-root')
})

test('parseInitArgs: --project → apply mode, project scope', () => {
  const r = parseInitArgs(['--project'])
  assert.equal(r.mode, 'apply')
  assert.equal(r.scope, 'project')
})

test('parseInitArgs: --project --path <dir> --storage sibling --yes --enable', () => {
  const r = parseInitArgs(['--project', '--path', '/tmp/proj', '--storage', 'sibling', '--yes', '--enable'])
  assert.equal(r.mode, 'apply')
  assert.equal(r.scope, 'project')
  assert.equal(r.projectPath, '/tmp/proj')
  assert.equal(r.storage, 'sibling')
  assert.equal(r.yes, true)
  assert.equal(r.enable, true)
})

test('parseInitArgs: --repair → repair mode', () => {
  const r = parseInitArgs(['--repair'])
  assert.equal(r.mode, 'repair')
})

test('parseInitArgs: --show → show mode', () => {
  const r = parseInitArgs(['--show'])
  assert.equal(r.mode, 'show')
})

test('parseInitArgs: --yes alone is decisive → apply mode, defaults to global', () => {
  const r = parseInitArgs(['--yes'])
  assert.equal(r.mode, 'apply')
  assert.equal(r.scope, 'global')
  assert.equal(r.yes, true)
})

test('parseInitArgs: unknown flag → error, caller prints usage', () => {
  const r = parseInitArgs(['--bogus'])
  assert.equal(r.error, 'unknown flag --bogus')
})

test('parseInitArgs: --global --project conflict → error', () => {
  const r = parseInitArgs(['--global', '--project'])
  assert.match(r.error, /cannot combine/)
})

// ── runWizard ────────────────────────────────────────────────────────────

// Feed one scripted answer per event-loop tick (setImmediate) — writing every
// line in a single write() would let readline emit all the resulting 'line'
// events synchronously in one burst, but only the FIRST rl.question() call
// has an active listener at that point; the rest are silently dropped and
// the interface then auto-closes on end(), breaking any later question().
// Pacing one line per tick lets each awaited question() re-attach its
// listener before the next line arrives.
const scriptedStreams = (answers) => {
  const input = new PassThrough()
  const output = new PassThrough()
  let out = ''
  output.on('data', (chunk) => {
    out += chunk.toString()
  })
  let i = 0
  const feed = () => {
    if (i < answers.length) {
      input.write(`${answers[i++]}\n`)
      setImmediate(feed)
    } else {
      input.end()
    }
  }
  setImmediate(feed)
  return { input, output, getOutput: () => out }
}

test('runWizard: all defaults (just Enters) → global, claude, no storage override, not enabled', async () => {
  const { input, output } = scriptedStreams(['', '', '', ''])
  const cwd = mkTmp('sage-wiz-')
  const r = await runWizard({ input, output, cwd })
  assert.deepEqual(r, {
    mode: 'apply',
    scope: 'global',
    projectPath: undefined,
    storage: undefined,
    harness: 'claude',
    yes: true,
    enable: false,
  })
})

test('runWizard: project + sibling + enable', async () => {
  const { input, output } = scriptedStreams(['2', '', '2', '2'])
  const cwd = mkTmp('sage-wiz-')
  const r = await runWizard({ input, output, cwd })
  assert.equal(r.scope, 'project')
  assert.equal(r.projectPath, cwd)
  assert.equal(r.storage, 'sibling')
  assert.equal(r.harness, 'claude')
  assert.equal(r.enable, true)
})

test('runWizard: invalid input reprompts once, then takes the valid answer', async () => {
  const { input, output, getOutput } = scriptedStreams(['foo', '2', '', '', ''])
  const cwd = mkTmp('sage-wiz-')
  const r = await runWizard({ input, output, cwd })
  assert.equal(r.scope, 'project') // second (valid) answer wins
  assert.match(getOutput(), /invalid choice/)
})

test('runWizard: global + custom storage path', async () => {
  const { input, output } = scriptedStreams(['', '', '2', '/custom/root', ''])
  const cwd = mkTmp('sage-wiz-')
  const r = await runWizard({ input, output, cwd })
  assert.equal(r.scope, 'global')
  assert.equal(r.storage, '/custom/root')
  assert.equal(r.enable, false)
})

// ── renderSummary ────────────────────────────────────────────────────────

test('renderSummary: global disabled matches the exact 4-line block', () => {
  const home = '/home/x'
  const out = renderSummary({ scope: 'global', enabled: false, dataDir: '/home/x/.claude/sage', home })
  assert.equal(
    out,
    ['✓ SAGE wired · global · DISABLED', '  storage  ~/.claude/sage', '  next     sage on   ·   sage doctor', '  details  sage init --show'].join(
      '\n',
    ),
  )
})

test('renderSummary: project enabled matches the exact 4-line block', () => {
  const home = '/home/x'
  const out = renderSummary({ scope: 'project', enabled: true, dataDir: '/work/myrepo/.agentic-sage', home })
  assert.equal(
    out,
    [
      '✓ SAGE wired · project · ENABLED',
      '  storage  /work/myrepo/.agentic-sage',
      '  next     sage doctor   ·   sage board',
      '  details  sage init --show',
    ].join('\n'),
  )
})

// ── renderShow ───────────────────────────────────────────────────────────

test('renderShow: non-git cwd → clean breakdown, no crash, plain-text groups', () => {
  const home = mkTmp('sage-show-')
  const cwd = mkTmp('sage-nogit-')
  const out = renderShow({ home, cwd })
  assert.match(out, /SAGE — full breakdown/)
  assert.match(out, /repo\s+not a git repo/)
  assert.match(out, /Harness \(claude; grok via compat or native \.grok\)/)
  assert.match(out, /Storage/)
  assert.match(out, /Enablement/)
  assert.match(out, /global\s+disabled/)
})

test('renderShow: inside a project-scoped repo shows scope project + marker match', () => {
  const home = mkTmp('sage-show-')
  const project = mkGitRepo()
  wireProject({ home, repoRoot: REPO_ROOT, projectRoot: project })
  const out = renderShow({ home, cwd: project })
  assert.match(out, /scope\s+project/)
  assert.match(out, /matched\s+marker/)
  assert.match(out, new RegExp(project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})
