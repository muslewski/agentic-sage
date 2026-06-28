// Syndcast SAGE adapter (reference adapter — lives in agentic-sage, NOT in
// syndcast's tree; symlinked to the state dir for live use). Resolves a path →
// architectural zone and a branch → backlog row by reading syndcast-mind/ under
// ctx.repoRoot. The CORE never names a syndcast path — this module owns all that
// knowledge. Read-only, zero-dep (no YAML lib; a line scanner reads owns.globs).
import fs from 'node:fs'
import path from 'node:path'
import { overlaps } from '../lib/territory.mjs'

const mindDir = (ctx) => path.join(ctx.repoRoot, 'syndcast-mind')

// Extract a zone's `owns.globs` list. The block is:
//   owns:
//     globs:
//       - "src/foo/**"
//   <next key at 0–2 indent> → stop
const parseOwnsGlobs = (text) => {
  const globs = []
  let inGlobs = false
  for (const line of text.split('\n')) {
    if (/^\s{2}globs:\s*$/.test(line)) {
      inGlobs = true
      continue
    }
    if (inGlobs) {
      const m = line.match(/^\s{4}-\s*["']?([^"'\n]+?)["']?\s*$/)
      if (m) {
        globs.push(m[1])
        continue
      }
      if (/^\s{0,2}\S/.test(line)) break // dedent to a sibling/outer key → done
    }
  }
  return globs
}

export const ownsZone = (p, ctx) => {
  const dir = path.join(mindDir(ctx), 'map', 'zones')
  let files = []
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
  } catch {
    return null
  }
  for (const f of files) {
    let globs = []
    try {
      globs = parseOwnsGlobs(fs.readFileSync(path.join(dir, f), 'utf8'))
    } catch {
      continue
    }
    if (globs.some((g) => overlaps(g, p))) return f.replace(/\.md$/, '')
  }
  return null
}

export const backlogPath = (ctx) => {
  const p = path.join(mindDir(ctx), 'BACKLOG.md')
  try {
    return fs.statSync(p).isFile() ? p : null
  } catch {
    return null
  }
}

// Match a session's branch against a BACKLOG markdown row's Lands cell. Code
// branches appear verbatim in Lands (e.g. `fix/editor-test-type-drift`).
export const claimedWork = (rec, ctx) => {
  const branch = rec && rec.branch
  if (!branch) return null
  const p = backlogPath(ctx)
  if (!p) return null
  let text = ''
  try {
    text = fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 4) continue
    const id = cells[1] // cells[0] is '' (leading pipe)
    if (/^-+$/.test(id) || id.toLowerCase() === 'id') continue // separator/header
    if (cells.some((c) => c.includes(branch))) {
      // the Status cell is EXACTLY a status glyph — Mission/Notes cells also
      // contain glyphs (e.g. "P0 🟡"), so match the standalone cell, not `includes`.
      const status = cells.find((c) => /^[🟡✅⬜🅓]$/u.test(c)) || ''
      return { row: id, status }
    }
  }
  return null
}

// Syndcast-specific generated outputs — fed into P4 isGenerated(path, extraGlobs)
// so a contested generated file is flagged "regenerate, don't merge" in syndcast.
export const generatedGlobs = () => [
  '**/payload-types.ts',
  '**/importMap.js',
  'syndcast-mind/map/index.md',
  'syndcast-mind/visuals/app/src/gallery/manifest.json',
]
