# Setting up SAGE

A linear walkthrough from clone to a coordinating fleet. Three required steps; everything else is
**optional** and badged. The last section, **[How we run it](#how-we-run-it-dogfood)**, is the exact
config we use ourselves — copy it for a proven setup.

> SAGE is **read-only and default-OFF**. Installing changes nothing until you `sage on`; it never
> edits your repo, never spawns, never blocks (unless you explicitly arm the optional guard).

> **Want your agent to do this?** Clone the repo, then tell your coding agent *"set up agentic-sage
> for this repo."* It follows **[`AGENTS.md`](./AGENTS.md)** (the deterministic runbook) through the
> same steps below. This page is the human path; AGENTS.md is the agent path — same destination.

---

## Required

### 1. Clone

```bash
git clone https://github.com/muslewski/agentic-sage && cd agentic-sage
```

Zero dependencies, Node ≥ 18. Nothing to build.

### 2. Install (wires into `~/.claude`, **disabled**)

```bash
node install.mjs
```

Conservative and idempotent: seeds a **disabled** config (never overwrites an existing one),
symlinks the emitter hook, merges its lifecycle hooks into `~/.claude/settings.json` (backs it up
once, skips-if-present, **aborts** on malformed JSON), and symlinks every skill in `skills/*` into
`~/.claude/skills`. It never auto-enables.

### 3. Enable

```bash
sage on        # globally enable judging (default OFF)
```

Add `agentic-sage/bin` to your `PATH`, or call `node /path/to/agentic-sage/bin/sage`.

**Verify any time** with the slash command (see [step 4](#4-wire-sessions-in-recommended)) or the CLI:

```bash
sage doctor    # ✓/✗ per check + an `N ok · M need attention` verdict
```

---

## Recommended

### 4. Wire sessions in

The payoff — many sessions merging smoothly — lands when the **sessions themselves** coordinate.
Paste [`templates/CLAUDE.snippet.md`](./templates/CLAUDE.snippet.md) (one always-loaded pointer
line) into your repo or user `CLAUDE.md` so sessions reach for the on-demand `sage-fleet` skill at
the right moments (work-start, before a PR, on a conflict). The protocol stays in the skill, so a
disabled SAGE costs ~nothing.

Then validate the whole wiring from inside a Claude Code session:

```
/sage-doctor
```

It runs `sage doctor` and prints the report — config, emitter hook, settings wiring, **linked
skills**, current repo. SAGE being OFF is reported as healthy, never an error.

---

## Optional

Each tier is independent — add only what you want.

### 🔧 tmux fleet pane

`install.mjs` offers a `bind j` → `display-popup` running `sage board` (the live fleet view).
Apply it with:

```bash
tmux source-file ~/.tmux.conf
```

### 📊 Statusline segment

Show `⚖️ Asking Sage` while a session is consulting SAGE. Two wiring options (verb append or
in-process `stat`) in [`templates/statusline.snippet.md`](./templates/statusline.snippet.md). It is
fail-open — any error prints nothing.

### 🛡️ The guard (the one thing that can *act*)

SAGE can optionally **block** an edit to a contested path. Gated by **two** flags, both default-off:

```bash
sage guard add 'src/contested/**'   # per-repo, name the paths
sage guard on                       # arm it for this repo  (also needs global `sage on`)
```

Fail-open, default-off, hot-path-cheap. Details: [`CONVENTIONS.md`](./CONVENTIONS.md).

### 🧩 A project adapter (named work + zones)

A repo with **no adapter is first-class** — warnings just reference paths instead of named rows /
zones. Write one when you want SAGE to read your backlog rows, program/phase notes, and
architectural-zone glob ownership. Interface + a worked example: [`ADAPTERS.md`](./ADAPTERS.md).

### 🗂️ Backlog coordination

If your adapter implements `backlogRows(ctx)`, SAGE coordinates your shared `BACKLOG.md`
**without owning the file** — it keeps the volatile "who-holds-which-row / is-it-live" truth in its
own state and flags where the `.md` glyphs drift from reality:

```bash
sage backlog              # rows × live sessions: who holds what, orphaned 🟡, .md glyph drift
sage backlog claim D11    # register THIS session's row (writes only SAGE's own state)
```

See the "Coordinating the backlog" section of the [README](./README.md#coordinating-the-backlog-optional).

---

## Uninstall

Fully reversible whenever you want:

```bash
node uninstall/uninstall.mjs
```

It removes SAGE's wiring **surgically** — only its own `sage-emit` hook entries + symlinks + the tmux
`bind j` line; **every foreign hook/setting is left intact** (settings.json is backed up first). It
**keeps** your `~/.claude/sage/` state (config + session history) and prints the exact `rm -rf` for a
manual delete — never automatic. Details + the safety guarantees: [`uninstall/`](./uninstall/README.md).

---

## How we run it (an example setup)

This is *one adopter's* config — the setup behind the SAGE repo's own development (~8 parallel Claude
Code sessions on one codebase). It's an **example to copy or adapt**, not a requirement; the universal
core needs none of it. Following the steps above reproduces it:

| Piece | State | Why |
|---|---|---|
| `sage on` | **on** | judging active across all sessions |
| `sage-fleet` pointer in `CLAUDE.md` | **on** | every session coordinates at work-start / PR / conflict |
| Project adapter | **present** | named backlog rows + architectural zones |
| Backlog coordination (`backlogRows`) | **on** | 8 sessions don't double-claim a row |
| tmux `bind j` fleet pane | **on** | glance at the live board without leaving the editor |
| Statusline segment | **on** | see when a session is consulting SAGE |
| Guard | **OFF** | we coordinate advisorily; blocking is reserved for genuinely hot paths |

`/sage-doctor` is the one command we run to confirm a new machine or session is wired the same way.
