# SAGE — the Old Wise One

**S**ession **A**wareness & **G**uidance **E**ngine: a passive, read-only **fleet judge** for
running many parallel agent coding sessions (e.g. Claude Code). It does no work, spawns nothing,
edits nothing — it watches every session, holds each one's self-declared truth (time-aware), and
answers two questions cheaply:

1. **Who is doing what — and how stale is that knowledge?**
2. **Why did these branches diverge / am I about to collide with another session?**

One judge per repo. Zero dependencies, Node ≥ 18, `node --test`.

## Why — keep the human at fleet altitude

Every popular multi-agent harness scales by **removing the human**: a queen/PM agent drives
workers, replans, auto-confirms. SAGE scales by **keeping the human — at the right altitude.**

A single agent session is already a harness for thousands of sub-agents; the human can no longer
supervise *tasks*. But independent autonomous sessions still **collide** — two edit the same
config, a migration touches every collection, a shared component diverges. *That* arbitration is
the irreducible human moment, and it's the real time sink.

SAGE is a passive advisor at the **fleet layer**, not the task layer. It never spawns, never
drives, never types into a pane (unless you opt in). It makes human-as-orchestrator **tractable at
scale** — human-in-the-loop at the *fleet* altitude. That inversion is the project's reason to
exist.

## Core vs adapter

| | **Core** (project-agnostic) | **Adapter** (per-project, optional) |
|---|---|---|
| Reads | git (worktree/branch/HEAD/`diff --numstat`), tmux, the session registry, a generic handoff sidecar | your repo's backlog rows, program/phase notes, architectural-zone glob ownership |
| Gives | `board`, liveness, `territory`, `why-diverged`, `merge-brief` | named rows/zones in all of the above |
| If absent | always present | core still fully works — warnings reference *paths*, not named rows/zones |

A repo with **no adapter is first-class.** Write one (see [`ADAPTERS.md`](./ADAPTERS.md)) only when
you want named work and zones.

## Install

```bash
node install.mjs        # wires into ~/.claude — installs DISABLED; you opt in
sage on                 # globally enable judging (default OFF)
```

`install.mjs` is conservative: it seeds a **disabled** config (never overwrites an existing one),
symlinks the emitter hook (backing up any real-file collision), and merges its lifecycle hooks into
`~/.claude/settings.json` with a one-time `.bak`, **skip-if-present**, and an **abort** (never an
overwrite) on malformed JSON. It never auto-enables.

## Use

```bash
sage board              # who's live, on what branch, how stale, what they touch
sage fleet              # one-line fleet summary (fold into a status tick)
sage territory 'src/**' # before you start: does another session already claim this?
sage why-diverged f.ts  # per-session intent + cross-branch diff for one file
sage merge-brief        # all contested paths + the regenerate-don't-merge rule
sage doctor             # validate dirs / hook / settings wiring / current repo
sage off                # freeze judging
```

## Sessions as participants — the flywheel

The verbs above have **two audiences**. The **human** reads `board` / `fleet` at fleet
altitude. But the payoff — many sessions adding features in parallel and merging smoothly —
only lands when the **sessions themselves** coordinate: each one runs `territory` + `claim`
when it starts, and `merge-brief` + `why-diverged` before it opens a PR or resolves a conflict.

That protocol ships as a Claude Code skill, [`skills/sage-fleet`](./skills/sage-fleet/SKILL.md):

- `install.mjs` symlinks it into `~/.claude/skills/sage-fleet` (opt out with `SAGE_SKIP_SKILL=1`).
- Paste [`templates/CLAUDE.snippet.md`](./templates/CLAUDE.snippet.md) — a single always-loaded
  pointer line — into your repo or user `CLAUDE.md` so sessions reach for the skill at the right
  moments. The protocol stays in the on-demand skill, so a disabled SAGE costs ~nothing.

It is **advisory**: the skill runs the verbs and surfaces collisions; it never blocks and never
decides — that's the guard's job (opt-in) and the human's call. SAGE off ⇒ the skill is a no-op.

## Safety

The emitter (`hooks/sage-emit.mjs`) fires on **every** session, so it's built to be invisible:

- **Fail-open.** All work is inside a `try/catch`; any error → `exit 0`. It never blocks or slows a
  hook.
- **Default-OFF.** No `~/.claude/sage/config.json` ⇒ disabled. The enable check is the first line —
  an instant no-op when off.
- **Non-clobbering installer.** Backs up, skips-if-present, aborts on malformed `settings.json`.

### The guard (the one thing that can act) — built, default OFF

Optionally, SAGE can **block** an edit to a contested path (`PreToolUse` → `exit 2`). It's gated by
**two** independent flags, both default off: `sage on` **and** per-repo `sage guard on`. Three
invariants keep it safe to ship: **fail-open** (any error → allow), **default-off** (nothing blocks
until you arm it), **hot-path-cheap** (no guard armed anywhere ⇒ the hook short-circuits on a single
breadcrumb check, before any git spawn). See [`CONVENTIONS.md`](./CONVENTIONS.md).

## Optional integrations

- **token-forecast** — if you run a token-forecast system, add
  `"tokenForecastPath": "~/.local/share/token-forecast"` to `~/.claude/sage/config.json` to surface
  it in `sage doctor`. Unset ⇒ the check stays green and says "not configured".
- **tmux fleet pane** — `install.mjs` offers a `bind j` → `display-popup` running `sage board`
  (run `tmux source-file ~/.tmux.conf` to apply).

## Portability notes

- Handoff sidecars are prefixed by the **repo basename** — no project literal in any path.
- Glob dialect is `*` and `?` only; `[ ] { }` are **literal** (no brace expansion) — so dynamic-route
  paths like `[channelSlug]` match themselves.
- On **macOS** (`/proc` absent), `sage claim` needs `SAGE_SELF_SID` set to the session id, since it
  can't pid-walk to find its own record.

## Layout

```
bin/sage            CLI (argv dispatch, async adapter load)
lib/*.mjs           pure, unit-tested logic (zero deps)
hooks/sage-emit.mjs the one hook entry (fail-open, default-OFF)
adapters/           reference adapters (e.g. syndcast.mjs) — out of the observed tree
install.mjs         conservative wiring into ~/.claude
test/*.test.mjs     node --test, hermetic (temp HOME, temp git repos)
```

`CONVENTIONS.md` — the controller's side of the contract (worktree-at-go, the guard).
`ADAPTERS.md` — write a per-project adapter. `LICENSE` — MIT.
