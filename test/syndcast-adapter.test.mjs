import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkTmp } from './helpers.mjs'
import { ownsZone, claimedWork, backlogPath, generatedGlobs } from '../adapters/syndcast.mjs'
import { isGenerated } from '../lib/territory.mjs'

const fixture = () => {
  const root = mkTmp('sage-synd-')
  const zdir = path.join(root, 'syndcast-mind', 'map', 'zones')
  fs.mkdirSync(zdir, { recursive: true })
  fs.writeFileSync(
    path.join(zdir, 'foo.md'),
    [
      '---', 'type: zone', 'owns:', '  routes: []', '  globs:',
      '    - "src/foo/**"', '    - "src/shared/foo.ts"',
      '  tools: []', 'depends: []', '---', '# Foo zone', '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(root, 'syndcast-mind', 'BACKLOG.md'),
    [
      '| ID | Mission | Status | Lands | Notes |', '|---|---|---|---|---|',
      '| D1 | Thing | 🟡 | feat-x | doing it |',
      '| D2 | Other | ✅ | docs→main | done |', '',
    ].join('\n'),
  )
  return root
}

test('ownsZone: matching glob → zone slug; non-match → null', () => {
  const ctx = { repoRoot: fixture() }
  assert.equal(ownsZone('src/foo/a.ts', ctx), 'foo')
  assert.equal(ownsZone('src/shared/foo.ts', ctx), 'foo')
  assert.equal(ownsZone('src/bar/x.ts', ctx), null)
})

test('claimedWork: branch in Lands → row+status; unknown/none → null', () => {
  const ctx = { repoRoot: fixture() }
  assert.deepEqual(claimedWork({ branch: 'feat-x' }, ctx), { row: 'D1', status: '🟡' })
  assert.equal(claimedWork({ branch: 'nope' }, ctx), null)
  assert.equal(claimedWork({}, ctx), null)
})

test('backlogPath + generatedGlobs/isGenerated', () => {
  const ctx = { repoRoot: fixture() }
  assert.match(backlogPath(ctx), /syndcast-mind\/BACKLOG\.md$/)
  assert.equal(backlogPath({ repoRoot: mkTmp('sage-empty-') }), null)
  assert.ok(isGenerated('src/app/(payload)/admin/importMap.js', generatedGlobs()))
  assert.ok(isGenerated('x/payload-types.ts', generatedGlobs()))
  assert.ok(!isGenerated('src/lib/auth.ts', generatedGlobs()))
})
