---
title: "Statusline segment"
description: "Optional SAGE statusline segment for Claude Code / tmux consumers."
section: recipes
order: 30
---

# Statusline segment

Optional. SAGE can emit a compact segment for statuslines that already show context and cost.

```bash
sage statusline --help
# install path is documented in SETUP recommended section
```

Deep checklist: [`SETUP.md`](../../SETUP.md) → Recommended / Optional.

Sibling consumers (e.g. status-herald) may read agent-status / forecast files; SAGE stays the judge, not the bar framework.
