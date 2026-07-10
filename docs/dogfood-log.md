# SAGE dogfood log

Go-live: 2026-07 (dogfood-hardening round; spec: docs/superpowers/specs/2026-07-10-dogfood-hardening-design.md, gitignored).
Fill the friction table as you hit things. One week live → next round (war-room dashboard) gets specced against this log.

## Go-live runbook (run each step yourself, in order)

1. Preflight, sandboxed (no real state touched):
   `npm test` → `# fail 0`, then `node scripts/verify-fleet.mjs` → all ✓.
2. Wire both harnesses, agent-home storage:
   `sage init --global --harness both --storage agent-home`
3. Enable: `sage on`
4. Health: `sage doctor` → all ✓ (incl. the new `grok wiring` row).
5. Settle the print-mode question empirically:
   `SAGE_E2E_LIVE=1 node --test test/e2e-live.test.mjs`
   - Prints `VERDICT: print-mode hooks FIRE` → armory children are visible; done.
   - Prints `VERDICT: ... did NOT fire` → record it below; the armory launcher
     needs a SessionStart/SessionEnd shim (invoke the emitter directly around
     the child; lives in ~/Repositories/llm-armory, not here).
6. Paste the pointer snippets so sessions load the sage-fleet skill:
   - `templates/CLAUDE.snippet.md` → your user/global CLAUDE.md
   - `templates/GROK.snippet.md` → your user/global AGENTS.md
7. Open a second terminal in any repo, run `sage board` from the first — you
   should see both sessions. Optionally `sage board --json | jq .` for the
   machine view.

## Verdicts

| Date | Question | Verdict | Evidence |
|---|---|---|---|
| 2026-07-10 | worktree children share repo id | YES (test: e2e-fleet worktree regression) | git-common-dir resolution |
| 2026-07-10 | active_sessions.json usable | NO — always `[]`; registry treats as optional fallback | live probe |
| 2026-07-10 | grok -p fires hooks | **YES** — no live-smoke run needed; settled by real board | armory executor children `019f4d2e` (plan-015-json), `019f4d34` (plan-016-live-smoke), `019f4cc6` (research child) present on `sage board` with their worktree branches + touched globs. SessionStart + PostToolUse confirmed firing under `grok -p`; source `new` |

Follow-up on grok -p: executor children land as `stalled`, not `closed` — SessionEnd
may not fire under `grok -p` (or liveness derivation ranks a pid-dead grok session
`stalled` before `closed`). Not blocking; note for a future SessionEnd-under-print check.

## Friction log

| Date | Session/harness | Friction | Severity | Idea |
|---|---|---|---|---|
| 2026-07-10 | claude / board | 41 records, most `dead`/`closed` from months of `/clear` — board is noisy | med | FIXED (plan 017, `6e95edb`): `sage prune [--days N] [--yes]`. Dry-run reports 31 prunable on the real board |
| 2026-07-10 | claude / board --json | one record has no `session_id` → a naive JSON consumer crashes on `.session_id` (renderBoard tolerates it; the machine layer does not) | med — matters for Hermes | FIXED (plan 017, `6e95edb`): emitter stamps session_id on every event; collectSessions backfills from filename. Live id-less count 3→0 |
