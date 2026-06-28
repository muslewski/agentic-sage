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
