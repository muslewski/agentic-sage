# SAGE conventions

<p align="center">
  <picture>
    <source srcset="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-conventions.avif" type="image/avif">
    <source srcset="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-conventions.webp" type="image/webp">
    <img src="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-conventions.webp" alt="SAGE — Conventions: the controller's side of the contract. Worktree after design, consult before a PR or on conflict, the optional guard, full enable/disable control. Passive by design, fail-open, default-off, hot-path-cheap." />
  </picture>
</p>

How a controller (the human, or an autopilot loop) should use SAGE so the fleet judge has
something true to judge. SAGE stays **passive** — it watches and answers; these conventions are the
*controller's* side of the contract. Everything here is opt-in: with SAGE off (the default), none
of it runs.

> **This is an example controller setup — mine, not a requirement.** The specifics below (worktrees
> under `.claude/worktrees`, a [superpowers](https://github.com/obra/superpowers)-style harness, an
> autopilot loop) are how *one* adopter drives SAGE. The universal core knows nothing about them.
> Adapt the *shape* (register intent at "go"; consult before a PR / on a conflict) to your own
> harness — don't copy the literal paths.

## Scope vs storage — two independent axes

`sage init` sets **where the hook is wired** (scope) and **where a repo's data lives** (storage)
separately — don't conflate them:

|  | **Install scope** (hook wiring) | **Storage root** (data location) |
|---|---|---|
| Global (default) | hook in `~/.claude/settings.json` | resolved via the precedence chain below; built-in default `~/.claude/agentic-sage` |
| Project (`sage init --project`) | hook in `<repo>/.claude/settings.json` | `<repo>/.agentic-sage` by default; `--storage sibling\|agent-home` for elsewhere |
| Master switch | `sage on` / `sage off` — **global scope only**; project scope ignores it | n/a |
| Per-repo switch | `sage enable` / `sage disable` — works in both scopes | n/a |

Inspect the resolved combination for the current repo with `sage where`; the full breakdown
(harness, hooks, skills, storage, enablement) with `sage init --show`.

## Storage: the precedence chain

Independent of scope above, this is the order `sage` walks to find *this repo's* `config.json` /
`sessions/` / `events.ndjson` / `guard.json` — first hit wins:

0. `$SAGE_STORAGE_ROOT` — env override (power users / tests) — names a storage **root**.
1. In-repo marker `<mainRoot>/.agentic-sage/config.json` — `storageRoot` set →
   `<storageRoot>/repos/<id>`; unset → the marker dir itself (repo-root mode). Written by
   `sage init --project`.
2. Central registry `~/.claude/agentic-sage/registry.json` → `repos[id].dataDir`.
3. Global config `defaultRoot` → `<defaultRoot>/repos/<id>`.
4. Built-in default → `~/.claude/agentic-sage/repos/<id>`.
5. Legacy fallback → `~/.claude/sage/repos/<id>` — only reached when the built-in dir (rule 4)
   has no `repos/<id>` yet AND the legacy one does. An existing legacy `repos/<id>` is then the
   repo's live data dir: it keeps receiving that repo's reads **and writes** until you migrate —
   that continued use in place is the "npm update, no re-init" guarantee. What's guaranteed:
   nothing ever *creates* the legacy root or a new `repos/<id>` under it, and nothing renames or
   migrates it except `sage init` / `init --repair` (see "Naming" below).

Every rule fails open: a corrupt marker or registry falls through to the next rule rather than
throwing, so a broken file never breaks a hook's hot path.

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

> Adopt this in your harness's autopilot doc (e.g. CLAUDE.md / AGENTS.md, between the design gate and "write
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
- **Claim your backlog row** at work-start (`sage backlog claim <row>`) and re-check `sage backlog`
  before a PR. SAGE coordinates rows by writing only its own state — it never edits the backlog file;
  the `✅`/status edit stays your normal doc change. Advisory + opt-in, like every other touchpoint.

These stay **advisory** (the guard below is the only thing that can act). As with claim-at-go,
wire the one-line pointer (`templates/CLAUDE.snippet.md` or GROK equivalent) into your CLAUDE.md / AGENTS.md only when you
activate SAGE — the protocol itself lives in the on-demand skill, not an always-loaded file.

A SAGE-on session can also surface its consults in the status bar — an opt-in `⚖️ Asking Sage`
segment that shows only while a consult verb runs (see README "Statusline segment"). Pure view of
the same advisory consults; off by default, wired into your own statusline.

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
   hook short-circuits on a single breadcrumb existence check (`~/.claude/agentic-sage/guards-active`)
   — no git spawn, no per-repo read. The cost is paid only when a guard is actually armed.

## Enable / disable (full control) — v2: opt-out always wins

Three tiers; tier 3 (opt-out) applies identically in both install scopes and beats the other two:

- **Global master** (global scope only): `sage on` / `sage off` →
  `~/.claude/agentic-sage/config.json {enabled}`. On a legacy-only install (only
  `~/.claude/sage/config.json` exists), reads *and writes* both use that legacy file in place —
  deliberately, so the two paths can never disagree — until you migrate. The emitter checks it
  first-line and no-ops when off. **A project-scope install ignores this tier entirely** — see
  the scope table above.
- **Per-repo:** `sage enable` / `sage disable` — writes `{enabled:false}` into *this repo's own*
  `config.json`, wherever the storage precedence chain resolves it. Works the same in both scopes:
  in global scope it's a per-repo opt-out of the master; in project scope, since there's no
  master, it's the repo's *only* switch (`sage init --project` defaults new installs to OFF —
  run `sage enable` to opt in).
- **Per-session opt-out (always wins):** `SAGE_OPT_OUT=1` in the environment, or a `.sage-ignore`
  file in cwd, keeps a scratch session off the board regardless of scope or the other two tiers.

## Naming: typed `sage`, on-disk `agentic-sage`

What you **type** stays short; what's **on disk** carries the full package name (the shared
`~/.claude/` tree has other tools in it):

| Surface | Name |
|---|---|
| Binary | `sage` (primary) — `agentic-sage` is also installed, as an alias to the same file |
| Skills | `sage-fleet`, `sage-doctor` |
| Env vars | `SAGE_STORAGE_ROOT`, `SAGE_OPT_OUT`, `SAGE_SELF_SID`, `SAGE_SKIP_SKILL` |
| State dir (current) | `~/.claude/agentic-sage/` |
| Emitter hook (current) | `hooks/agentic-sage-emit.mjs` |
| In-repo adapter/marker dir | `.agentic-sage/` |

### Legacy (pre-rename) — used in place until `init` / `init --repair` migrates it

| Surface | Legacy name | Handling |
|---|---|---|
| State dir | `~/.claude/sage/` | fallback used **in place** — an existing legacy `repos/<id>` keeps receiving that repo's reads and writes (precedence rule 5) until migrated; never created anew; `sage init` / `init --repair` performs the safe rename (never clobbers — both-exist ⇒ prefers the new dir and warns) |
| Global config | `~/.claude/sage/config.json` | the new path wins when present; when only the legacy config exists, reads **and writes** both use it in place (so the two paths can never disagree); when neither exists, writes create the new path |
| Emitter hook | `hooks/sage-emit.mjs` | uninstall recognizes both names; `init` / `init --repair` cleans up a stale legacy symlink |
| In-repo adapter | `<repoRoot>/.sage/adapter.mjs` | still discovered (read-alias), checked *after* `.agentic-sage/adapter.mjs` — see `ADAPTERS.md` |

No forced migration: an existing `~/.claude/sage/` install keeps working after `npm update` with
no re-init required.
