// C4 push contract: any launcher can declare a session without a harness hook
// and without stdin JSON. This is what armory (and a stranger's shell script)
// calls so a child gets a real sage record with a real sid — branch, lane,
// parent, corr — fields the agent-status pull path cannot know.
//
// Soft-fail returns { ok: false }; the CLI maps that to exit 0. Only a missing
// --sid is a programmer error (throw → exit 2). A registration failure must
// never break the launcher that called us.
import { mergeRecord, readRecord } from './store.mjs'
import { resolveRepo } from './repo-id.mjs'
import { gitSignals, branchOf } from './git.mjs'
import { startTimeOf } from './tmux.mjs'

const iso = (ms) => new Date(ms).toISOString()

const omitUndef = (obj) => {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

const resolveOrFail = (cwd) => {
  let repo = null
  try {
    repo = resolveRepo(cwd)
  } catch {
    repo = null
  }
  if (!repo) return { ok: false, reason: 'not a git repo' }
  return { ok: true, repo }
}

export const registerSession = ({
  home,
  sid,
  pid,
  cwd = process.cwd(),
  kind,
  by,
  lane,
  fleet_run,
  corr,
  parent,
  now = Date.now(),
} = {}) => {
  if (!sid || typeof sid !== 'string') throw new TypeError('registerSession: sid is required')
  const r = resolveOrFail(cwd)
  if (!r.ok) return { ok: false, sid, reason: r.reason }
  const { id: repoId, root } = r.repo
  const ts = iso(now)
  const patch = omitUndef({
    session_id: sid,
    repo_id: repoId,
    worktree: root || cwd,
    pid: Number.isFinite(pid) ? pid : undefined,
    pid_start: Number.isFinite(pid) ? startTimeOf(pid) || undefined : undefined,
    status: 'active',
    link_state: 'scoping',
    managed_by: 'nested',
    parent_sid: parent || undefined,
    agent_kind: kind || undefined,
    registered_by: by || undefined,
    lane: lane || undefined,
    fleet_run: fleet_run || undefined,
    corr: corr || undefined,
    opened_at: ts,
    updated_at: ts,
    source: 'register',
  })
  // Best-effort git enrich — a huge repo must not block the launcher.
  try {
    const g = gitSignals(cwd)
    if (g.head) patch.head = g.head
    if (g.dirty !== undefined) patch.dirty = g.dirty
    if (g.touched?.length) patch.touched_globs = g.touched
    if (g.trunk) patch.trunk = g.trunk
  } catch {
    /* ignore */
  }
  try {
    const b = branchOf(cwd)
    if (b) patch.branch = b
  } catch {
    /* ignore */
  }
  try {
    mergeRecord(home, repoId, sid, patch)
  } catch (e) {
    return { ok: false, sid, repo_id: repoId, reason: e?.message || 'store write failed' }
  }
  return { ok: true, sid, repo_id: repoId }
}

export const heartbeatSession = ({ home, sid, cwd = process.cwd(), now = Date.now() } = {}) => {
  if (!sid || typeof sid !== 'string') throw new TypeError('heartbeatSession: sid is required')
  const r = resolveOrFail(cwd)
  if (!r.ok) return { ok: false, sid, reason: r.reason }
  const { id: repoId } = r.repo
  const cur = readRecord(home, repoId, sid)
  if (!cur) return { ok: false, sid, repo_id: repoId, reason: 'no such session' }
  const ts = iso(now)
  try {
    mergeRecord(home, repoId, sid, {
      updated_at: ts,
      last_tool_at: ts,
    })
  } catch (e) {
    return { ok: false, sid, repo_id: repoId, reason: e?.message || 'store write failed' }
  }
  return { ok: true, sid, repo_id: repoId }
}

export const closeSession = ({ home, sid, cwd = process.cwd(), result, now = Date.now() } = {}) => {
  if (!sid || typeof sid !== 'string') throw new TypeError('closeSession: sid is required')
  const r = resolveOrFail(cwd)
  if (!r.ok) return { ok: false, sid, reason: r.reason }
  const { id: repoId } = r.repo
  const patch = omitUndef({
    status: 'closed',
    link_state: 'closed',
    updated_at: iso(now),
    result_class: result || undefined,
  })
  try {
    mergeRecord(home, repoId, sid, patch)
  } catch (e) {
    return { ok: false, sid, repo_id: repoId, reason: e?.message || 'store write failed' }
  }
  return { ok: true, sid, repo_id: repoId }
}
