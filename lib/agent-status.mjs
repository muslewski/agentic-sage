// Read-side bridge to the Agent Status Provider convention that llm-armory
// (and any other launcher) already writes. SAGE's own truth comes from the
// harness emitter hook, which never fires for a headless `grok -p` child —
// so without this bridge a 138-child fleet is invisible on the board while
// 138 records describing it sit on disk.
//
// This is a PULL contract: nothing has to call us, we just read what is
// already there. It is deliberately lossy — a synthetic row has no branch,
// no touched_globs, and no claim. It answers "who is live and under whom",
// not "what did they change". `sage register` (lib/register.mjs) is the
// richer PUSH path; a real record for the same process always wins.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isAlive as realIsAlive } from './liveness.mjs'
import { resolveRepoId as realResolveRepoId } from './repo-id.mjs'

// Must mirror llm-armory's agent_status_dir() exactly (bin/llm:298-306).
// A divergence here means we silently read an empty directory forever, which
// looks identical to "no children running" — the worst possible failure.
export const agentStatusDir = (env = process.env) => {
  if (env.AGENT_STATUS_DIR) return env.AGENT_STATUS_DIR
  if (env.XDG_RUNTIME_DIR) return path.join(env.XDG_RUNTIME_DIR, 'agent-status')
  return path.join(env.HOME || os.homedir(), '.local', 'state', 'agent-status')
}

export const readAgentStatusRecords = ({ dir } = {}) => {
  const sessions = path.join(dir || agentStatusDir(), 'sessions')
  let files
  try {
    files = fs.readdirSync(sessions).filter((f) => f.endsWith('.json'))
  } catch {
    return [] // no provider dir = no launchers ran = clean no-op
  }
  const out = []
  for (const f of files) {
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(sessions, f), 'utf8'))
      if (rec && typeof rec === 'object') out.push({ ...rec, _file: f })
    } catch {
      /* half-written or corrupt — skip, never throw */
    }
  }
  return out
}

const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null)

export const toSyntheticSession = (
  rec,
  { now = Date.now(), repoId, isAlive = realIsAlive, repoIdOf = realResolveRepoId } = {},
) => {
  if (!rec || !Number.isFinite(rec.pid)) return null
  // TTL is the lease. A launcher that is SIGKILLed leaves its record behind
  // forever; without expiry the board grows ghosts that look live.
  const ttl = Number.isFinite(rec.ttl_ms) ? rec.ttl_ms : 12 * 3600_000
  const stamp = Number.isFinite(rec.updated_at) ? rec.updated_at : rec.started_at
  if (Number.isFinite(stamp) && now - stamp > ttl) return null
  // Scope to the caller's repo. The record carries a cwd, not a repo id, so
  // resolve it the same way the emitter does — worktrees fold to their main
  // repo id (lib/repo-id.mjs:24-32), which is what we want.
  if (repoId) {
    let recRepo = null
    try {
      recRepo = repoIdOf(rec.worktree || rec.cwd)
    } catch {
      recRepo = null
    }
    if (recRepo !== repoId) return null
  }
  const alive = isAlive(rec.pid)
  const key = rec._file ? rec._file.replace(/\.json$/, '') : `${rec.source_cli}-pid${rec.pid}`
  return {
    session_id: `armory:${key}`,
    synthetic: true, // consumers must be able to tell a lossy row from a real one
    repo_id: repoId ?? null,
    worktree: rec.worktree || rec.cwd || null,
    pid: rec.pid,
    alive,
    liveness: alive ? 'working' : 'dead',
    status: alive ? 'active' : 'closed',
    link_state: 'scoping',
    managed_by: 'nested',
    parent_sid: rec.parent_session || undefined,
    agent_kind: rec.source_cli || 'unknown',
    registered_by: rec.written_by || 'unknown',
    model: rec.model,
    effort: rec.effort,
    preset: rec.preset,
    lane: rec.lane,
    fleet_run: rec.fleet_run,
    corr: rec.corr,
    opened_at: iso(rec.started_at),
    updated_at: iso(stamp),
    touched_globs: [],
    handoff_bucket: 'none',
    handoff_age: '—',
  }
}

export const collectSyntheticSessions = (home, repoId, now = Date.now(), { dir } = {}) => {
  const out = []
  for (const rec of readAgentStatusRecords({ dir })) {
    const s = toSyntheticSession(rec, { now, repoId })
    if (s) out.push(s)
  }
  return out
}
