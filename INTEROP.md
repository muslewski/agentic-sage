# SAGE interop — launcher registration (contract C4)

SAGE is a **passive observer**. It never requires a launcher, and a launcher
must never require SAGE. When both are present, a child session becomes visible
on `sage board` / `sage fleet` / `sage war` through two independent paths.

## Two paths — pull first, then push

| Path | Who writes | What you get | When to use |
|---|---|---|---|
| **Pull** (Agent Status Provider) | the launcher already (e.g. llm-armory writes `<agent-status>/sessions/*.json`) | synthetic rows: pid, cwd, model, liveness. **No** branch, `touched_globs`, or claims. | Zero cooperation. Works today for any tool that follows the Agent Status Provider convention. |
| **Push** (`sage register`) | the launcher calls the CLI | a real session record with a real sid, lane, parent, corr, optional git enrich | When you want the child on the collision surface and rollup by lane. |

**Precedence:** if a real sage record and a synthetic row describe the **same
pid**, the real record wins and the synthetic is dropped entirely. Never merge
fields between them — a synthetic row's empty `touched_globs` means *unknown*,
not *touched nothing*.

## Agent Status Provider directory (pull)

Resolved in order (must match llm-armory):

1. `$AGENT_STATUS_DIR`
2. `$XDG_RUNTIME_DIR/agent-status`
3. `$HOME/.local/state/agent-status`

Sessions live in `<dir>/sessions/*.json`. SAGE reads them fail-open: missing
dir, malformed file, or permission error → no rows, never a throw.

## `sage register` CLI (push)

```
sage register --sid <id> [--pid <n>] [--cwd <path>] [--parent <sid>]
              [--kind claude|grok|codex|other] [--lane <s>] [--fleet-run <s>]
              [--corr <s>] [--by <tool-name>] [--json]
sage register heartbeat --sid <id> [--cwd <path>] [--json]
sage register close --sid <id> [--cwd <path>] [--result ok|failed|partial] [--json]
```

- `--sid` is **required**. Mint one if you have no natural id (`uuidgen`, `$$`, or a fleet correlation id).
- Everything else is optional. Unknown flags are ignored, not fatal.
- With `--json`, print one JSON object and nothing else.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | success |
| `1` | soft-fail (not a git repo, store unwritable, unknown sid on heartbeat, path refused) |
| `2` | usage / unsafe sid (missing `--sid`, path separators in sid) |

Suite convention: **0 = clean, 1 = ran and found problems, 2 = could not complete.**
Launchers that want fire-and-forget keep `|| true` (recommended pattern below).
Honest nonzero lets scripts that *do* check `$?` detect store failures.

### Recommended shell pattern

```bash
command -v sage >/dev/null && sage register --sid "$SID" --pid $$ --kind grok --by my-launcher --lane armory --json || true
# … launch child …
command -v sage >/dev/null && sage register close --sid "$SID" --result ok --json || true
```

SAGE never imports or depends on llm-armory, memory-atlas, or mossferry. Peer
absence is a clean no-op.

## Related

- Session schema fields: [`SCHEMA.md`](./SCHEMA.md) (`synthetic`, `agent_kind`, `lane`, …)
- Design decision: `agentic-sage-mind/map/decisions/2026-07-29-dual-registration.md`
