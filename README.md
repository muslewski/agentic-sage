<p align="center">
  <picture>
    <source srcset="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-banner.avif" type="image/avif">
    <source srcset="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-banner.webp" type="image/webp">
    <img src="https://raw.githubusercontent.com/muslewski/agentic-sage/main/assets/sage-banner.webp" alt="SAGE — the fleet judge" width="900">
  </picture>
</p>

<p align="center">
  <a href="#happy-path">Happy path</a> ·
  <a href="#touched-vs-claimed">Touched vs claimed</a> ·
  <a href="./docs/">Docs</a> ·
  <a href="./SETUP.md">Setup</a> ·
  <a href="https://github.com/muslewski/agentic-sage/releases">Releases</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agentic-sage">
    <img src="https://img.shields.io/npm/v/agentic-sage?label=npm&style=flat" alt="npm version">
  </a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat" alt="MIT license">
  <img src="https://img.shields.io/badge/node-%3E%3D20-blue?style=flat" alt="Node >=20">
</p>

---

Several agent sessions work in one repository at once, usually in separate
worktrees. Without a shared picture of intent they overwrite each other’s
files or merge branches that silently conflict.

**SAGE** (Session Awareness & Guidance Engine) is a passive, read-only **fleet
judge**: a session can announce itself, claim the file globs it intends to
touch, and ask whether merging is safe. It does not spawn agents, edit your
tree, or lock files.

Zero npm dependencies beyond Node ≥ 20. Product docs: [`docs/`](./docs/).

## Happy path

After install and `sage on` (see [Install](#install)), declare a session, claim
a glob, look at the board, ask for a merge brief. Output below was captured
from this repo’s CLI (`node bin/sage`) with a temporary `HOME` so the store was
empty except for the demo sessions.

```bash
# Two live worker PIDs (any long-lived process is fine for demos)
sleep 7200 & PID_A=$!
sleep 7200 & PID_B=$!

sage register --sid session-a --pid "$PID_A" --lane docs --by demo --kind worker
# → sage: registered session-a on agentic-sage-0e480620

sage register --sid session-b --pid "$PID_B" --lane docs --by demo --kind worker
# → sage: registered session-b on agentic-sage-0e480620

SAGE_SELF_SID=session-a sage claim 'src/auth/**'
# → sage: claimed src/auth/** on session-a

SAGE_SELF_SID=session-b sage claim 'src/auth/**'
# → sage: claimed src/auth/** on session-b

sage board
```

```text
SAGE · agentic-sage-0e480620 · 2 sessions

● docs/onramp-pass ✎  idle
● docs/onramp-pass ✎  idle
```

One session alone claiming a path:

```text
SAGE merge-brief · agentic-sage-0e480620 · 0 contested path(s)
  no contested paths — clear to merge
```

Empty claim argv (exit 2):

```text
usage: sage claim <glob> [glob…]
```

`sage claim` has no separate `--help` verb — a lone `--help` is treated as a
glob and gets claimed. Use the usage line above.

Full install walkthrough: [`SETUP.md`](./SETUP.md) · agent runbook: [`AGENTS.md`](./AGENTS.md).

## Touched vs claimed

SAGE cares about two different facts on each live session:

| | **Touched** | **Claimed** |
|---|-------------|-------------|
| Field | `touched_globs` | `claimed_globs` |
| Meaning | Paths the checkout has dirtied (git fact) | Paths the session *intends* to own |
| Written by | hooks / `register` git enrich | `sage claim <glob…>` |

**Both count.** A merge brief that only looked at touched paths used to tell two
sessions claiming the same glob that they were clear. Claims are part of the
collision surface now.

### Pairwise: use `territory`

With two live sessions both claiming `src/auth/**`, the peer shows up as
**claimed** (self excluded):

```text
$ SAGE_SELF_SID=session-a sage territory 'src/auth/**'
SAGE territory · src/auth/**
  docs/onramp-pass   claimed  idle     src/auth/**
```

Clear path:

```text
SAGE territory · lib/unrelated/**
  clear — no other session claims or touches this
```

### Multi-party: `merge-brief`

`merge-brief` lists paths that **two or more other live sessions** have
touched or claimed (caller excluded when self is resolved). Three sessions
all claiming `src/auth/**`, run as one of them:

```text
$ SAGE_SELF_SID=sess-a sage merge-brief
SAGE merge-brief · agentic-sage-0e480620 · RISK █░░░ low · 2 contested path(s)
  node_modules  █░░░ low  ██
    contested by: docs/onramp-pass, docs/onramp-pass
  src/auth/**  █░░░ low  ██
    contested by: docs/onramp-pass, docs/onramp-pass
```

`src/auth/**` is contested **via claims**. `node_modules` appeared because
register recorded it on each session’s **touched** set (dirty checkout).

**Known limitation:** with exactly two sessions that only conflict with each
other, each caller’s `merge-brief` prints **clear to merge** (only one *other*
session remains after self is dropped). For pairwise pre-flight, trust
`territory`. Details: [Claims and territory](./docs/concepts/claims-and-territory.md).

## Live judge vs offline

Two layers stack:

| Layer | What you get | How |
|-------|----------------|-----|
| **CLI facts** (always after `sage on`) | `board`, `territory`, `merge-brief`, claims — deterministic | No extra pane |
| **Live judge** (optional) | A passive agent session publishes short narrative briefs into the same store | `sage judge run` |

**Offline is the default.** Until a judge is live (or a brief is still fresh
within grace), every answer is pure CLI fact — no narrative, no per-audience
advice. That is enough for collision awareness.

When a judge is offline and config sets `judge.desired` to `preferred`, soft
tools print a warning and still exit 0:

```text
$ sage gate
sage: live judge preferred · offline — run: sage judge run
```

Product default for `judge.desired` is **`optional`** (no offline nag). A desk
can set preferred in `~/.claude/agentic-sage/config.json`. Recipe:
[Live judge](./docs/recipes/live-judge.md).

Workers still treat CLI contested/clear as authority. Briefs layer on only when
fresh.

## Limitations

- **Coordinates; does not lock.** Claims are advisory. Only the optional
  `sage guard` (default OFF) can block an edit.
- **Unregistered sessions are invisible.** If a session never hooks in and
  never `sage register`s, the board cannot see it and cannot warn you.
- **Nested worktrees are keyed by session cwd / worktree path.** Two sessions
  that share one working directory are indistinguishable as separate checkouts.
- **`merge-brief` excludes self** — pairwise claim clashes need `territory`
  (see above).
- **Dead/closed sessions are ignored** for territory and merge-brief so history
  does not cry wolf.
- **Synthetic agent-status rows** (launcher bridge) never participate in
  collision tools — empty globs must not invent a false all-clear.

## Install

```bash
npm install -g agentic-sage
sage init               # wires hooks/skills; default OFF
sage on                 # global opt-in
sage doctor             # local validation
```

Plugin / marketplace matrix (Grok, Claude, Cursor, Codex, Gemini, skills.sh):
[docs/distribution.md](./docs/distribution.md).

Clone-from-source:

```bash
git clone https://github.com/muslewski/agentic-sage.git
cd agentic-sage
node install.mjs        # same as sage init --global from source
sage on
```

Paste [`templates/CLAUDE.snippet.md`](./templates/CLAUDE.snippet.md) (or
[`templates/GROK.snippet.md`](./templates/GROK.snippet.md)) so sessions reach for
the `sage-fleet` skill at start / before PR / on conflict.

## Docs map

| Path | For |
|------|-----|
| [`docs/`](./docs/) | Product documentation hub |
| [Getting started](./docs/getting-started.md) | Install → on → doctor |
| [Claims and territory](./docs/concepts/claims-and-territory.md) | Touched vs claimed, merge-brief rules |
| [Fleet judge](./docs/concepts/fleet-judge.md) | Why SAGE exists; default-OFF |
| [CLI reference](./docs/reference/cli.md) | Verbs and flags |
| [Safety](./docs/reference/safety.md) | Fail-open, guard, hooks |
| [Configuration](./docs/reference/configuration.md) | Scope and storage |
| [Developer logging](./docs/reference/developer-logging.md) | Opt-in local fleet-devlog |
| [`SETUP.md`](./SETUP.md) | Full human setup |
| [`AGENTS.md`](./AGENTS.md) | Agent install runbook |
| [`ADAPTERS.md`](./ADAPTERS.md) | Optional project adapter |
| [`agentic-sage-mind/`](./agentic-sage-mind/) | Architecture vault (specs/plans) |

## Safety (short)

Default **OFF**. Emitter is **fail-open**. The only path that can block an edit
is the **guard**, which needs two explicit on-switches. Full table:
[Safety](./docs/reference/safety.md).

## Community

- [Issues](https://github.com/muslewski/agentic-sage/issues)
- [Discussions](https://github.com/muslewski/agentic-sage/discussions)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

SAGE is early and changes shape. Prefer GitHub issues for bugs and questions.

License: MIT.
