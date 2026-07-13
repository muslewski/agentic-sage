# Setting up SAGE

<p align="center">
  <picture>
    <source srcset="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-setup.avif" type="image/avif">
    <source srcset="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-setup.webp" type="image/webp">
    <img src="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-setup.webp" alt="SAGE — Easy Setup: three steps — Install (npm install -g agentic-sage), Wire (sage init), Enable (sage on). Three simple steps to a coordinated fleet." />
  </picture>
</p>

A linear walkthrough from clone to a coordinating fleet. Three required steps; everything else is
**optional** and badged. The last section, **[How we run it](#how-we-run-it-dogfood)**, is the exact
config we use ourselves — copy it for a proven setup.

> SAGE is **read-only and default-OFF**. Installing changes nothing until you `sage on`; it never
> edits your repo, never spawns, never blocks (unless you explicitly arm the optional guard).

> **Upgrading from an older SAGE?** Nothing breaks after `npm update` — an existing
> `~/.claude/sage/` (the pre-rename state dir) keeps working in place (reads and writes) for
> config, storage, and adapter discovery, so no re-init is required. Run `sage init` or
> `sage init --repair` when convenient to perform the one-time, non-destructive rename to
> `~/.claude/agentic-sage/` (never clobbers; if both exist, the new dir wins and a warning
> prints).

> **Want your agent to do this?** Clone the repo, then tell your coding agent (Grok or Claude) *"set up agentic-sage
> for this repo."* It follows **[`AGENTS.md`](./AGENTS.md)** (the deterministic runbook) through the
> same steps below. This page is the human path; AGENTS.md is the agent path — same destination.
> Grok reads AGENTS.md directly; it also respects CLAUDE.md via compat.

---

## Required

### 1. Install

```bash
npm install -g agentic-sage
```

Zero dependencies, Node ≥ 20. **From source instead?**
`git clone https://github.com/muslewski/agentic-sage && cd agentic-sage` — then use
`node install.mjs` in place of `sage init` below.

### 2. Wire (`~/.claude` by default, **disabled**)

```bash
sage init
```

With a TTY, `sage init` runs a **4-question interactive wizard** — scope (global vs
this-project-only), harness, storage location, and enable-now — defaulting to the safe choice at
every step (**global**, built-in storage, **OFF**). Without a TTY (CI, agents, piped) it applies
those same defaults with no prompts. Conservative and idempotent either way: seeds a **disabled**
config (never overwrites an existing one), symlinks the emitter hook, merges its lifecycle hooks
into `~/.claude/settings.json` (Grok loads these for hooks by default via [compat.claude]) — or `<repo>/.claude/settings.json` for a project-scope install
(backs it up once, skips-if-present, **aborts** on malformed JSON) — and symlinks every skill in
`skills/*` into `~/.claude/skills` (Grok scans compat + ~/.grok/skills). It never auto-enables.
Native Grok hook wiring example: see templates/ or docs for ~/.grok/hooks/*.json using emitter.

Non-interactive flags (agents, CI, scripting) — full reference in [`AGENTS.md`](./AGENTS.md):

```bash
sage init --global [--enable]
sage init --project [--path <dir>] [--storage repo-root|sibling|agent-home] [--yes] [--enable]
sage init --repair      # re-assert wiring + perform the safe legacy-state-dir rename
sage init --show        # full breakdown: scope, storage, rule matched, enablement
```

Dogfooding this repo itself? Follow the go-live runbook in `docs/dogfood-log.md`.

### 3. Enable

```bash
sage on        # globally enable judging (default OFF) — global-scope installs only
```

A **project-scope** install (`sage init --project`) ignores the global master entirely — use
`sage enable` / `sage disable` in that repo instead. `sage where` shows which one applies to the
current repo.

Add `agentic-sage/bin` to your `PATH`, or call `node /path/to/agentic-sage/bin/sage`.

**Verify any time** with the slash command (see [step 4](#4-wire-sessions-in-recommended)) or the CLI:

```bash
sage doctor    # ✓/✗ per check + an `N ok · M need attention` verdict
```

A failed check prints a `→ run: …` remedy line — the exact command to fix it (often
`sage init --repair`, which re-asserts the wiring and performs the safe legacy-state-dir rename
described above).

---

## Recommended

### 4. Wire sessions in

The payoff — many sessions merging smoothly — lands when the **sessions themselves** coordinate.
Paste [`templates/CLAUDE.snippet.md`](./templates/CLAUDE.snippet.md) (one always-loaded pointer
line) into your repo or user `CLAUDE.md` (works for Grok too via compat) so sessions reach for the on-demand `sage-fleet` skill at
the right moments (work-start, before a PR, on a conflict). The protocol stays in the skill, so a
disabled SAGE costs ~nothing. For Grok-native rules, use templates/GROK.snippet.md in AGENTS.md. Grok natively discovers AGENTS.md and .grok/ .

Then validate the whole wiring from inside a Claude Code session:

```
/sage-doctor
```

From Grok: run `sage doctor` (CLI or via skill invocation); it reports the same.

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
sage guard on                       # arm it for this repo
# also needs judging on: `sage on` (global) or `sage enable` (project scope)
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

It removes SAGE's wiring **surgically** — only its own `agentic-sage-emit`/legacy `sage-emit` hook
entries + symlinks + the tmux `bind j` line; **every foreign hook/setting is left intact**
(settings.json is backed up first). It **keeps** your `~/.claude/agentic-sage/` (or legacy
`~/.claude/sage/`) state (config + session history) and prints the exact `rm -rf` for a manual
delete — never automatic. Details + the safety guarantees: [`uninstall/`](./uninstall/README.md).

---

## How we run it (an example setup)

This is *one adopter's* config — the setup behind the SAGE repo's own development (~8 parallel Claude
Code sessions on one codebase). It's an **example to copy or adapt**, not a requirement; the universal
core needs none of it. Following the steps above reproduces it:

| Piece | State | Why |
|---|---|---|
| `sage on` | **on** | judging active across all sessions |
| `sage-fleet` pointer in `CLAUDE.md` / `AGENTS.md` | **on** | every session coordinates at work-start / PR / conflict (Grok loads AGENTS.md natively) |
| Project adapter | **present** | named backlog rows + architectural zones |
| Backlog coordination (`backlogRows`) | **on** | 8 sessions don't double-claim a row |
| tmux `bind j` fleet pane | **on** | glance at the live board without leaving the editor |
| Statusline segment | **on** | see when a session is consulting SAGE |
| Guard | **OFF** | we coordinate advisorily; blocking is reserved for genuinely hot paths |

`/sage-doctor` is the one command we run to confirm a new machine or session is wired the same way.
