<!-- SAGE — paste into your repo or user AGENTS.md (or .grok/rules/ files) when you
     activate SAGE. Grok natively loads AGENTS.md / Claude.md etc. One always-loaded
     pointer line; the protocol lives in the on-demand sage-fleet skill. -->

**Parallel sessions** — other agent sessions may run concurrently in this repo. Before
claiming work or opening a PR, use the `sage-fleet` skill (or run `sage` CLI verbs) to
coordinate (collision check → claim intent → merge brief → why-diverged). SAGE off or
absent ⇒ it's a silent no-op.

Grok users: `sage` on PATH or invoke via full path; status via `sage statusline --session "$GROK_SESSION_ID" --cwd "$PWD"` or `sage fleet`. Tmux pane detection works automatically (pid-based).