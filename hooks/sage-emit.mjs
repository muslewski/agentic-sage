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
import path from 'node:path'
import { resolveRepoId, resolveRepoRoot } from '../lib/repo-id.mjs'
import { isGloballyEnabled, isEnabled } from '../lib/enabled.mjs'
import { readRecord, mergeRecord, appendEvent } from '../lib/store.mjs'
import { gitSignals, branchOf } from '../lib/git.mjs'
import { autoDump } from '../lib/handoff.mjs'
import { pidForSession } from '../lib/registry.mjs'
import { isAlive } from '../lib/liveness.mjs'
import { collectSessions } from '../lib/board.mjs'
import { fleetLine } from '../lib/fleet.mjs'
import {
  guardsActive,
  readGuard,
  targetPath,
  relForRepo,
  shouldBlock,
  blockMessage,
} from '../lib/guard.mjs'

const POST_TOOL_THROTTLE_MS = 30000

const main = () => {
  // Never block on a TTY: a hook always pipes its payload; a TTY stdin would
  // hang readFileSync(0) until EOF. The watchdog (below) is the backstop.
  try {
    if (process.stdin.isTTY) return
  } catch {
    /* ignore */
  }

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

  // DEFAULT-OFF fast path — tier-1 check FIRST (one file read), before any git.
  if (!isGloballyEnabled(home)) return

  // HOT-PATH-CHEAP: PreToolUse fires before every tool call. With no guard armed
  // anywhere (the default), skip on a single cheap breadcrumb check — no git, no
  // per-repo read, no chance of a block.
  if (event === 'PreToolUse' && !guardsActive(home)) return

  const repoId = resolveRepoId(cwd)
  if (!repoId) return // not a git repo → nothing to judge

  // Full gate (re-confirms global + per-repo + per-session opt-out).
  if (!isEnabled({ home, repoId, cwd })) return

  const now = Date.now()
  const at = new Date(now).toISOString()

  switch (event) {
    case 'SessionStart': {
      const sig = gitSignals(cwd)
      const pid = pidForSession(home, sid)
      const prev = readRecord(home, repoId, sid)
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
        opened_at: prev?.opened_at || at, // preserve true open time across resume/clear
        updated_at: at,
      })
      appendEvent(home, repoId, {
        event: 'open',
        session_id: sid,
        source: payload.source || null,
        at,
      })
      // The one sanctioned auto-injection (design §10.3): a one-line fleet brief.
      // SessionStart-only, only when other sessions exist (never noise when solo).
      // Inside main()'s try/catch (fail-open) and behind the enable gate above;
      // core-only (no adapter load) to keep the hot path cheap. stdout on a
      // SessionStart hook is injected as session context by Claude Code.
      const brief = fleetLine(collectSessions(home, repoId, now), { selfSid: sid })
      if (brief) console.log(`sage: ${brief}`)
      break
    }

    case 'UserPromptSubmit':
      mergeRecord(home, repoId, sid, { last_prompt_at: at, liveness: 'working', updated_at: at })
      break

    case 'PostToolUse': {
      const rec = readRecord(home, repoId, sid)
      const last = rec?.last_tool_at ? Date.parse(rec.last_tool_at) : 0
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

    case 'PreCompact': {
      // Compaction is about to wipe the thread → auto-publish objective truth
      // so the human need not remember /handoff. A hook has no conversation
      // access, so the dump is git/registry signals only (no narrative).
      appendEvent(home, repoId, { event: 'precompact', session_id: sid, at })
      const prefix = path.basename(resolveRepoRoot(cwd) || cwd)
      const tmpDir = process.env.SAGE_TMPDIR || os.tmpdir()
      const { jsonPath } = autoDump({
        cwd,
        sessionId: sid,
        pid: pidForSession(home, sid),
        now,
        tmpDir,
        prefix,
      })
      mergeRecord(home, repoId, sid, { handoff_path: jsonPath, handoff_at: at, updated_at: at })
      break
    }

    case 'SessionEnd':
      mergeRecord(home, repoId, sid, {
        link_state: 'closed',
        status: 'closed',
        liveness: 'closed',
        updated_at: at,
      })
      appendEvent(home, repoId, {
        event: 'close',
        session_id: sid,
        reason: payload.reason || null,
        at,
      })
      break

    case 'PreToolUse': {
      // The ONE component that can act: block (exit 2) an edit to a contested
      // path. Gated by SAGE-on (above) AND this repo's armed guard; fail-open
      // (any throw → the trailing exit 0). Read-only — no record write on this
      // hot path; only a cheap event on an actual block.
      const guard = readGuard(home, repoId)
      if (!guard.enabled || !guard.paths.length) break
      const target = targetPath(payload.tool_name, payload.tool_input)
      if (!target) break
      const rel = relForRepo(target, resolveRepoRoot(cwd) || cwd)
      const { blocked, matched } = shouldBlock(rel, guard)
      if (blocked) {
        // Logging must never downgrade a verified block to an allow, so it gets
        // its own try. Write the reason SYNCHRONOUSLY (fs.writeSync, not the
        // buffered stderr.write) so exit(2) can't truncate it on a pipe.
        try {
          appendEvent(home, repoId, {
            event: 'guard-block',
            session_id: sid,
            path: rel,
            matched,
            at,
          })
        } catch {
          /* best-effort log; the block still fires */
        }
        fs.writeSync(2, `${blockMessage(rel, matched)}\n`)
        process.exit(2)
      }
      break
    }

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
