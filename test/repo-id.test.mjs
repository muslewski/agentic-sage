import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { repoIdFromRoot, resolveRepoId } from '../lib/repo-id.mjs'
import { mkTmp, mkGitRepo, git } from './helpers.mjs'

test('repoIdFromRoot is slug-shaped and deterministic', () => {
  const a = repoIdFromRoot('/a/b/acme')
  assert.match(a, /^acme-[0-9a-f]{8}$/)
  assert.equal(a, repoIdFromRoot('/a/b/acme'))
})

test('a worktree resolves to the same id as its main checkout', () => {
  const main = mkGitRepo()
  const wt = path.join(mkTmp('sage-wtp-'), 'wt') // must not pre-exist
  git(main, 'worktree', 'add', '-q', wt, '-b', 'wtbranch')
  assert.equal(resolveRepoId(main), resolveRepoId(wt))
})

test('non-git path resolves to null', () => {
  const notRepo = mkTmp('sage-norepo-')
  fs.writeFileSync(path.join(notRepo, 'x'), 'x')
  assert.equal(resolveRepoId(notRepo), null)
})
