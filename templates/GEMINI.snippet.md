<!-- agentic-sage — optional GEMINI.md / project pointer.
     Skills: sage-fleet, sage-judge, sage-doctor (install via gemini skills install).
     CLI: npm i -g agentic-sage && sage on -->

**Parallel sessions** — other agent sessions may run on this host. Before claiming
work or opening a PR, use the `sage-fleet` skill (or `sage` CLI) to coordinate
(collision check → claim → merge-brief → why-diverged). SAGE off or absent ⇒ silent no-op.

Install skills for Gemini CLI:

```bash
gemini skills install https://github.com/muslewski/agentic-sage.git --path skills --consent
# or: npx skills add muslewski/agentic-sage --skill sage-fleet -g
npm install -g agentic-sage && sage on
```
