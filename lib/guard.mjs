// The PreToolUse guard — the ONE SAGE component that can act on the world by
// blocking an edit (exit 2). It ships DEFAULT-OFF and is enforced only when both
// SAGE is globally on AND this repo's guard is armed. Pure match logic + thin
// atomic writers; the emitter wires the gate. See P7 spec §2 (invariants).
import fs from 'node:fs'
import path from 'node:path'
import { sageHome, guardConfig, guardsActiveFlag } from './paths.mjs'
import { readJson, atomicWriteJson } from './store.mjs'
import { overlaps } from './territory.mjs'

// Only file-mutating editor tools are guardable. A Bash command could write a
// file too, but parsing a shell line for targets is unreliable — out of scope.
// Includes Claude names + Grok names (search_replace for Edit/Write/MultiEdit).
export const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'search_replace'])

export const readGuard = (home, repoId) => {
  const g = readJson(guardConfig(home, repoId))
  return {
    enabled: !!(g && g.enabled === true),
    paths: Array.isArray(g?.paths) ? g.paths : [],
  }
}

// The file path a tool will edit, or null for a non-editing tool / missing input.
// Handles Grok's search_replace (toolInput may use different keys; fall back to common).
export const targetPath = (toolName, toolInput) => {
  if (!toolInput || !EDIT_TOOLS.has(toolName)) return null
  if (toolName === 'NotebookEdit') return toolInput.notebook_path || null
  // Grok search_replace typically uses { file_path, old_string, new_string } or similar
  return toolInput.file_path || toolInput.path || toolInput.target_file || null
}

// Reduce an absolute target under the repo root to a repo-relative path so the
// guard's repo-relative globs match it; pass anything else through unchanged.
export const relForRepo = (p, repoRoot) => {
  if (!repoRoot || !p.startsWith('/')) return p
  const rel = path.relative(repoRoot, p)
  return rel && !rel.startsWith('..') ? rel : p
}

// DEFAULT-OFF in the pure layer too: a disarmed guard never blocks.
export const shouldBlock = (relPath, guard) => {
  if (guard?.enabled !== true) return { blocked: false, matched: null }
  const matched = (guard.paths || []).find((g) => overlaps(g, relPath))
  return matched ? { blocked: true, matched } : { blocked: false, matched: null }
}

export const blockMessage = (relPath, matched) =>
  `sage guard: "${relPath}" is on this repo's contested list (matches "${matched}"). ` +
  `Coordinate before editing. Override: sage guard off`

export const renderGuard = (guard) => {
  const head = `SAGE guard · ${guard.enabled ? 'armed (blocks matching edits)' : 'disarmed'}`
  if (!guard.paths.length) return `${head}\n  (no contested paths — sage guard add <path>)`
  return [head, ...guard.paths.map((p) => `  • ${p}`)].join('\n')
}

// ---- writers (atomic; SAGE state only) ----

const writeGuard = (home, repoId, guard) => {
  atomicWriteJson(guardConfig(home, repoId), guard)
  return guard
}

export const addGuardPath = (home, repoId, p) => {
  const g = readGuard(home, repoId)
  if (!g.paths.includes(p)) g.paths.push(p)
  return writeGuard(home, repoId, g)
}

export const rmGuardPath = (home, repoId, p) => {
  const g = readGuard(home, repoId)
  g.paths = g.paths.filter((x) => x !== p)
  return writeGuard(home, repoId, g)
}

export const setGuardEnabled = (home, repoId, on) => {
  const g = readGuard(home, repoId)
  g.enabled = !!on
  writeGuard(home, repoId, g)
  refreshGuardsActive(home)
  return g
}

// Breadcrumb = "≥1 guard armed somewhere", recomputed from disk so a stale flag
// can't outlive the last armed guard. Lets the emitter's hot PreToolUse path
// skip all per-repo work (and the git spawn) when no guard is armed anywhere.
const anyGuardArmed = (home) => {
  let ids = []
  try {
    ids = fs.readdirSync(path.join(sageHome(home), 'repos'))
  } catch {
    return false
  }
  for (const id of ids) {
    const g = readJson(guardConfig(home, id))
    if (g && g.enabled === true) return true
  }
  return false
}

const refreshGuardsActive = (home) => {
  const flag = guardsActiveFlag(home)
  if (anyGuardArmed(home)) {
    fs.mkdirSync(sageHome(home), { recursive: true })
    try {
      fs.writeFileSync(flag, '')
    } catch {
      /* best-effort */
    }
  } else {
    try {
      fs.rmSync(flag, { force: true })
    } catch {
      /* best-effort */
    }
  }
}

export const guardsActive = (home) => {
  try {
    return fs.existsSync(guardsActiveFlag(home))
  } catch {
    return false
  }
}
