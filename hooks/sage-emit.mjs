#!/usr/bin/env node
// SAGE emitter — fires on EVERY Claude Code session across ALL repos.
//
// TWO NON-NEGOTIABLE INVARIANTS:
//   1. FAIL-OPEN  — any error is swallowed; the process always exit(0). A
//      broken SAGE must be invisible to the human's workflow (never block a hook).
//   2. DEFAULT-OFF — with no/false global config, isEnabled() returns false and
//      we exit before any git or fs write (the cheap no-op fast path).
//
// Reads the hook payload as JSON on stdin (Claude Code hook protocol) and writes
// this session's record + appends an event, partitioned by repo.
import fs from 'node:fs'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { resolveRepoId } from '../lib/repo-id.mjs'
import { isEnabled } from '../lib/enabled.mjs'
import { readRecord, mergeRecord, appendEvent } from '../lib/store.mjs'
import { gitSignals } from '../lib/git.mjs'
import { pidForSession } from '../lib/registry.mjs'
import { isAlive } from '../lib/liveness.mjs'

const POST_TOOL_THROTTLE_MS = 30000

const branchOf = (cwd) => {
  try {
    return execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

const main = () => {
  let raw = ''
  try {
    raw = fs.readFileSync(0, 'utf8') // fd 0 = stdin
  } catch {
    return
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return // malformed → nothing to do (still exit 0 below)
  }

  const home = os.homedir()
  const event = payload.hook_event_name
  const sid = payload.session_id
  const cwd = payload.cwd || process.cwd()
  if (!sid || !event) return

  const repoId = resolveRepoId(cwd)
  if (!repoId) return // not a git repo → nothing to judge

  if (!isEnabled({ home, repoId, cwd })) return // DEFAULT-OFF fast path

  const now = Date.now()
  const at = new Date(now).toISOString()

  switch (event) {
    case 'SessionStart': {
      const sig = gitSignals(cwd)
      const pid = pidForSession(home, sid)
      mergeRecord(home, repoId, sid, {
        session_id: sid,
        repo_id: repoId,
        worktree: cwd,
        branch: branchOf(cwd),
        head: sig.head,
        dirty: sig.dirty,
        touched_globs: sig.touched,
        pid: pid || undefined,
        alive: pid ? isAlive(pid) : true,
        link_state: 'scoping',
        source: payload.source || null,
        status: 'active',
        liveness: 'idle',
        opened_at: at,
        updated_at: at,
      })
      appendEvent(home, repoId, { event: 'open', session_id: sid, source: payload.source || null, at })
      break
    }

    case 'UserPromptSubmit':
      mergeRecord(home, repoId, sid, { last_prompt_at: at, liveness: 'working', updated_at: at })
      break

    case 'PostToolUse': {
      const rec = readRecord(home, repoId, sid)
      const last = rec && rec.last_tool_at ? Date.parse(rec.last_tool_at) : 0
      if (now - last < POST_TOOL_THROTTLE_MS) break // throttle chatter
      mergeRecord(home, repoId, sid, { last_tool_at: at, liveness: 'working', updated_at: at })
      break
    }

    case 'Stop': {
      // Fires after EVERY turn → the record is always last-turn-fresh. This is
      // what keeps fleet truth correct through an un-announced /clear (no pre-hook).
      const sig = gitSignals(cwd)
      mergeRecord(home, repoId, sid, {
        head: sig.head,
        dirty: sig.dirty,
        touched_globs: sig.touched,
        liveness: 'idle',
        updated_at: at,
      })
      appendEvent(home, repoId, { event: 'stop', session_id: sid, at })
      break
    }

    case 'PreCompact':
      // Marker only; the structured handoff dump is P2.
      appendEvent(home, repoId, { event: 'precompact', session_id: sid, at })
      break

    case 'SessionEnd':
      mergeRecord(home, repoId, sid, {
        link_state: 'closed',
        status: 'closed',
        liveness: 'closed',
        updated_at: at,
      })
      appendEvent(home, repoId, { event: 'close', session_id: sid, reason: payload.reason || null, at })
      break

    default:
      break
  }
}

try {
  main()
} catch {
  /* fail-open: never let SAGE break a hook */
}
process.exit(0)
