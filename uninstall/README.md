# Uninstalling SAGE

<p align="center">
  <picture>
    <source srcset="../assets/sage-uninstall.avif" type="image/avif">
    <source srcset="../assets/sage-uninstall.webp" type="image/webp">
    <img src="../assets/sage-uninstall.webp" alt="SAGE — Goodbye, SAGE! Uninstall anytime; we clean up after ourselves. Removes only SAGE's own hook, symlinks, and tmux line; keeps your state, config, history, and other hooks untouched. One command, surgical, fully reversible." />
  </picture>
</p>

SAGE is built to be safe to remove. One command unwires it — **surgically**, touching only SAGE's
own artifacts and leaving everything else (your other hooks, your config) exactly as it was.

```bash
node uninstall/uninstall.mjs
```

It prints a report of exactly what it removed and what it deliberately kept.

## What it removes (signature-matched — only SAGE's own)

| Artifact | How it's identified (so nothing else is touched) |
|---|---|
| `sage-emit` hook groups in `~/.claude/settings.json` | only groups whose `command` contains `sage-emit`; every other hook/group is left byte-for-byte. settings.json is backed up to `settings.json.sage-uninstall.bak` first |
| `~/.claude/hooks/sage-emit.mjs` | only if it is a **symlink whose target is inside this repo** |
| `~/.claude/skills/sage-*` | only `sage-`-prefixed **symlinks pointing into this repo's `skills/`** (Grok compat scans these) |
| the tmux `bind j` fleet-pane line in `~/.tmux.conf` | only the exact line we appended (`# SAGE fleet pane` + the `sage board` bind); `~/.tmux.conf` is backed up first |

## What it NEVER touches

- **Your other hooks / settings.** A foreign hook on the same event, or any other key (e.g. `model`),
  survives intact. The original is preserved in the `.sage-uninstall.bak` backup.
- **Your SAGE state + config + session history** under `~/.claude/sage/`. The uninstaller **does not
  delete it** — it prints the path and the exact `rm -rf` command so *you* decide. Reinstalling later
  picks up right where you left off; deleting is always a deliberate, manual step.

## For an agent asked to "uninstall SAGE"

1. Run `node uninstall/uninstall.mjs`.
2. Show the user the printed report (what was removed · what was kept).
3. Point at the `~/.claude/sage/` state line. **Confirm with the user before running any `rm -rf`** —
   it holds their session history and config; never delete it unprompted.
4. To also stop judging immediately before/after, `sage off` (or it simply no-ops once the hook is
   gone).
