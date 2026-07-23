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

## Fleet context (when configured)

- **token-oracle** — optional account/window gauges often come from a local forecast feed. Point SAGE’s `tokenForecastPath` (in config) at the oracle snapshot path when you run oracle on the same machine; SAGE still only **reads** (fail-open).
- **status-herald** — curtain cards and tmux/Claude bars are the visual “stage”; herald may consume shared agent-status conventions while SAGE remains the **judge**, not the bar renderer. Compact/COMPACTING interop: [interop-status-herald.md](../interop-status-herald.md).

SAGE does not replace either tool. See [Works with](../works-with.md).
