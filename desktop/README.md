# Sage Island

Optional **desktop companion** for [agentic-sage](../README.md): a Mac-first Tauri + Svelte
**top-edge glass island** that shows live fleet sessions.

This package is **not** part of the published `agentic-sage` npm package.
`npm i -g agentic-sage` never installs this app.

## Your desk (MacBook + manjaro)

Agents and SAGE state live on **manjaro**. The island UI lives on the **MacBook**.

```
Mac Island  ──ssh BatchMode──►  manjaro: sage fleet --json
                                ~/.claude/agentic-sage/…
```

Same split as [mossferry](https://github.com/muslewski/mossferry): **door/UI on Mac, truth on host**.

### Mac setup (remote island — recommended)

1. **SSH host alias** that already works with ferry (BatchMode / keys, no password prompt):

   ```bash
   # ~/.ssh/config  (example)
   Host manjaro
     HostName manjaro.tail6d112d.ts.net   # or 100.101.198.44 / LAN
     User kento
     IdentityFile ~/.ssh/id_ed25519
   ```

   Check: `ssh -o BatchMode=yes manjaro 'sage fleet --json' | head`

2. On **manjaro**: `sage` on PATH, SAGE on (`sage on`), agents running as usual.

3. On **Mac**, clone this repo, checkout the island branch, then:

   ```bash
   cd /path/to/agentic-sage          # the REPO, not ~/Desktop
   git checkout feat/sage-island-desktop
   cd desktop                        # lowercase folder inside the repo

   export SAGE_REMOTE=manjaro        # your ssh Host alias
   # optional: export SAGE_REMOTE_CWD=/home/kento/Repositories/agentic-sage

   npm install
   npm run tauri dev
   ```

| Env | Meaning |
|-----|---------|
| **`SAGE_REMOTE`** | SSH host alias → island polls **remote** `sage` (required for Mac → manjaro) |
| `SAGE_REMOTE_CWD` | If set, remote runs `cd` then `board --json` instead of full `fleet --json` |
| `SAGE_SSH` | Override `ssh` binary (default: `ssh` on PATH) |
| `SAGE_BIN` | **Local** sage path only (ignored for remote binary; host still runs bare `sage`) |

Without `SAGE_REMOTE`, the island uses **local** `sage` on the Mac (empty unless you also run agents there).

### Soft actions (remote)

- Copy session id / claims / board JSON  
- **Path** — copy remote worktree path  
- **ssh cd** — copy a one-liner for Mac Terminal (`ssh -t host "cd …"`)  
- **Not** Finder “Open” for remote paths (those paths don’t exist on the Mac)

### Hide / show

**⌘⇧\\** (also Super+Shift+\\ on Linux)

## Requirements

- **Node.js** ≥ 20  
- **Rust** (`rustc` / `cargo`) for Tauri  
- Platform packages: [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)  
- **macOS:** Xcode CLT; unsigned builds may need Gatekeeper **Open Anyway**

## Develop

```bash
cd desktop
export SAGE_REMOTE=manjaro   # your real desk
npm install
npm run tauri dev
```

Frontend only (no native window):

```bash
npm run dev
npm run build
npm test
```

Empty states: `ssh?` / `sage?` (unreachable), `SAGE · 0` (no live sessions), `SAGE · …` (poll error).

## Native commands

| Command | Role |
|---------|------|
| `run_sage(args)` | Local `SAGE_BIN`/PATH **or** `ssh SAGE_REMOTE -- sh -c '… sage …'` |
| `get_sage_transport` | `{ mode, host, remote_cwd }` for UI badge / soft actions |
| `copy_text` / `open_path` | Soft actions |
| `fit_island` / `toggle_island_visible` | Window chrome |

## Notes

- Headless CLI remains source of truth on the **agent host**.  
- `desktop/` never lands in root `package.json` `files` / `dependencies`.  
- Build artifacts are gitignored.
