---
type: plan
summary: "Implement Sage Island v1: Tauri top-edge glass island over sage --json; hybrid density; soft actions; Mac-first OSS download; desktop/ out of npm tarball."
tags: [desktop, island, tauri, plan]
status: executing
created: 2026-07-31
updated: 2026-07-31
spec: "[[2026-07-31-sage-island-desktop-design]]"
---

# Sage Island Desktop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an optional Mac-first Tauri desktop companion that shows a top-edge always-on-top glass island over live SAGE fleet data (CLI JSON), with hybrid density, hover peek / click pin, and soft actions only.

**Architecture:** Headless `agentic-sage` CLI remains source of truth. `desktop/` is a separate Tauri 2 + Svelte app that resolves `sage` on PATH, polls `--json`, and never mutates the session store. Pure presentation/density logic lives in testable TS modules.

**Tech Stack:** Tauri 2, Svelte 5 + Vite, TypeScript, CSS glass, Rust shell (window + spawn + clipboard + open). Node tests for pure helpers where practical; `npm` CLI package stays zero runtime deps.

## Global Constraints

- **CLI zero-dep:** never add Tauri/desktop deps to root `package.json` `dependencies`.
- **npm tarball:** keep `package.json` `files` whitelist (do **not** add `desktop/`); exclude build artifacts via `.gitignore`.
- **Read-only v1:** no `sage claim` / `register` / `guard` from UI.
- **Mac-first:** window flags and docs target macOS; Linux may build for CI smoke but is not polish-gated.
- **Fail-open:** missing sage / empty / parse errors → calm UI, no crash loops.
- **Schema:** consume SCHEMA.md envelope; ignore unknown fields.
- **Ship policy:** human-end-gate — no push/PR/merge unless human asks.
- **Spec:** `agentic-sage-mind/specs/2026-07-31-sage-island-desktop-design.md` is binding.

## File map

| Path | Responsibility |
|---|---|
| `desktop/` | Tauri app root (not published on npm) |
| `desktop/package.json` | Frontend deps + scripts |
| `desktop/src-tauri/` | Rust: window, spawn sage, clipboard, open |
| `desktop/src/lib/sageClient.ts` | Resolve binary, run sage, parse JSON |
| `desktop/src/lib/density.ts` | Hybrid label/dot rules + heat badge |
| `desktop/src/lib/labels.ts` | window_name → branch → session_id |
| `desktop/src/lib/types.ts` | Board/fleet envelope types (schema 1) |
| `desktop/src/components/Island.svelte` | Collapsed island chrome |
| `desktop/src/components/Peek.svelte` | Hover peek |
| `desktop/src/components/ExpandPanel.svelte` | Pinned expand + soft actions |
| `desktop/src/App.svelte` | Poll loop, state, hotkey hide |
| `desktop/src/styles/glass.css` | Liquid-glass tokens |
| `desktop/README.md` | Build, run, Gatekeeper “Open anyway” |
| `desktop/src/lib/*.test.ts` or `desktop/tests/` | Unit tests for density/labels/client parse |
| `.gitignore` | `desktop/node_modules`, `desktop/src-tauri/target`, dist |
| `docs/` or SETUP snippet | Optional one-liner: desktop is separate download |
| `agentic-sage-mind/map/decisions/` | Why optional desktop / island not War Room-first |

---

### Task 1: Scaffold `desktop/` Tauri + Svelte (empty island window)

**Files:**
- Create: `desktop/` (Tauri 2 + Svelte + TS via `npm create tauri-app` or equivalent manual scaffold)
- Create: `desktop/README.md`
- Modify: `.gitignore` (add desktop build dirs)

**Interfaces:**
- Produces: `desktop/` builds with `npm run tauri dev` (or package scripts); blank frameless-capable window.

- [ ] **Step 1: Ensure toolchains**

Run (document failures; on Linux may lack macOS targets — still scaffold):

```bash
node --version   # >= 20
rustc --version  # required for Tauri
cargo --version
```

- [ ] **Step 2: Scaffold app**

From repo root, create Tauri 2 app with Svelte + TypeScript + npm in `desktop/`:

```bash
# Prefer interactive-equivalent non-interactive flags if available; else create structure matching Tauri 2 defaults.
cd /home/kento/Repositories/agentic-sage
npm create tauri-app@latest desktop -- --template svelte-ts --manager npm --yes 2>/dev/null || true
```

If the generator is interactive-only, manually create:

- `desktop/package.json` with `vite`, `@sveltejs/vite-plugin-svelte`, `svelte`, `typescript`, `@tauri-apps/cli`, `@tauri-apps/api`
- `desktop/src-tauri/Cargo.toml` / `tauri.conf.json` for Tauri 2
- Vite + Svelte entry `desktop/src/main.ts`, `App.svelte`

Minimum `desktop/package.json` scripts:

```json
{
  "name": "sage-island",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Gitignore desktop artifacts**

Append to `.gitignore`:

```
# Sage Island (Tauri) — local build only
desktop/node_modules/
desktop/dist/
desktop/src-tauri/target/
desktop/src-tauri/gen/
```

- [ ] **Step 4: README stub**

Write `desktop/README.md` covering: requires Node 20 + Rust + installed `sage` CLI; `npm i && npm run tauri dev`; Mac Gatekeeper Open anyway; not part of `npm i -g agentic-sage`.

- [ ] **Step 5: Verify scaffold**

```bash
cd desktop && npm install && npm run build
```

Expected: frontend builds. (`tauri build` may need platform packages — note in README if missing.)

- [ ] **Step 6: Commit**

```bash
git add desktop .gitignore
git commit -m "$(cat <<'EOF'
chore(desktop): scaffold Sage Island Tauri + Svelte app

Optional companion shell; excluded from npm files whitelist.
EOF
)"
```

---

### Task 2: Pure TS types + density/label helpers (TDD)

**Files:**
- Create: `desktop/src/lib/types.ts`
- Create: `desktop/src/lib/labels.ts`
- Create: `desktop/src/lib/density.ts`
- Create: `desktop/src/lib/density.test.ts` (vitest)
- Create: `desktop/vitest.config.ts` if needed

**Interfaces:**
- Produces:
  - `type SageSession` / `type BoardEnvelope` matching SCHEMA.md session fields used by UI
  - `sessionLabel(s: SageSession): string`
  - `buildCollapsedView(sessions: SageSession[], contestedCount: number): CollapsedView`
  - `CollapsedView = { mode: 'labels' | 'dots'; pills: Pill[]; heat: number; overflow: number }`

- [ ] **Step 1: Write failing tests for labels + hybrid density**

```ts
// desktop/src/lib/density.test.ts
import { describe, it, expect } from 'vitest';
import { sessionLabel } from './labels';
import { buildCollapsedView } from './density';

const base = {
  session_id: 's1',
  alive: true,
  liveness: 'working' as const,
  status: 'active',
  dirty: false,
  touched_globs: [] as string[],
  claimed_globs: [] as string[],
  link_state: 'linked',
  branch: 'feat/auth',
  window_name: 'auth-agent',
};

describe('sessionLabel', () => {
  it('prefers window_name over branch', () => {
    expect(sessionLabel(base)).toBe('auth-agent');
  });
  it('falls back to branch then session_id', () => {
    expect(sessionLabel({ ...base, window_name: undefined })).toBe('feat/auth');
    expect(sessionLabel({ ...base, window_name: undefined, branch: null })).toBe('s1');
  });
});

describe('buildCollapsedView', () => {
  it('uses labels for 1–4 live sessions', () => {
    const sessions = [1, 2, 3].map((i) => ({
      ...base,
      session_id: `s${i}`,
      window_name: `w${i}`,
    }));
    const v = buildCollapsedView(sessions, 0);
    expect(v.mode).toBe('labels');
    expect(v.pills).toHaveLength(3);
    expect(v.heat).toBe(0);
  });
  it('uses dots for 5+ live sessions', () => {
    const sessions = [1, 2, 3, 4, 5].map((i) => ({
      ...base,
      session_id: `s${i}`,
    }));
    const v = buildCollapsedView(sessions, 2);
    expect(v.mode).toBe('dots');
    expect(v.pills).toHaveLength(5);
    expect(v.heat).toBe(2);
  });
  it('ignores dead/closed for pill count', () => {
    const sessions = [
      base,
      { ...base, session_id: 'dead', liveness: 'dead' as const, alive: false },
    ];
    const v = buildCollapsedView(sessions, 0);
    expect(v.pills).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd desktop && npx vitest run src/lib/density.test.ts
```

- [ ] **Step 3: Implement types, labels, density**

```ts
// desktop/src/lib/types.ts
export type Liveness = 'working' | 'idle' | 'stalled' | 'dead' | 'closed';

export interface SageSession {
  session_id: string;
  liveness: Liveness;
  alive?: boolean;
  status?: string;
  branch?: string | null;
  window_name?: string;
  dirty?: boolean;
  claimed_globs?: string[];
  touched_globs?: string[];
  role?: string;
  worktree?: string;
  [key: string]: unknown;
}

export interface BoardEnvelope {
  schema: number;
  kind: string;
  generated_at?: string;
  repo_id?: string | null;
  sessions: SageSession[];
}

export interface Pill {
  session_id: string;
  label: string;
  liveness: Liveness;
}

export interface CollapsedView {
  mode: 'labels' | 'dots';
  pills: Pill[];
  heat: number;
  overflow: number;
}
```

```ts
// desktop/src/lib/labels.ts
import type { SageSession } from './types';

const MAX = 18;

export function sessionLabel(s: SageSession): string {
  const raw =
    (s.window_name && String(s.window_name).trim()) ||
    (s.branch && String(s.branch).trim()) ||
    s.session_id;
  if (raw.length <= MAX) return raw;
  return raw.slice(0, MAX - 1) + '…';
}
```

```ts
// desktop/src/lib/density.ts
import type { CollapsedView, SageSession } from './types';
import { sessionLabel } from './labels';

const LIVE = new Set(['working', 'idle', 'stalled']);

export function isLiveSession(s: SageSession): boolean {
  return LIVE.has(s.liveness);
}

export function buildCollapsedView(
  sessions: SageSession[],
  contestedCount: number,
  opts: { labelMax?: number } = {},
): CollapsedView {
  const labelMax = opts.labelMax ?? 4;
  const live = sessions.filter(isLiveSession);
  const mode = live.length > labelMax ? 'dots' : 'labels';
  const pills = live.map((s) => ({
    session_id: s.session_id,
    label: sessionLabel(s),
    liveness: s.liveness,
  }));
  return {
    mode,
    pills,
    heat: Math.max(0, contestedCount | 0),
    overflow: 0,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd desktop && npx vitest run src/lib/density.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add desktop/src/lib desktop/vitest.config.ts desktop/package.json
git commit -m "feat(desktop): hybrid density and session labels for island"
```

---

### Task 3: Sage CLI client (resolve, spawn, parse)

**Files:**
- Create: `desktop/src/lib/sageClient.ts`
- Create: `desktop/src/lib/sageClient.test.ts`
- Create: `desktop/src-tauri/src/lib.rs` commands (or extend) for `run_sage`
- Modify: `desktop/src-tauri/capabilities` to allow shell for sage binary only as designed

**Interfaces:**
- Produces (TS):
  - `parseBoardJson(text: string): BoardEnvelope` (throws on invalid)
  - Frontend calls Tauri command `run_sage(args: string[]) -> string` (stdout)
- Produces (Rust):
  - `#[tauri::command] fn run_sage(args: Vec<String>) -> Result<String, String>`
  - Resolves binary: env `SAGE_BIN` → `which sage` → error string

- [ ] **Step 1: Failing test for parseBoardJson**

```ts
import { describe, it, expect } from 'vitest';
import { parseBoardJson } from './sageClient';

it('parses schema 1 board envelope', () => {
  const env = parseBoardJson(
    JSON.stringify({
      schema: 1,
      kind: 'sage.board',
      sessions: [{ session_id: 'a', liveness: 'idle' }],
    }),
  );
  expect(env.sessions[0].session_id).toBe('a');
});

it('rejects non-object', () => {
  expect(() => parseBoardJson('[]')).toThrow();
});
```

- [ ] **Step 2: Implement parseBoardJson + client wrapper**

```ts
// desktop/src/lib/sageClient.ts
import type { BoardEnvelope } from './types';

export function parseBoardJson(text: string): BoardEnvelope {
  const data = JSON.parse(text) as unknown;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('sage: expected JSON object envelope');
  }
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.sessions)) {
    throw new Error('sage: missing sessions array');
  }
  return data as BoardEnvelope;
}
```

Frontend fetch helper (invokes Tauri):

```ts
import { invoke } from '@tauri-apps/api/core';
import { parseBoardJson } from './sageClient';
import type { BoardEnvelope } from './types';

export async function fetchBoard(): Promise<BoardEnvelope> {
  const stdout = await invoke<string>('run_sage', {
    args: ['board', '--json'],
  });
  return parseBoardJson(stdout);
}
```

- [ ] **Step 3: Rust `run_sage` command**

In `desktop/src-tauri/src/lib.rs` (adapt to scaffold):

```rust
use std::process::Command;

fn resolve_sage_bin() -> Result<String, String> {
    if let Ok(p) = std::env::var("SAGE_BIN") {
        if !p.is_empty() {
            return Ok(p);
        }
    }
    which::which("sage")
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|_| "sage binary not found on PATH (set SAGE_BIN)".into())
}

#[tauri::command]
fn run_sage(args: Vec<String>) -> Result<String, String> {
    let bin = resolve_sage_bin()?;
    let out = Command::new(&bin)
        .args(&args)
        .output()
        .map_err(|e| format!("spawn {bin}: {e}"))?;
    // Prefer stdout even if exit != 0 for fail-open display; surface stderr if empty
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    if stdout.trim().is_empty() && !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        return Err(format!("sage exited {}: {stderr}", out.status));
    }
    Ok(stdout)
}
```

Add `which` crate to `Cargo.toml` if used, or implement PATH search without it.

Register command in `tauri::Builder::default().invoke_handler(tauri::generate_handler![run_sage])`.

- [ ] **Step 4: Soft-action commands**

```rust
#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    // use arboard or tauri clipboard plugin
    Ok(())
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    // macOS: open; linux: xdg-open
    Ok(())
}
```

Wire `@tauri-apps/plugin-clipboard-manager` **or** minimal `arboard` — pick one and document in desktop README.

- [ ] **Step 5: Unit tests pass; manual smoke**

```bash
cd desktop && npx vitest run
# with sage on PATH:
# npm run tauri dev  → invoke board in console
```

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(desktop): sage CLI invoke and board JSON parse"
```

---

### Task 4: Island UI — collapsed hybrid + glass CSS

**Files:**
- Create: `desktop/src/styles/glass.css`
- Create: `desktop/src/components/Island.svelte`
- Modify: `desktop/src/App.svelte`
- Modify: `desktop/src-tauri/tauri.conf.json` — frameless, transparent, alwaysOnTop, small size

**Interfaces:**
- Consumes: `CollapsedView` from density
- Produces: visible top island UI

- [ ] **Step 1: Window config (Mac-first)**

In `tauri.conf.json` window:

```json
{
  "title": "Sage Island",
  "width": 480,
  "height": 56,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "resizable": false,
  "fullscreen": false,
  "skipTaskbar": true
}
```

Position: center top on start via Rust `Window::set_position` using monitor size (y ≈ 8–12 px).

- [ ] **Step 2: glass.css tokens**

```css
:root {
  --glass-bg: rgba(28, 28, 30, 0.55);
  --glass-border: rgba(255, 255, 255, 0.22);
  --glass-blur: 24px;
  --live-working: #34c759;
  --live-idle: #8e8e93;
  --live-stalled: #ff9f0a;
  --heat: #ff453a;
}
.island-shell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--glass-blur)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(160%);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  color: #f5f5f7;
  font: 12px/1.2 system-ui, -apple-system, sans-serif;
  user-select: none;
}
```

- [ ] **Step 3: Island.svelte**

Render pills: if `mode === 'labels'` show truncated labels with liveness dot; if `dots` show colored dots only; heat badge when `heat > 0`.

- [ ] **Step 4: App poll loop**

Every 1500ms call `fetchBoard()`; on error set `status = 'error' | 'missing' | 'empty'`; map sessions → `buildCollapsedView(sessions, heat)`.

Heat for v1: count sessions with overlapping claims is **hard** without territory — **v1 heat** = call `run_sage(['merge-brief', '--json'])` if available, else `0`, or count sessions with `claimed_globs?.length` sharing rough heuristic. Prefer real merge-brief JSON if kind exists; if merge-brief has no `--json`, parse contested from `sage merge-brief` text only as last resort — **prefer extending nothing in CLI for v1**. Spec allows: heat from merge-brief when possible.

Check: `sage merge-brief --json` — if absent, heat badge uses `0` until Task 4b documents limitation, OR poll `sage fleet --json` and leave heat 0 (honest). **Do not invent contested math in UI.**

- [ ] **Step 5: Manual visual check**

`npm run tauri dev` with two registered sessions → labels mode.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(desktop): glass island collapsed hybrid UI"
```

---

### Task 5: Hover peek + click pin expand + soft actions

**Files:**
- Create: `desktop/src/components/Peek.svelte`
- Create: `desktop/src/components/ExpandPanel.svelte`
- Modify: `App.svelte` — pointer state machine
- Modify: window height dynamically when pinned (Rust `set_size`)

**Interfaces:**
- State: `ui: 'collapsed' | 'peek' | 'pinned'`
- Peek on `pointerenter`; leave → collapsed unless pinned
- Click → pinned; Esc / click-outside chrome → collapsed

- [ ] **Step 1: State machine in App.svelte**

```ts
type UiMode = 'collapsed' | 'peek' | 'pinned';
let mode: UiMode = 'collapsed';
let hoverId: string | null = null;
```

- [ ] **Step 2: Peek content**

Show label, liveness, first 2 claimed globs for hovered or focused session.

- [ ] **Step 3: ExpandPanel**

List all live sessions; buttons:

- Copy session id
- Copy claims
- Open worktree (if `worktree` present) via `open_path`
- Copy board snapshot JSON

- [ ] **Step 4: Resize window when pinned**

When `pinned`, set window height ~360–480 and width ~420; when collapsed, ~56 height.

- [ ] **Step 5: Hotkey hide**

Register global or window shortcut (e.g. Cmd+Shift+\\) toggles `visible` / `alwaysOnTop` hide — use Tauri global shortcut plugin if low friction; else window-focused keydown.

- [ ] **Step 6: Manual test checklist**

- Hover peeks and dismisses  
- Click pins; Esc unpins  
- Copy works  
- Open Finder works on Mac path  
- Always-on-top over fullscreen (Mac)  

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(desktop): peek, pin expand, and soft actions"
```

---

### Task 6: Empty/error states, docs, Atlas decision, release notes path

**Files:**
- Modify: Island empty states
- Modify: `desktop/README.md` (Gatekeeper, SAGE_BIN, requirements)
- Create: `agentic-sage-mind/map/decisions/2026-07-31-optional-sage-island-desktop.md`
- Modify: `SETUP.md` or `docs/index.md` — one short “Optional desktop” pointer (no npm install change)
- Modify: root README optional one-liner under docs links

- [ ] **Step 1: Empty states copy**

| Condition | Collapsed text |
|---|---|
| sage missing | `sage?` |
| 0 live sessions | `SAGE · 0` |
| poll error | `SAGE · …` (dim) |

- [ ] **Step 2: Decision note**

Decision: optional Tauri island over CLI JSON; Mac-first top island; soft actions; no paid Apple program for v1.

- [ ] **Step 3: SETUP/docs pointer**

Link to `desktop/README.md`; state clearly CLI remains primary.

- [ ] **Step 4: Verify npm pack excludes desktop**

```bash
npm pack --dry-run 2>&1 | rg desktop || echo "OK: desktop not in tarball"
```

Expected: no `desktop/` paths in tarball file list.

- [ ] **Step 5: Commit**

```bash
git commit -am "docs: Sage Island optional desktop + decision record"
```

---

### Task 7: Recollection + green check

**Files:**
- Possibly: `agentic-sage-mind/map/zones/` new zone `sage-island.md` **or** extend judge-surface related note (prefer **new zone** `desktop-island` if globs `desktop/**`)

- [ ] **Step 1: Zone card** for `desktop/**` ownership (seeded)

- [ ] **Step 2: `atlas build` / `atlas check` per repo procedure; stamp only touched zones after commit

- [ ] **Step 3: Run desktop unit tests + root `npm test`**

```bash
cd desktop && npm test
cd .. && npm test
```

- [ ] **Step 4: Final commit if atlas dirty**

```bash
git commit -am "chore(atlas): zone + index for Sage Island desktop"
```

---

## Verification (definition of done)

- [ ] `desktop` vitest green  
- [ ] Root `npm test` green (unchanged CLI)  
- [ ] `npm pack --dry-run` has no desktop app sources required at runtime  
- [ ] Manual: island shows live sessions from real `sage board --json`  
- [ ] Manual: soft actions do not write session files  
- [ ] Spec success criteria §11 all met or explicitly deferred with debt note  

## Risk notes for implementers

- Building **macOS `.app`** may require a Mac runner; Linux agents can land code + Linux smoke only.
- Transparent always-on-top on Linux/Wayland is best-effort; do not block Mac v1.
- If `merge-brief` lacks stable JSON, ship heat=0 and file tech-debt rather than scraping TTY.

---

## Plan self-review

| Spec requirement | Task |
|---|---|
| Top-edge island always-on-top | T4 |
| Hybrid density | T2, T4 |
| Hover peek / click pin | T5 |
| Soft actions only | T5 |
| CLI JSON truth | T3 |
| Optional / not in npm | T1, T6 |
| OSS Gatekeeper docs | T6 |
| Fail-open empty | T6 |
| War Room / writes out | not in tasks (phase 2) |
