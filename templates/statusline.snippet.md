<!-- SAGE statusline segment — wire into your existing statusline when you activate SAGE.
     Shows the configured label only while THIS session is consulting SAGE. Optional.
     Works for Claude (statusline JSON pipe + CLAUDE_SESSION_ID) and Grok (use env or
     explicit call; no identical statusline JSON pipe, prefer CLI verbs or tmux). -->

## Option A — call the verb (any statusline, any language/agent)

Append the verb's output to your statusline; pass the session id + cwd you already have:

```bash
sage statusline --session "$SESSION_ID" --cwd "$PWD"
# prints "⚖️ Asking Sage" while fresh, else nothing (fail-open, exit 0)
# For Grok sessions: --session "$GROK_SESSION_ID"
```

## Option B — in-process stat (zero extra spawn; e.g. a Python statusline)

The breadcrumb is under the resolved SAGE home (default `~/.claude/agentic-sage/asking/<session_id>`, mtime = last consult). No repoId needed. Claude pipes JSON with session_id; Grok users read env directly.

```python
import os, time, json, sys
sid = ""
try:
    data = json.load(sys.stdin)             # Claude statusline payload (if present)
    sid = data.get("session_id", "") or data.get("sessionId", "")
except Exception:
    pass
sid = sid or os.environ.get("CLAUDE_SESSION_ID") or os.environ.get("GROK_SESSION_ID")
f = os.path.expanduser(f"~/.claude/agentic-sage/asking/{sid}")
seg = ""
try:
    if sid and time.time() - os.stat(f).st_mtime < 8:   # 8s ≈ statuslineTtlMs default
        seg = "⚖️ Asking Sage"
except OSError:
    pass
# … append `seg` (when non-empty) to whatever your statusline already prints …
```

Configure the label/TTL in `~/.claude/agentic-sage/config.json` (or legacy):
`{ "statuslineLabel": "⚖️ Asking Sage", "statuslineTtlMs": 8000 }`.

For Grok TUI bottom/status: use `sage fleet` in a status tick, or tmux (see below). The `bind j` popup works regardless of agent.
