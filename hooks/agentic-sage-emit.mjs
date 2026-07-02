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
import { resolveRepo } from '../lib/repo-id.mjs'
import { isGloballyEnabled, isEnabled } from '../lib/enabled.mjs'
import { explainRepoDataDir, writeRegistryEntry, readRegistry, MARKER_DIR } from '../lib/roots.mjs'
import { readRecord, mergeRecord, appendEvent } from '../lib/store.mjs'
import { gitSignals, branchOf } from '../lib/git.mjs'
import { autoDump } from '../lib/handoff.mjs'
import { pidForSession } from '../lib/registry.mjs'
import { isAlive } from '../lib/liveness.mjs'
import { collectSessions } from '../lib/board.mjs'
import { fleetLine } from '../lib/fleet.mjs'
import { postToolDue, markPostTool } from '../lib/throttle.mjs'
import {
  guardsActive,
  readGuard,
  targetPath,
  relForRepo,
  shouldBlock,
  blockMessage,
} from '../lib/guard.mjs'
import { readStdinWithDeadline } from '../lib/stdin.mjs'

const POST_TOOL_THROTTLE_MS = 30000
const STDIN_DEADLINE_MS = 1500

const main = async () => {
  // Never block on a TTY: a hook always pipes its payload (a TTY would sit
  // at an interactive read). The deadline below is the real backstop for a
  // pipe whose writer never closes it — either way we exit, never hang.
  try {
    if (process.stdin.isTTY) return
  } catch {
    /* ignore */
  }
  const raw = await readStdinWithDeadline(STDIN_DEADLINE_MS)

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

  // Which install fired this hook: the GLOBAL hook (~/.claude/settings.json,
  // no flag) or a PROJECT hook (<repo>/.claude/settings.json, wired with
  // --scope=project or SAGE_SCOPE=project). Cheap — argv/env only, no fs/git —
  // so computing it ahead of the fast path below costs nothing.
  const scope =
    process.argv.includes('--scope=project') || process.env.SAGE_SCOPE === 'project'
      ? 'project'
      : 'global'

  // DEFAULT-OFF fast path — tier-1 check FIRST (one file read), before any git.
  // Global scope ONLY: a project install must work with the global master OFF
  // (init on a project implies opt-in) — see lib/enabled.mjs's scope branch.
  if (scope === 'global' && !isGloballyEnabled(home)) return

  // PostToolUse fires on EVERY tool call; ~29/30 are inside the 30s window.
  // Decide that from one stat on a flat breadcrumb BEFORE any git spawn.
  // Scope-independent — agent-home-global, cheaper than everything below.
  if (event === 'PostToolUse' && !postToolDue(home, sid, Date.now(), POST_TOOL_THROTTLE_MS)) return

  // HOT-PATH-CHEAP: PreToolUse fires before every tool call. With no guard armed
  // anywhere (the default), skip on a single cheap breadcrumb check — no git, no
  // per-repo read, no chance of a block. Scope-independent, same reason as above.
  if (event === 'PreToolUse' && !guardsActive(home)) return

  const repo = resolveRepo(cwd)
  if (!repo) return // not a git repo → nothing to judge
  const repoId = repo.id

  // Double-fire defer: a repo with BOTH a global and a project hook wired must
  // write exactly once. The global hook defers to the project hook when this
  // repo is project-scoped: the registry already says so, or the in-repo
  // marker exists. Fail TOWARD PROCESSING on any error — a swallowed
  // exception must never silently make a record vanish.
  if (scope === 'global') {
    try {
      const registry = readRegistry(home)
      const registryScope = registry.repos?.[repoId]?.scope
      const hasMarker = fs.existsSync(path.join(repo.root, MARKER_DIR, 'config.json'))
      if (registryScope === 'project' || hasMarker) return
    } catch {
      /* fail toward processing — never silently skip */
    }
  }

  // Full gate (re-confirms global + per-repo + per-session opt-out, scope-aware).
  if (!isEnabled({ home, repoId, cwd, scope })) return

  const now = Date.now()
  const at = new Date(now).toISOString()

  switch (event) {
    case 'SessionStart': {
      // Registry bootstrap (best-effort, SessionStart-only — never on a hot
      // path): index a project-scoped repo so id-only lookups elsewhere
      // (plan 007's precedence rule 2) resolve to its data dir. Runs BEFORE
      // the record write below so THIS session's own record — not just later
      // ones — lands in the resolved dir (the marker, when present): the
      // record write below re-reads the (now current) registry via
      // repoDir()/resolveRepoDataDir(). Wrapped in its own try/catch so a
      // failure here can never cost the record write that follows — on any
      // error the record still gets written, just to whatever repoDir()
      // would have resolved to anyway.
      try {
        const registry = readRegistry(home)
        if (!registry.repos?.[repoId]) {
          const explained = explainRepoDataDir({ home, mainRoot: repo.root, repoId })
          if (explained.rule === 'marker' || scope === 'project') {
            writeRegistryEntry(home, repoId, {
              dataDir: explained.dir,
              scope: explained.scope,
              mainRoot: repo.root,
            })
          }
        }
      } catch {
        /* best-effort — never let indexing break the record write */
      }

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
        trunk: sig.trunk,
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
      // Synchronous write, not a buffered stdout call: stdout on a hook is a
      // pipe, and the trailing process.exit(0) could truncate a buffered
      // write — same hardening as the guard's stderr.
      if (brief) fs.writeSync(1, `sage: ${brief}\n`)
      break
    }

    case 'UserPromptSubmit':
      mergeRecord(home, repoId, sid, { last_prompt_at: at, liveness: 'working', updated_at: at })
      break

    case 'PostToolUse': {
      // The breadcrumb gate above already applied the throttle window; the
      // record read below is only a safety net if the breadcrumb was wiped.
      const rec = readRecord(home, repoId, sid)
      const last = rec?.last_tool_at ? Date.parse(rec.last_tool_at) : 0
      if (now - last < POST_TOOL_THROTTLE_MS) break // throttle chatter
      mergeRecord(home, repoId, sid, { last_tool_at: at, liveness: 'working', updated_at: at })
      markPostTool(home, sid)
      break
    }

    case 'Stop': {
      // Fires after EVERY turn → the record is always last-turn-fresh (this is
      // what survives an un-announced /clear). Trunk is cached on the record at
      // SessionStart so each turn skips the 1-3 trunk-detection spawns.
      const prev = readRecord(home, repoId, sid)
      const sig = gitSignals(cwd, { trunk: prev?.trunk })
      mergeRecord(home, repoId, sid, {
        head: sig.head,
        dirty: sig.dirty,
        touched_globs: sig.touched,
        trunk: sig.trunk,
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
      const prefix = path.basename(repo.root)
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
      const rel = relForRepo(target, repo.root)
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
  await main()
} catch {
  /* fail-open: never let SAGE break a hook */
}
process.exit(0)
