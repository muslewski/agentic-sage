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
| | grok -p fires hooks | pending step 5 | |

## Friction log

| Date | Session/harness | Friction | Severity | Idea |
|---|---|---|---|---|
| | | | | |
