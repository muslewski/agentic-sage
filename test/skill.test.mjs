import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'sage-fleet', 'SKILL.md')

test('sage-fleet skill: exists with valid name + description frontmatter', () => {
  const src = fs.readFileSync(SKILL, 'utf8')
  const m = src.match(/^---\n([\s\S]*?)\n---/)
  assert.ok(m, 'SKILL.md must open with a YAML frontmatter block')
  const fm = m[1]
  assert.match(fm, /^name:\s*sage-fleet\s*$/m, 'name must be sage-fleet')
  assert.match(fm, /^description:\s*\S/m, 'description key must have content')
  // strip an optional folded `>` and assert the description carries real guidance
  const desc = fm.replace(/^[\s\S]*?\ndescription:\s*>?\s*/, '').replace(/\n---[\s\S]*$/, '')
  assert.ok(desc.trim().length > 30, 'description must be non-trivial')
})

test('sage-fleet skill: body names the coordination verbs it teaches', () => {
  const body = fs.readFileSync(SKILL, 'utf8')
  for (const verb of ['sage claim', 'sage territory', 'sage merge-brief', 'sage why-diverged']) {
    assert.ok(body.includes(verb), `skill body must teach \`${verb}\``)
  }
})
