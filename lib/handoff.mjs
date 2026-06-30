// Generic handoff sidecar (sage.handoff/1): structured session truth so SAGE
// never NLP-parses the human-facing /handoff markdown. Two producers — the
// manual /handoff skill and the PreCompact auto-dump (autoDump, below). Every
// reader is defensive (absent/malformed → null/skip) so a stale or partial
// sidecar never throws in the fleet judge.
import fs from 'node:fs'
import path from 'node:path'
import { atomicWriteJson, readJson } from './store.mjs'
import { gitSignals, branchOf } from './git.mjs'

export const SCHEMA = 'sage.handoff/1'

// The .json sidecar sits beside the .md (same stem). No .md suffix → append.
export const sidecarPathFor = (mdPath) =>
  mdPath.endsWith('.md') ? `${mdPath.slice(0, -3)}.json` : `${mdPath}.json`

const isEmpty = (v) =>
  v == null ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

// Stamp the schema; drop undefined/empty optionals (no `state_summary: null`
// noise, no empty `project: {}`). Core fields with real values are kept as-is.
export const buildSidecar = (core) => {
  const out = { schema: SCHEMA }
  for (const [k, v] of Object.entries(core)) {
    if (!isEmpty(v)) out[k] = v
  }
  return out
}

export const writeSidecar = (jsonPath, sidecar) => {
  atomicWriteJson(jsonPath, sidecar)
  return jsonPath
}

export const readSidecar = (jsonPath) => readJson(jsonPath)

// Newest sage.handoff/* sidecar in `dir` for a given worktree (ISO handoff_at
// compare). Tolerates unreadable/foreign files. null when none match.
export const latestSidecar = (dir, { worktree } = {}) => {
  let files = []
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch {
    return null
  }
  let best = null
  for (const f of files) {
    const s = readJson(path.join(dir, f))
    if (!s || typeof s.schema !== 'string' || !s.schema.startsWith('sage.handoff/')) continue
    if (worktree && s.worktree !== worktree) continue
    if (!best || String(s.handoff_at || '') > String(best.sidecar.handoff_at || '')) {
      best = { path: path.join(dir, f), sidecar: s }
    }
  }
  return best
}

// PreCompact lightweight dump: objective git/registry signals only (a hook has
// no conversation access — no state_summary/suggested_skills). Writes a thin
// .md note + its .json sidecar into tmpDir. `now` is epoch ms (caller's clock).
export const autoDump = ({ cwd, sessionId, pid, now, tmpDir, prefix = 'session', project }) => {
  const at = new Date(now).toISOString()
  const sig = gitSignals(cwd)
  const branch = branchOf(cwd)
  const mdPath = path.join(tmpDir, `${prefix}-handoff-${sessionId}-${now}.md`)
  const jsonPath = sidecarPathFor(mdPath)
  const md = [
    `# Auto-handoff (compaction) — ${at}`,
    '',
    'Objective snapshot written by SAGE at PreCompact (no conversation access).',
    'Run `/handoff` for a narrative handoff.',
    '',
    `- worktree: ${cwd}`,
    `- branch: ${branch ?? '(unknown)'}`,
    `- head: ${sig.head ?? '(none)'}`,
    `- dirty: ${sig.dirty}`,
    `- touched: ${sig.touched.join(', ') || '(none)'}`,
    '',
  ].join('\n')
  fs.mkdirSync(tmpDir, { recursive: true })
  fs.writeFileSync(mdPath, md)
  const sidecar = buildSidecar({
    session_id: sessionId,
    pid,
    worktree: cwd,
    branch,
    head: sig.head,
    dirty: sig.dirty,
    touched_globs: sig.touched,
    handoff_at: at,
    source: 'precompact',
    md_path: mdPath,
    project,
  })
  writeSidecar(jsonPath, sidecar)
  return { mdPath, jsonPath, sidecar }
}
