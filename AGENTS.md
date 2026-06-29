# AGENTS.md — setting up SAGE (for the agent doing it)

You're reading this because someone cloned **agentic-sage** and asked you (an AI coding agent) to
**set it up for their repo**. This file is the runbook. It works *before* anything is installed —
follow it top to bottom. The human-facing version is [`SETUP.md`](./SETUP.md); the deep reference is
[`README.md`](./README.md).

## What SAGE is (30 seconds)

A **passive, read-only fleet judge** for running many parallel agent coding sessions: it watches
every session, holds each one's self-declared truth, and answers *who is doing what* + *am I about to
collide with another session*. It does no work, spawns nothing, **edits nothing**.

**The one boundary you must respect when setting up:**

- **Universal core** — works on *any* repo, **zero config**. The `sage` CLI, the emitter hook, the
  board/territory/guard/backlog machinery. The user gets value from just install + `sage on`.
- **Optional, per-project** — an **adapter** that teaches SAGE the user's vocabulary (their backlog
  rows, architectural zones). A repo with **no adapter is first-class**. Don't force one.

**Safety facts (true regardless of what you wire):** SAGE is **default-OFF** (nothing runs until
`sage on`); the emitter is **fail-open** (any error → it allows the action, never blocks/slows a
hook); all state lives under `~/.claude/sage/`, **never in the user's repo tree**.

## Setup procedure

Run these in order. Tell the user what each step does; stop and ask if anything is ambiguous.

1. **Check Node ≥ 18** — `node --version`. SAGE is zero-dependency; nothing to build.
2. **Install (wires into `~/.claude`, DISABLED)** — `node install.mjs`. It is conservative: seeds a
   **disabled** config (never overwrites an existing one), symlinks the emitter hook, **merges** its
   lifecycle hooks into `~/.claude/settings.json` (backs it up once, skips-if-present, **aborts** on
   malformed JSON — never clobbers), and symlinks every skill in `skills/*`. It **never auto-enables**.
3. **Enable** — `sage on` (or edit `~/.claude/sage/config.json` → `{"enabled": true}`). Default is OFF.
   Make sure `bin/sage` is on `PATH`, or call `node <repo>/bin/sage`.
4. **Wire sessions in** — paste the one-line pointer from
   [`templates/CLAUDE.snippet.md`](./templates/CLAUDE.snippet.md) into the user's repo or user
   `CLAUDE.md`. It makes sessions reach for the on-demand `sage-fleet` skill at the right moments
   (work-start, before a PR, on a conflict). The protocol stays in the skill, so a disabled SAGE
   costs ~nothing.
5. **Offer a project adapter (optional).** A repo with no adapter is fine. If the user wants named
   work/zones, scaffold one:
   - `sage adapter init` — stamps `.sage/adapter.mjs` from `adapters/template.mjs` (won't overwrite).
   - Then **help fill the stubs** from what you can see in their repo: do they have a backlog/worklog
     file? architectural-zone docs? generated outputs (lockfiles, codegen)? Wire `backlogRows` /
     `ownsZone` / `generatedGlobs` accordingly. The worked reference is
     [`adapters/syndcast.mjs`](./adapters/syndcast.mjs); the contract is [`ADAPTERS.md`](./ADAPTERS.md).
   - Don't invent logic you can't verify — leave a stub as a no-op `null`/`[]` rather than guess.
6. **Verify** — run `/sage-doctor` (if you're a Claude Code session) or `sage doctor`. It checks the
   config, emitter hook, settings wiring, linked skills, current repo, and **project adapter**
   (present / none — none is healthy), ending with an `N ok · M need attention` verdict.
7. **Report** to the user: what you wired, what stayed optional, and the one command to undo it
   (`node uninstall/uninstall.mjs`).

## Options menu (all optional — offer, don't impose)

| Option | Command | What it does |
|---|---|---|
| tmux fleet pane | `tmux source-file ~/.tmux.conf` (install added `bind j`) | a `display-popup` running `sage board` |
| Statusline segment | wire `templates/statusline.snippet.md` into your statusline | shows `⚖️ Asking Sage` only while a session consults SAGE |
| The guard (can BLOCK) | `sage guard add <path>` then `sage guard on` | `exit 2`-blocks edits to contested paths; **two flags, both default-off** |

## Do NOT

- **Do not arm the guard** (`sage guard on`) unless the user explicitly asks — it is the only thing
  that can block an edit. Default-off is the safe state.
- **Do not touch the user's other hooks or settings.** `install.mjs` merges; never hand-edit
  `settings.json` to remove foreign entries.
- **Do not commit `.sage/adapter.mjs`** unless the user wants it versioned. It's committable by design
  (discovery slot 1), but that's their call — they may prefer it out-of-tree
  (`~/.claude/sage/repos/<id>/adapter.mjs`).
- **Do not `sage on` silently** — enabling starts judging across *all* the user's repos; confirm.

## Uninstall

Fully reversible: `node uninstall/uninstall.mjs` removes SAGE's wiring **surgically** (only its own
hook entries + symlinks, foreign config untouched) and **keeps** `~/.claude/sage/` state for a manual
delete. See [`uninstall/README.md`](./uninstall/README.md) — and confirm with the user before any
`rm -rf` of their state.
