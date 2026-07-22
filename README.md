<p align="center">
  <picture>
    <source srcset="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-banner.avif" type="image/avif">
    <source srcset="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-banner.webp" type="image/webp">
    <img src="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-banner.webp" alt="SAGE — the fleet judge" width="900">
  </picture>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="./SETUP.md">Full setup guide</a> ·
  <a href="./ADAPTERS.md">Adapters</a> ·
  <a href="https://github.com/muslewski/agentic-sage/releases">Changelog</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agentic-sage">
    <img src="https://img.shields.io/npm/v/agentic-sage?label=npm&style=flat" alt="npm version">
  </a>
  <a href="https://github.com/muslewski/agentic-sage/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/muslewski/agentic-sage/ci.yml?label=CI&style=flat" alt="CI">
  </a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat" alt="MIT license">
  <img src="https://img.shields.io/badge/node-%3E%3D20-blue?style=flat" alt="Node >=20">
</p>

<p align="center"><img src="./assets/demo-war.gif" width="720" alt="sage war demo"></p>

---

**S**ession **A**wareness & **G**uidance **E**ngine: a passive, read-only **fleet judge** for
running many parallel agent coding sessions (Claude Code, Grok Build CLI, etc.). It does no work, spawns nothing,
edits nothing — it watches every session, holds each one's self-declared truth (time-aware), and
answers two questions cheaply:

1. **Who is doing what — and how stale is that knowledge?**
2. **Why did these branches diverge / am I about to collide with another session?**

One judge per repo. Zero dependencies, Node ≥ 20, `node --test`.

## Quickstart

```bash
npm install -g agentic-sage
sage init               # interactive wizard — 4 questions, safe defaults: global + OFF
sage on                 # opt in (skip if you enabled during the wizard)
sage doctor             # ✓/✗ per check
```

`sage init` asks **scope** (global vs this-project-only), **harness**, **storage**, and
**enable now** — defaulting to global + built-in storage + **OFF** at every step. No TTY
(CI/agents/piped)? Same defaults apply with no prompts — see `sage init --global`/`--project`
flags in [`AGENTS.md`](./AGENTS.md). Check the resolved wiring any time with `sage where`
(this repo) or `sage init --show` (full breakdown).

Then paste [`templates/CLAUDE.snippet.md`](./templates/CLAUDE.snippet.md) into your repo/user
`CLAUDE.md` (or use `templates/GROK.snippet.md` in `AGENTS.md` for Grok-native) and run **`/sage-doctor`** to verify. Full walkthrough — optional tiers + the exact
config we run ourselves — in **[`SETUP.md`](./SETUP.md)**. Grok users get the same value; native hooks via ~/.grok/hooks (or rely on Claude compat which is on by default).

**Prefer to let your agent do it?** Install, then tell your coding agent *"set up agentic-sage for this
repo."* It reads **[`AGENTS.md`](./AGENTS.md)** — the deterministic setup runbook — and walks the
install → enable → wire → (optional) adapter → verify steps for you. Fully reversible:
`node uninstall/uninstall.mjs` (see [`uninstall/`](./uninstall/README.md)).

<a id="how-it-works"></a>

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

## Universal core vs your project

SAGE has one boundary, and everything in these docs hangs off it:

| | **Universal core** (any repo, zero config) | **Your project** (optional) |
|---|---|---|
| Reads | git (worktree/branch/HEAD/`diff --numstat`), tmux, the session registry, a generic handoff sidecar | your repo's backlog rows, program/phase notes, architectural-zone glob ownership |
| Gives | `board`, liveness, `territory`, `why-diverged`, `merge-brief`, the guard | named rows/zones in all of the above |
| How | install + `sage on` — nothing else required | an **adapter** (`ownsZone`/`claimedWork`/`backlogRows`/`generatedGlobs`) + your own controller conventions |
| If absent | always present | core still fully works — warnings reference *paths*, not named rows/zones |

A repo with **no adapter is first-class.** Scaffold one with `sage adapter init` (writes
`.agentic-sage/adapter.mjs` from [`adapters/template.mjs`](./adapters/template.mjs); guide in
[`ADAPTERS.md`](./ADAPTERS.md)) only when you want named work and zones.

> **What's tailor-made vs universal.** This repo ships *one person's* setup as a worked example —
> the `adapters/acme.mjs` adapter, a backlog format, worktrees under `.claude/worktrees`, a
> [superpowers](https://github.com/obra/superpowers)-style harness, an autopilot `CLAUDE.md`. **None
> of that is required.** The universal core knows nothing about it. Treat `adapters/acme.mjs` and
> `CONVENTIONS.md` as *examples to adapt*, not steps to copy.

## Parts & options — what each piece is, and whether you need it

| Part | What it does | Universal or example | Need it? | Turn on |
|---|---|---|---|---|
| `sage` CLI + emitter hook | the judge: records sessions, answers `board`/`territory`/… | universal | **required** | `install.mjs` + `sage on` |
| `sage-fleet` skill + CLAUDE pointer | sessions coordinate themselves (claim, merge-brief, why-diverged) | universal | recommended | paste `templates/CLAUDE.snippet.md` |
| `sage-doctor` skill (`/sage-doctor`) | one-command config-validity check | universal | recommended | auto-linked by `install.mjs` |
| Adapter (`.agentic-sage/adapter.mjs`) | names *your* rows + zones on the board | your project | optional | `sage adapter init` |
| Backlog coordination | who-holds-which-row + `.md` drift, without owning the file | needs an adapter | optional | adapter's `backlogRows` + `sage backlog` |
| Worktree-at-go convention | register intent the instant a worktree exists | example (controller) | optional | adapt from `CONVENTIONS.md` |
| The guard | **blocks** edits to contested paths (`exit 2`) | universal | optional, off | `sage guard add <p>` + `sage guard on` |
| tmux fleet pane | `bind j` → popup `sage board` | universal | optional | `tmux source-file ~/.tmux.conf` |
| Statusline segment | `⚖️ Asking Sage` while consulting | universal | optional | wire `templates/statusline.snippet.md` |
| `/handoff` sidecar, token-forecast | integrations with other tooling | example/integration | optional | see SETUP.md / Optional integrations |

## What `install.mjs` wires (so you can trust it)

It merges **seven** lifecycle hooks into `~/.claude/settings.json` (back up once · skip-if-present ·
abort on malformed JSON · never auto-enable; Grok reads this by default via compat). All fire the one emitter, all **fail-open** and
**no-op while SAGE is OFF**:

| Hook event | What SAGE does on it |
|---|---|
| `SessionStart` | record/refresh this session; the one optional one-line fleet brief |
| `UserPromptSubmit` | refresh liveness/timestamp |
| `PostToolUse` | refresh liveness timestamp (throttled to ~1/30 s) |
| `Stop` | last-turn-fresh record (survives `/clear`) |
| `PreCompact` | lightweight handoff sidecar dump |
| `SessionEnd` | mark the session closed |
| `PreToolUse` | the guard — **inert** unless a guard is armed (cheap breadcrumb skip otherwise) |

Undo all of it any time: `node uninstall/uninstall.mjs` (surgical — see [`uninstall/`](./uninstall/README.md)).

## Install

### Scope vs storage — two independent axes

`sage init` sets **where the hook is wired** (scope) and **where data lives** (storage) —
independently:

|  | Global scope (default) | Project scope (`sage init --project`) |
|---|---|---|
| Hook wired into | `~/.claude/settings.json` (Grok reads via compat by default) | `<repo>/.claude/settings.json` |
| Storage default | `~/.claude/agentic-sage` | `<repo>/.agentic-sage` (or `--storage sibling\|agent-home`) |
| Master switch | `sage on` / `sage off` | ignored — a project install works even with the global master OFF |
| Per-repo switch | `sage enable` / `sage disable` | `sage enable` / `sage disable` (the *only* switch in this scope) |

Storage resolves through a precedence chain (env override → in-repo marker → registry →
global default → built-in → legacy fallback) — full order in
[`CONVENTIONS.md`](./CONVENTIONS.md). `sage where` prints the resolved scope + storage +
which rule matched for the current repo.

**Option 1 — global npm (recommended):**

```bash
npm install -g agentic-sage
sage init                    # wizard, or --global/--project — see AGENTS.md for flags
sage on                      # enable globally (default OFF)
```

**Option 2 — Claude Code marketplace:**

```
/plugin marketplace add muslewski/agentic-sage
/plugin install
```

Skills (`sage-fleet`, `sage-doctor`) are linked; no further setup needed for skill-only
use. To use the `sage` CLI verbs (`board`, `territory`, …) also run the global npm
install above.

**Option 3 — git clone (for contributors / local development):**

```bash
git clone https://github.com/muslewski/agentic-sage.git
cd agentic-sage
node install.mjs             # same as sage init --global, from source
sage on
```

> **Upgrading from an older SAGE?** Nothing breaks after `npm update` — an existing
> `~/.claude/sage/` (the pre-rename state dir) keeps working in place (reads and writes) for
> config, storage, and adapter discovery, so no re-init is required. Run `sage init` or
> `sage init --repair` when convenient to perform the one-time, non-destructive rename to
> `~/.claude/agentic-sage/` (never clobbers; if both exist, the new dir wins and a warning
> prints).

## Use

```bash
sage board [--json]     # who's live, on what branch, how stale, what they touch
sage war [--json]       # live full-screen cockpit of every session across every repo
#   (TTY interactive: ↵ enter a session (tmux jump or cd), ↑↓/j/k move, / filter, w working-only, c cd, a all, q quit)
sage fleet [--json]     # one-line fleet summary (fold into a status tick)
sage repos [--all]      # product/orphan atlas with live gauges + activity sparklines
sage territory 'src/**' # before you start: does another session already claim this?
sage why-diverged f.ts  # per-session intent + cross-branch diff for one file
sage merge-brief        # all contested paths + the regenerate-don't-merge rule
sage prune [--days N] [--yes]  # remove closed/dead sessions older than N days (default 7)
sage adapter init       # scaffold .agentic-sage/adapter.mjs (optional, for named work/zones)
sage doctor             # validate config / hook / settings / linked skills / adapter
sage where              # this repo's resolved scope + storage + which rule matched
sage off                # freeze judging (global master — see "Scope vs storage" above)
```

<p><img src="./assets/demo-board.gif" width="600" alt="sage board demo"></p>

<details><summary>▶ demo — doctor</summary>
<p><img src="./assets/demo-doctor.gif" width="600" alt="sage doctor demo"></p>
</details>

<details><summary>▶ demo — repos</summary>
<p><img src="./assets/demo-repos.gif" width="600" alt="sage repos demo"></p>
</details>

Machine-readable output (`board --json`, `fleet --json`) follows the schema-1 envelope documented in `SCHEMA.md`.

## Sessions as participants — the flywheel

The verbs above have **two audiences**. The **human** reads `board` / `fleet` at fleet
altitude. But the payoff — many sessions adding features in parallel and merging smoothly —
only lands when the **sessions themselves** coordinate: each one runs `territory` + `claim`
when it starts, and `merge-brief` + `why-diverged` before it opens a PR or resolves a conflict.

That protocol ships as a Claude Code skill, [`skills/sage-fleet`](./skills/sage-fleet/SKILL.md):

- `install.mjs` symlinks it into `~/.claude/skills/sage-fleet` (Grok discovers via compat + native ~/.grok/skills; opt out with `SAGE_SKIP_SKILL=1`).
- Paste [`templates/CLAUDE.snippet.md`](./templates/CLAUDE.snippet.md) — a single always-loaded
  pointer line — into your repo or user `CLAUDE.md` (or AGENTS.md) so sessions reach for the skill at the right
  moments. The protocol stays in the on-demand skill, so a disabled SAGE costs ~nothing. Grok natively loads AGENTS.md/CLAUDE.md equivalents.

It is **advisory**: the skill runs the verbs and surfaces collisions; it never blocks and never
decides — that's the guard's job (opt-in) and the human's call. SAGE off ⇒ the skill is a no-op.

## Coordinating the backlog (optional)

A **backlog** is a shared, human-readable *work-index* — the one file (e.g. `BACKLOG.md`) where every
parallel session finds its place and claims work, so N sessions don't all grab the same task or trip
over each other. It is the fleet's source of *what's in flight*.

SAGE helps coordinate it **without owning the file**. The backlog has two layers: the **stable** prose
(a row exists, its mission, refs) and the **volatile** truth (who holds it now, is the holder alive).
The volatile layer is what 8 sessions actually collide on — so SAGE keeps it in its **own** state
(`claimed_row` on the session record), reads your `BACKLOG.md` through the adapter, and reports each
row's live truth — **never editing the file**:

    sage backlog              # rows × live sessions: who holds what, orphaned 🟡, .md glyph drift
    sage backlog claim D11    # register THIS session's row (writes only SAGE's own state)

`sage backlog` flags **drift** between the file and reality — a row marked ⬜ that a live session holds
(`held-but-open`), or a 🟡 row whose holder has died (`orphaned`). The `.md` stays the human's
at-a-glance doc (with whatever glyphs you keep); SAGE is the live truth and flags where they disagree —
the same freshness model a frozen snapshot + a staleness chip uses. You (or the human) reconcile the
glyph; **SAGE never writes the row**, keeping the human at fleet altitude (§0).

Backlog support is **adapter-gated**: your project supplies `backlogRows(ctx)` (see `ADAPTERS.md`). With
no adapter, `sage backlog` simply says so — the core stays project-agnostic.

## Statusline segment (optional)

See when a session is *currently* taking SAGE's advice — an ephemeral status-bar segment
(default `⚖️ Asking Sage`) that shows only while a session runs a consult verb
(`territory`/`why-diverged`/`merge-brief`/`claim`/`fleet`), then disappears.

It's driven by a flat per-session breadcrumb `~/.claude/agentic-sage/asking/<session_id>` (mtime =
last consult) — keyed by the same `session_id` your statusline already receives, with **no repoId**,
so you can read it two ways (see [`templates/statusline.snippet.md`](./templates/statusline.snippet.md)):

- **the verb** — append `sage statusline --session "$ID" --cwd "$CWD"` to your statusline output;
- **in-process** — `stat ~/.claude/agentic-sage/asking/<session_id>` and render your label if
  `now - mtime < ttl` (zero extra spawn).

`sage statusline` is **fail-open** — any error prints nothing and exits 0, so it can never break your
status bar; it prints nothing when SAGE is off. Configure `statuslineLabel` / `statuslineTtlMs`
(default `⚖️ Asking Sage` / `8000`ms) in `~/.claude/agentic-sage/config.json`. The statusline is
**polled** (your `refreshInterval`), so the segment shows for a tick or two around a consult — not
sub-second.

## Safety

The emitter (`hooks/agentic-sage-emit.mjs` — legacy installs symlink `hooks/sage-emit.mjs`) fires on
**every** session, so it's built to be invisible:

- **Fail-open.** All work is inside a `try/catch`; any error → `exit 0`. It never blocks or slows a
  hook.
- **Default-OFF.** Global scope: no global config (`~/.claude/agentic-sage/config.json`; a
  legacy-only `~/.claude/sage/config.json` still counts and stays in use until migrated) ⇒
  disabled — first-line no-op. Project scope ignores the global master and uses the per-repo
  `config.json` instead (init seeds `{enabled:false}` unless `--enable`).
- **Non-clobbering installer.** Backs up, skips-if-present, aborts on malformed `settings.json`.

### The guard (the one thing that can act) — built, default OFF

Optionally, SAGE can **block** an edit to a contested path (`PreToolUse` → `exit 2`). It's gated by
**two** independent flags, both default off: judging enabled for this install (global: `sage on`;
project: `sage enable`) **and** per-repo `sage guard on`. Three invariants keep it safe to ship:
**fail-open** (any error → allow), **default-off** (nothing blocks until you arm it),
**hot-path-cheap** (no guard armed anywhere ⇒ the hook short-circuits on a single breadcrumb check,
before any git spawn). See [`CONVENTIONS.md`](./CONVENTIONS.md).

## Optional integrations

- **token-forecast** — if you run a token-forecast system, add
  `"tokenForecastPath": "~/.local/share/token-forecast"` to `~/.claude/agentic-sage/config.json` to
  surface it in `sage doctor`. Unset ⇒ the check stays green and says "not configured".
- **tmux fleet pane** — `install.mjs` offers a `bind j` → `display-popup` running `sage board`
  (run `tmux source-file ~/.tmux.conf` to apply).
- **status-herald** (sibling project: per-pane curtains/cards) — adjacent, not a dependency.
  Shared compact/hot vocabulary only; full observational contract in
  [`docs/interop-status-herald.md`](./docs/interop-status-herald.md) (see also
  [`CONVENTIONS.md`](./CONVENTIONS.md)).

## Portability notes

- Handoff sidecars are prefixed by the **repo basename** — no project literal in any path.
- Glob dialect is `*` and `?` only; `[ ] { }` are **literal** (no brace expansion) — so dynamic-route
  paths like `[channelSlug]` match themselves.
- On **macOS** (`/proc` absent), `sage claim` needs `SAGE_SELF_SID` set to the session id, since it
  can't pid-walk to find its own record.

## Layout

```
bin/sage                     CLI (argv dispatch, async adapter load)
lib/*.mjs                    pure, unit-tested logic (zero deps) — incl. roots.mjs (storage
                              resolver) and init.mjs (wizard + non-interactive flags)
hooks/agentic-sage-emit.mjs  the one hook entry (fail-open, default-OFF)
adapters/                    template.mjs (scaffold) + acme.mjs (worked example) — out of the observed tree
install.mjs                  conservative global-scope wiring into ~/.claude (equivalent to
                              `sage init --global`)
uninstall/                   surgical reversible uninstall (uninstall.mjs + README)
test/*.test.mjs              node --test, hermetic (temp HOME, temp git repos)
```

**Docs:** [`docs/`](./docs/) — product documentation hub (getting started, concepts, CLI, recipes; pilot for fleet **docs-kit**). ·
[`AGENTS.md`](./AGENTS.md) — agent setup runbook ("set it up for my repo"). ·
[`SETUP.md`](./SETUP.md) — human walkthrough (required/optional tiers). ·
[`ADAPTERS.md`](./ADAPTERS.md) — write a per-project adapter. ·
[`CONVENTIONS.md`](./CONVENTIONS.md) — an *example* controller setup (worktree-at-go, the guard). ·
[`agentic-sage-mind/`](./agentic-sage-mind/) — Atlas vault (zones, **specs**, **plans** — not public marketing docs). ·
[`uninstall/`](./uninstall/README.md) — undo it. · `LICENSE` — MIT.

## Community

- [Issues](https://github.com/muslewski/agentic-sage/issues) — bugs + feature requests
- [Discussions](https://github.com/muslewski/agentic-sage/discussions) — Q&A + ideas
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute

## Contact

SAGE is in **early, active development** — a beta. I run it daily and it works, but
expect rough edges, and expect things to change as it finds its shape.

I'm building it in the open and I'd genuinely value any feedback — a bug, a question,
a half-formed idea, or just hello. Nothing is too small.

- **Email** — <kontakt@muslewski.com>
- **GitHub** — [open an issue](https://github.com/muslewski/agentic-sage/issues) — the lightest way to reach me

— [Mateusz](https://muslewski.com)
