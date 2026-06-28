import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { mkTmp, mkGitRepo } from './helpers.mjs'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { sessionsDir, globalConfig } from '../lib/paths.mjs'

const SAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'sage')
const run = (args, home, cwd) =>
  execFileSync('node', [SAGE, ...args], { encoding: 'utf8', env: { ...process.env, HOME: home }, cwd })

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
