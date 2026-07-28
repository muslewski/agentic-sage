// examples/with-agentic-sage/adapter.mjs
//
// A COPY-SOURCE example: an agentic-sage adapter that reads an Atlas vault.
// This is not a dependency of either project — copy this file into
// `<repoRoot>/.agentic-sage/adapter.mjs` (or symlink it out-of-tree per
// agentic-sage's ADAPTERS.md) and adjust nothing, since vault location is
// resolved from `atlas.config.json` / structural detection, not hardcoded.
//
// Implements all five OPTIONAL exports of the sage adapter contract
// (agentic-sage `ADAPTERS.md` — "The contract"). `ctx` is always
// `{ repoRoot }`. Read-only, zero-dependency (no YAML lib, no npm deps —
// only node builtins and a `git` subprocess), and fail-closed: every export
// is wrapped so a missing vault, garbage config, or unreadable file returns
// `null`/`[]` rather than throwing. A throwing adapter would crash nothing
// on sage's side either (sage's `loadAdapter` swallows the throw) — this
// file just keeps that contract close to the surface instead of relying on
// sage's safety net.
//
// Generalizes agentic-sage's own shipped reference adapter
// (`adapters/acme.mjs`, which hardcodes a project-specific vault path) into
// something any Atlas-adopting repo can drop in unmodified.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Vault resolution (generalizes acme.mjs's hardcoded `mindDir`)
// ---------------------------------------------------------------------------

function readConfig(repoRoot) {
  try {
    const raw = fs.readFileSync(path.join(repoRoot, 'atlas.config.json'), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null // missing file or invalid JSON — the caller falls back to structural detection
  }
}

// Discover the vault by structure, not by name: the first non-hidden child
// directory containing `map/index.md` or `map/zones/` (mirrors the Atlas
// CLI's own `findVaultDir`, reimplemented here since this file must stand
// alone once copied out of this repo).
function structuralVaultDir(repoRoot) {
  let entries
  try {
    entries = fs.readdirSync(repoRoot, { withFileTypes: true })
  } catch {
    return null
  }
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !name.startsWith('.') && name !== 'node_modules')
    .sort()
  for (const name of dirs) {
    const candidate = path.join(repoRoot, name)
    if (
      fs.existsSync(path.join(candidate, 'map', 'index.md')) ||
      fs.existsSync(path.join(candidate, 'map', 'zones'))
    ) {
      return candidate
    }
  }
  return null
}

// Returns `{ disabled: true }`, `{ disabled: false, vaultDir, zonesDir }`, or
// `null` if no vault can be found at all. Never throws.
function resolveVault(ctx) {
  try {
    const repoRoot = ctx && ctx.repoRoot
    if (!repoRoot) return null
    const config = readConfig(repoRoot)
    if (config && config.enabled === false) return { disabled: true }

    let vaultDir = null
    let zonesRel = 'map/zones' // atlas.config.json's own default (lib/config.mjs DEFAULT_FOLDERS)
    if (config && typeof config.vaultDir === 'string' && config.vaultDir) {
      vaultDir = path.join(repoRoot, config.vaultDir)
      if (config.folders && typeof config.folders.zones === 'string') {
        zonesRel = config.folders.zones
      }
    }
    if (!vaultDir || !fs.existsSync(vaultDir)) {
      vaultDir = structuralVaultDir(repoRoot) // missing/unparseable config, or a stale vaultDir
    }
    if (!vaultDir) return null
    return { disabled: false, vaultDir, zonesDir: path.join(vaultDir, zonesRel) }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Glob matching — inlined, not imported (sage's `lib/territory.mjs` lives in
// sage's own tree; a copy-source adapter can't reach across repos). Mirrors
// sage's own dialect, documented in agentic-sage `ADAPTERS.md` → "Glob
// dialect": `*` and `?` are the only wildcards; `[ ] { }` are LITERAL path
// characters (no character classes, no brace expansion) — a bracketed
// route segment like `[id]` matches itself, not a regex class.
// ---------------------------------------------------------------------------

function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++
        if (glob[i + 1] === '/') {
          i++
          re += '(?:.*/)?' // `**/` → zero-or-more path segments
        } else {
          re += '.*' // trailing `**` (e.g. `src/billing/**`) → the rest of the path
        }
      } else {
        re += '[^/]*' // single `*` never crosses a `/`
      }
    } else if (c === '?') {
      re += '[^/]'
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape everything else, incl. literal [ ] { }
    }
  }
  return new RegExp(`^${re}$`)
}

const hasMagic = (s) => /[*?]/.test(s)

// glob-vs-path overlap (one-directional: `a` is a zone's owns.globs entry,
// `b` is the concrete path `ownsZone` was asked about).
function overlaps(a, b) {
  if (!hasMagic(a)) return a === b
  return globToRegExp(a).test(b)
}

// ---------------------------------------------------------------------------
// owns.globs line scanner (block-list YAML only — SPEC.md's "Zone-card
// authoring note": populated `owns.globs` lists use block style specifically
// so a zero-dependency scanner like this one can parse them without a YAML
// library):
//   owns:
//     globs:
//       - "src/foo/**"
//   <next key at 0–2 indent> → stop
// ---------------------------------------------------------------------------

function parseOwnsGlobs(text) {
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

// SPEC.md "Zone cards and anchors": entries beginning with `:(exclude)` or
// `:!` are scope-narrowing pathspecs, not ownership claims — skip them here,
// same as the existence check in this repo's own verifier does.
const isPositiveGlob = (g) => !g.startsWith(':(exclude)') && !g.startsWith(':!')

// ---------------------------------------------------------------------------
// ownsZone(path, ctx) → string | null
// ---------------------------------------------------------------------------

export const ownsZone = (p, ctx) => {
  try {
    const v = resolveVault(ctx)
    if (!v || v.disabled) return null
    let files = []
    try {
      files = fs.readdirSync(v.zonesDir).filter((f) => f.endsWith('.md'))
    } catch {
      return null
    }
    for (const f of files) {
      let globs = []
      try {
        globs = parseOwnsGlobs(fs.readFileSync(path.join(v.zonesDir, f), 'utf8'))
      } catch {
        continue
      }
      const positive = globs.filter(isPositiveGlob)
      if (positive.some((g) => overlaps(g, p))) return f.replace(/\.md$/, '')
    }
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// backlogPath(ctx) → string | null  — private convenience; sage core never
// calls this directly (per ADAPTERS.md), only claimedWork/backlogRows do.
// ---------------------------------------------------------------------------

export const backlogPath = (ctx) => {
  try {
    const v = resolveVault(ctx)
    if (!v || v.disabled) return null
    const p = path.join(v.vaultDir, 'BACKLOG.md') // fixed top-level vault file, not in `folders`
    return fs.statSync(p).isFile() ? p : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// claimedWork(rec, ctx) → { row, status } | null
// ---------------------------------------------------------------------------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const claimedWork = (rec, ctx) => {
  try {
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
        // SPEC.md's Status glyph vocabulary is exactly 🟡 ⬜ ✅ (no acme-style 🅓).
        const status = cells.find((c) => /^[🟡✅⬜]$/u.test(c)) || ''
        return { row: id, status }
      }
    }
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// backlogRows(ctx) → [{ id, status, mission, lands }]
// ---------------------------------------------------------------------------

export const backlogRows = (ctx) => {
  try {
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
      // Sequential-track checklist item: `- [x] **A5 — Mission…**`
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
        status: (statusCell.match(/[🟡✅⬜]/u) || [''])[0],
        mission: cols.mission >= 0 ? cells[cols.mission] : '',
        lands: cols.lands >= 0 ? cells[cols.lands] : '',
      })
    }
    return rows
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// generatedGlobs() → string[]
//
// No `ctx` reaches this export — sage core calls it as
// `adapter.generatedGlobs()`, zero arguments (see `bin/sage`'s
// `adapter?.generatedGlobs?.()`). So it resolves its own repo root exactly
// the way sage's own CLI resolves `ctx.repoRoot` for the very same
// invocation: `git rev-parse --show-toplevel` from the process's current
// working directory (both this adapter and sage's core run inside the same
// process, so the cwd is identical). A non-repo / no-git cwd degrades to
// `[]`, never throws.
// ---------------------------------------------------------------------------

function resolveRepoRootViaGit() {
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return out || null
  } catch {
    return null
  }
}

export const generatedGlobs = () => {
  try {
    const repoRoot = resolveRepoRootViaGit()
    if (!repoRoot) return []
    const v = resolveVault({ repoRoot })
    if (!v || v.disabled) return []
    const rel = path.relative(repoRoot, path.join(v.vaultDir, 'map', 'index.md'))
    return [rel.split(path.sep).join('/')]
  } catch {
    return []
  }
}
