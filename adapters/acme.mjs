// Acme SAGE adapter (reference adapter — lives in agentic-sage, NOT in
// acme's tree; symlinked to the state dir for live use). Resolves a path →
// architectural zone and a branch → backlog row by reading acme-mind/ under
// ctx.repoRoot. The CORE never names an acme path — this module owns all that
// knowledge. Read-only, zero-dep (no YAML lib; a line scanner reads owns.globs).
import fs from 'node:fs'
import path from 'node:path'
import { overlaps } from '../lib/territory.mjs'

const mindDir = (ctx) => path.join(ctx.repoRoot, 'acme-mind')

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

// Match a session's branch against a BACKLOG row's **Lands** cell only. Code
// branches appear verbatim in Lands (e.g. `fix/editor-test-type-drift`). The
// Lands column index comes from each table's header row, so a branch token in a
// Mission/Notes cell can't false-claim a row. `main`/`master` is the docs /
// primary-checkout branch — it never claims a code row.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const claimedWork = (rec, ctx) => {
  const branch = rec && rec.branch
  if (!branch || branch === 'main' || branch === 'master') return null
  const p = backlogPath(ctx)
  if (!p) return null
  let text = ''
  try {
    text = fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
  // branch as a delimited token (not a loose substring): `/`, `.`, `-` are
  // branch chars, so a boundary is any other char or a line edge.
  const tokenRe = new RegExp(`(^|[^\\w./-])${escapeRe(branch)}([^\\w./-]|$)`)
  let landsIdx = -1
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) {
      landsIdx = -1 // left the table → the Lands column no longer applies
      continue
    }
    const cells = line.split('|').map((c) => c.trim())
    const hi = cells.findIndex((c) => /^lands$/i.test(c))
    if (hi >= 0) {
      landsIdx = hi // header row → locate Lands for the rows that follow
      continue
    }
    if (landsIdx < 0 || cells.length <= landsIdx) continue
    if (/^-+$/.test(cells[1] || '')) continue // separator row
    if (tokenRe.test(cells[landsIdx])) {
      const id = cells[1] // cells[0] is '' (leading pipe)
      const status = cells.find((c) => /^[🟡✅⬜🅓]$/u.test(c)) || ''
      return { row: id, status }
    }
  }
  return null
}

// Read BACKLOG.md → the rows SAGE coordinates: the A/B/C checklist items and the
// Section-D table. Status comes from the checkbox / the Status COLUMN (not the
// first glyph on the line — the cell-scoping lesson from claimedWork). Read-only,
// zero-dep; a missing/garbage file → [] (never throws — fail-closed-to-empty).
export const backlogRows = (ctx) => {
  const p = backlogPath(ctx)
  if (!p) return []
  let text = ''
  try {
    text = fs.readFileSync(p, 'utf8')
  } catch {
    return []
  }
  const rows = []
  let cols = null // header column indices of the current table (id/status/mission/lands)
  for (const line of text.split('\n')) {
    // A/B/C checklist item: `- [x] **A5 — Mission…**` (em dash, en dash, or hyphen)
    const li = line.match(/^- \[([ xX])\]\s*\*\*([A-Za-z]\d+)\s*[—–-]\s*([^*]+)\*\*/)
    if (li) {
      const status = li[1].toLowerCase() === 'x' ? '✅' : /🟡/.test(line) ? '🟡' : '⬜'
      rows.push({ id: li[2], status, mission: li[3].trim().slice(0, 120), lands: '' })
      continue
    }
    if (!line.startsWith('|')) {
      cols = null // left the table
      continue
    }
    const cells = line.split('|').map((c) => c.trim())
    if (/^-+$/.test(cells[1] || '')) continue // separator row
    const lower = cells.map((c) => c.toLowerCase())
    const idIdx = lower.indexOf('id')
    if (idIdx >= 0) {
      cols = {
        id: idIdx,
        status: lower.indexOf('status'),
        mission: lower.indexOf('mission'),
        lands: lower.indexOf('lands'),
      }
      continue
    }
    if (!cols || cells.length <= cols.id) continue
    const id = cells[cols.id]
    if (!/^[A-Za-z]\d+$/.test(id)) continue // not a row id (blank / heading cell)
    const statusCell = cols.status >= 0 ? cells[cols.status] : ''
    rows.push({
      id,
      status: (statusCell.match(/[🟡✅⬜🅓]/u) || [''])[0],
      mission: cols.mission >= 0 ? cells[cols.mission] : '',
      lands: cols.lands >= 0 ? cells[cols.lands] : '',
    })
  }
  return rows
}

// Acme-specific generated outputs — fed into P4 isGenerated(path, extraGlobs)
// so a contested generated file is flagged "regenerate, don't merge" in acme.
export const generatedGlobs = () => [
  '**/payload-types.ts',
  '**/importMap.js',
  'acme-mind/map/index.md',
  'acme-mind/visuals/app/src/gallery/manifest.json',
]
