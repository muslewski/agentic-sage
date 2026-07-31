# Sage Island

Optional **desktop companion** for [agentic-sage](../README.md): a Mac-first Tauri + Svelte shell that will show a top-edge fleet island over live `sage --json` data.

This package is **not** part of the published `agentic-sage` npm package. Installing `npm i -g agentic-sage` never installs or builds this app. Clone the repo and build here if you want the island UI.

## Requirements

- **Node.js** ≥ 20
- **Rust** toolchain (`rustc` / `cargo`) for Tauri
- **`sage` CLI** on `PATH` (from this monorepo or a global install), or set **`SAGE_BIN`** to an absolute path — the island spawns `sage board --json` (and soft helpers) via a native Tauri command
- Platform packages for Tauri (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### macOS (primary target)

- Xcode Command Line Tools
- After download of unsigned/local builds: **System Settings → Privacy & Security → Open Anyway** (Gatekeeper) if macOS blocks the app

### Linux

Scaffold and frontend build work; full `tauri build` / `tauri dev` need WebKitGTK and related system deps. macOS-only features (menu bar island placement) may be incomplete here.

## Develop

```bash
cd desktop
npm install
npm run tauri dev
```

Frontend-only (no native window):

```bash
npm run dev      # Vite on http://localhost:1420
npm run build    # static SPA → build/
npm test         # vitest (density, sageClient, windowFit)
```

Empty island states: `sage?` (binary missing), `SAGE · 0` (no live sessions),
`SAGE · …` (poll error, last good view kept when possible).


## Sage CLI wiring

Native commands (Rust, `src-tauri/src/lib.rs`):

| Command | Role |
|---|---|
| `run_sage(args)` | Resolve binary (`SAGE_BIN` → PATH scan for `sage`), spawn, return stdout |
| `copy_text(text)` | System clipboard via **`arboard`** (not the Tauri clipboard plugin) |
| `open_path(path)` | `open` (macOS) / `xdg-open` (Linux) / `cmd /C start` (Windows) |
| `fit_island(w, h)` | Logical resize + top-center reposition for collapsed / peek / pinned |
| `toggle_island_visible` | Hide ↔ show the always-on-top window |

Frontend helpers live in `src/lib/sageClient.ts` (`parseBoardJson`, `fetchBoard`, `copyText`, `openPath`) and `src/lib/windowFit.ts`. Binary resolution does **not** use a shell plugin — only `std::process::Command` with the resolved path.

## Interaction (v1)

| Gesture | Behavior |
|---|---|
| Hover island / pill | **Peek** strip (label, liveness, first 2 claims); leave → collapse |
| Click island / pill / heat | **Pin** expand panel with live rows + soft actions |
| Esc or click outside chrome | Unpin / collapse |
| Soft actions | Copy session id, claims, board JSON; open worktree path |
| **⌘⇧\\** / **Super+Shift+\\** | Global hide/show (also window-focused when focused) |

Soft actions never call `sage claim` / `register` / `guard` — clipboard and OS open only.

## Notes

- Headless CLI remains source of truth under the repo root; `desktop/` never lands in root `package.json` `files` / `dependencies`.
- Build artifacts (`node_modules`, `build`, `src-tauri/target`, `src-tauri/gen`) are gitignored.
- `tauri build` may fail without platform packages — install Tauri system deps for your OS, then retry.
