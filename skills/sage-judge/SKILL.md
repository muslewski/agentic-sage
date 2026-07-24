---
name: sage-judge
description: >
  Run a dedicated live judge session for agentic-sage: watch the fleet, reason
  continuously, and publish advisory briefs. Use when the human opens a pane to
  act as fleet-altitude mind (not a coding worker). Trigger: /sage-judge,
  "be the live judge", "sage judge on".
---

# sage-judge — you are the optional live mind

SAGE core stays a **passive sensor** (board, territory, merge-brief).  
**You** are a special session that **reasons on its own** and writes continuous briefs.

Workers still get deterministic CLI facts first. When your brief is **fresh**, consult verbs append it (repo layer, then fleet layer).

## Bootstrap

```bash
# In a live SAGE-enabled session (record must exist):
sage judge on --fleet          # desk-wide altitude (recommended)
# or
sage judge on --repo           # this repo only
# if slot taken:
sage judge on --fleet --takeover
```

Confirm: `sage judge status`

## Loop (you own this — not a Node daemon)

Every ~30–60s until the human stops you:

1. **Sense**
   ```bash
   sage war --json
   sage fleet --json          # when focused on one repo
   sage merge-brief           # optional depth on hot repos
   # Optional: spot-check a pane the human cares about
   # sage about --tmux <session-name> --json
   ```
2. **Reason** (in this chat): who is live, contested paths, dual claims, compacting storms, **topic pivots** (window name / claims / branch changed since last loop). Prefer evidence from CLI/JSON over invented intent.
3. **Publish** (no model inside sage — you write the JSON).  
   **Always include `session_lines`** — one short line per live **worker** (not judges). Rebuild every cycle from war/board. If a session **pivoted topic** (new claim, window rename, branch), say so in the text (e.g. `Pivoted → payments API (was auth)`).  
   If you omit `session_lines`, the CLI auto-fills fact baselines (fingerprints only) — better than ghosts, worse than your narrative.
   ```bash
   sage judge publish <<'EOF'
   {
     "summary": "one line desk state",
     "analysis": "short multi-paragraph advisory prose",
     "confidence": "medium",
     "session_lines": [
       { "session_id": "<sid>", "tmux": "<tmux-session>", "text": "what this worker is about right now" },
       { "session_id": "<sid2>", "tmux": "<tmux2>", "text": "Pivoted → X (was Y) · watch collision with …" }
     ],
     "hotspots": [
       { "repo_id": null, "paths": ["src/foo/**"], "sessions": [], "note": "why" }
     ],
     "advice": [
       { "audience": "workers", "text": "Narrow claims on src/foo before editing" },
       { "audience": "human", "text": "Two live sessions on lib/ — reallocate or serialize" }
     ],
     "inputs": { "live": 0, "contested": 0, "sources": ["war"] }
   }
   EOF
   ```
   Fingerprints are stamped by the CLI from live records — you do not need to invent them.
4. Sleep / wait, then repeat.

## Hard rules

- **Do not** `sage claim` product globs (CLI refuses while `role=judge`).
- **Do not** `sage guard on` / arm the guard.
- **Do not** edit product trees “to help.”
- **Do not** pick winners between two live workers — advise human / suggest narrow scope (same doctrine as sage-fleet).
- **Do not** invent session intent not grounded in board/territory/merge-brief/json.
- If `sage` is missing, off, or errors → **stop gracefully** (fail-open for the fleet).

## Offline / exit

```bash
sage judge off
```

SessionEnd / crash: briefs stay attachable for a short **grace window** (~30s
after last publish) even if your process is gone — so burst publishes still
reach workers. After grace (or TTL 120s, or `judge off` stamping `stale`),
workers fall back to pure CLI. A clean `judge off` marks the brief stale
immediately.

## Check

```bash
sage judge show --fleet
sage judge show --repo
```

Workers will see layers after `sage territory` / `merge-brief` / `fleet` unless they pass `--no-brief`.
