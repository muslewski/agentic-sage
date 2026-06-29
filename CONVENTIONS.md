# SAGE conventions

How a controller (the human, or an autopilot loop) should use SAGE so the fleet judge has
something true to judge. SAGE stays **passive** — it watches and answers; these conventions are the
*controller's* side of the contract. Everything here is opt-in: with SAGE off (the default), none
of it runs.

## Worktree-after-design (register intent at "go")

Linking ≠ worktree. A session **links** at SessionStart in the primary checkout (`link_state:
scoping`) — docs, brainstorming, and side-missions may never need a code worktree, so one is never
forced. A **worktree** is created only at the post-design **"go"** gate, as the controller's first
action *before* writing the plan:

```bash
git worktree add .claude/worktrees/<slug> -b <slug> main   # <slug> = <claimed-id>-<short-title>
sage claim 'src/feature/**' 'docs/**'                       # register intent on THIS session's record
# … then write the plan and start implementing
```

`sage claim` writes `claimed_globs` + `link_state: linked` onto the current session's record (it
finds "the current session" via `$SAGE_SELF_SID`, else by walking this process's parent pids to a
record's `pid`). This is what makes pre-emptive collision detection meaningful: from the instant
the worktree exists, `sage territory <glob>` and the SessionStart brief can warn a *new* session
that another already **claims** that path — before either has touched a file.

> Adopt this in your harness's autopilot doc (e.g. CLAUDE.md, between the design gate and "write
> plan") **when you activate SAGE**. It is deliberately *not* pre-baked into an always-loaded
> instruction file, because a step that calls a disabled tool is pure token cost every session.

## Before a PR / on a conflict (the session-facing protocol)

Claim-at-go is only the first touchpoint. The full session-facing protocol — shipped as the
`sage-fleet` skill so a session loads it on demand — adds two more:

- **Before opening a PR / finishing the branch:** `sage merge-brief` lists the contested paths
  across the fleet; `sage why-diverged <file>` shows the other session's intent per file. For a
  **generated** file, regenerate-don't-merge (re-run its generator on the merged source).
- **On a git/merge conflict:** `sage why-diverged <file>` before you resolve, so you resolve with
  the other session's intent in mind; generated file → regenerate rather than line-merge.

These stay **advisory** (the guard below is the only thing that can act). As with claim-at-go,
wire the one-line pointer (`templates/CLAUDE.snippet.md`) into your CLAUDE.md only when you
activate SAGE — the protocol itself lives in the on-demand skill, not an always-loaded file.

## The guard (the one hard stop) — built, default OFF

`sage` can *block* an edit, but only when you explicitly arm it. Two independent flags gate a
block; both default off:

```bash
sage on                       # 1. SAGE globally enabled (judging)
sage guard add src/payload.config.ts
sage guard add 'src/lib/billing/**'
sage guard on                 # 2. arm THIS repo's guard (now blocks)
sage guard list               # review the contested list + armed/disarmed
sage guard off                # disarm (back to show-only)
```

When armed, a `PreToolUse` hook blocks (`exit 2`) any `Edit`/`Write`/`MultiEdit`/`NotebookEdit`
whose target matches a contested glob, with a one-line reason on stderr. It targets *edits* only —
a `Bash`-driven write is out of scope.

### Three invariants (why the guard is safe to ship on by accident)

1. **FAIL-OPEN.** All guard logic is inside the emitter's `try/catch`; any error → `exit 0`
   (allow). The *only* non-zero exit is the explicit, post-gate, post-match `exit 2`. A broken
   guard never blocks an edit.
2. **DEFAULT-OFF.** Nothing blocks unless **both** `sage on` **and** `sage guard on` (per repo). A
   fresh install, or the normal SAGE-on-but-guard-off judging mode, never blocks.
3. **HOT-PATH-CHEAP.** `PreToolUse` fires before every tool call. With no guard armed anywhere, the
   hook short-circuits on a single breadcrumb existence check (`~/.claude/sage/guards-active`) —
   no git spawn, no per-repo read. The cost is paid only when a guard is actually armed.

## Enable / disable (full control)

- **Global:** `sage on` / `sage off` → `~/.claude/sage/config.json {enabled}`. The emitter checks
  it first-line and no-ops when off.
- **Per-repo:** `~/.claude/sage/repos/<id>/config.json {enabled:false}` to mute one repo.
- **Per-session:** `SAGE_OPT_OUT=1`, or a `.sage-ignore` file in cwd, keeps a scratch session off
  the board.
