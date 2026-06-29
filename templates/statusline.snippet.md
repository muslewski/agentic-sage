<!-- SAGE statusline segment — wire into your existing statusline when you activate SAGE.
     Shows the configured label only while THIS session is consulting SAGE. Optional. -->

## Option A — call the verb (any statusline, any language)

Append the verb's output to your statusline; pass the session id + cwd you already have:

```bash
sage statusline --session "$SESSION_ID" --cwd "$PWD"
# prints "⚖️ Asking Sage" while fresh, else nothing (fail-open, exit 0)
```

## Option B — in-process stat (zero extra spawn; e.g. a Python statusline)

The breadcrumb is `~/.claude/sage/asking/<session_id>` (mtime = last consult). No repoId needed:

```python
import os, time, json, sys
data = json.load(sys.stdin)                 # the statusline payload Claude pipes in
sid = data.get("session_id", "")
f = os.path.expanduser(f"~/.claude/sage/asking/{sid}")
seg = ""
try:
    if time.time() - os.stat(f).st_mtime < 8:   # 8s ≈ statuslineTtlMs default
        seg = "⚖️ Asking Sage"
except OSError:
    pass
# … append `seg` (when non-empty) to whatever your statusline already prints …
```

Configure the label/TTL in `~/.claude/sage/config.json`:
`{ "statuslineLabel": "⚖️ Asking Sage", "statuslineTtlMs": 8000 }`.
