---
type: spec
summary: "Optional Mac-first Sage Island desktop companion: top-edge always-on-top glass island over headless SAGE; soft actions only; OSS self-download; Tauri 2 + --json."
tags: [desktop, island, ui, tauri, optional, mac-first, glass]
status: approved
created: 2026-07-31
updated: 2026-07-31
related:
  - "[[judge-surface]]"
  - "[[war-room]]"
  - "[[session-store]]"
  - "[[cli]]"
sources:
  - "SCHEMA.md"
  - "docs/reference/cli.md"
---

# Design: Sage Island (optional desktop companion)

**Date:** 2026-07-31  
**Status:** Approved (human design gate)  
**Repo:** `agentic-sage`  
**Product name (working):** Sage Island  

## 0. Intent

Give people who want it a **modern Mac-style desktop surface** for fleet awareness — a **top-edge magic island** with liquid-glass aesthetics — while **headless / terminal SAGE remains first-class and unchanged**.

Not a rewrite. Not required. Not App Store. Download-yourself open source.

## 1. Problem

SAGE’s truth already lives in the CLI and JSON store (`board` / `fleet` / `war` / briefs / session files). Day-to-day awareness still forces a terminal (`sage board`, `sage war`). Users who keep many parallel agent sessions want an ambient, always-visible glance without replacing the control plane.

## 2. Goals

1. **Optional** desktop companion; zero impact on the zero-dep Node CLI package for non-users.
2. **Mac-first top-edge island** with Dynamic Island energy (glass, always-on-top).
3. **Same truth as CLI** via `sage * --json` and/or session store; island never owns fleet state.
4. **Soft actions only** in v1 (copy, open Finder/Terminal) — no claim/register/guard.
5. **OSS self-download** distribution (GitHub Releases); no paid Apple Developer Program / notarization required for v1.
6. Fail-open UX when SAGE is off, missing, or empty.

## 3. Non-goals (v1)

- War Room full window (phase 2)
- Write-through to `sage claim` / `register` / `guard`
- App Store, notarization, paid Apple program
- Linux / Windows parity polish (architecture must not block later ports)
- True Apple Liquid Glass system material as the only look (portable designed glass first)
- Bundling a second Node runtime as “another sage”
- Coupling to Status Herald or other tools

## 4. Product surface

### 4.1 Collapsed island (default)

- Position: **top edge**, horizontal capsule (menu-bar / island feel), not bottom Dock.
- Z-order: **always-on-top**, including over fullscreen apps.
- Escape hatch: hotkey hide/show (default always visible).
- Density (**hybrid**):
  - **1–4** live sessions → short label per pill (`window_name` → `branch` → truncated `session_id`) + liveness color
  - **5+** live sessions → liveness dots + optional count
  - **Always** trailing **heat badge** when contested / attention (e.g. `⚠ 2`)
  - Width cap + `+N` overflow when needed

### 4.2 Hover peek

- Hover island or pill → short-lived glass strip (session line + claims snippet).
- Dismiss on mouse leave.

### 4.3 Click pin expand

- Click island or pill → **pins** expand panel open until click-outside, Esc, or collapse control.
- Click heat badge → pin expand focused on contested / merge-brief view.
- Expand lists full rows: label, liveness, claims, dirty, role (worker/judge), soft actions.

### 4.4 Soft actions (v1)

| Action | Behavior |
|---|---|
| Copy session id | clipboard |
| Copy branch / claimed globs | clipboard |
| Copy merge-brief / board snapshot | plain text or JSON |
| Open worktree in Finder | `open <path>` on macOS |
| Open Terminal at worktree | open Terminal (or copy `cd` path as fallback) |

No mutations of SAGE session records from the UI.

## 5. Architecture

```
agentic-sage (CLI, zero-dep, HEADLESS CORE)
  board / fleet / war / merge-brief --json
  session store under sage home
           │
           │  spawn sage · read JSON
           │  optional fs-watch on sage home
           ▼
Sage Island (optional Tauri 2 desktop binary)
  top island window · expand panel · soft actions
  never owns truth
```

### 5.1 Separation rule

- **npm package `agentic-sage`:** remains pure CLI; **must not** depend on Tauri/Electron/desktop crates at runtime.
- **Desktop app:** separate tree (e.g. `desktop/` in-repo or sibling release artifact) with its own build/CI.
- Discovery: island looks for `sage` on `PATH`, then optional user-configured absolute path.

### 5.2 Data loop

1. Resolve sage binary.
2. Poll `sage board --json` and/or `sage fleet --json` on an interval (e.g. 1–2s; tunable).
3. When heat suspected or badge non-zero, also fetch merge-brief / territory as needed.
4. Optional later: fs-watch `~/.claude/agentic-sage/repos/*/sessions/*.json` and briefs for faster refresh without inventing `sage serve` in v1.
5. Fail-open:
   - binary missing → “Install sage CLI” empty state
   - SAGE off / no sessions → calm “0 sessions” / “SAGE off”
   - JSON parse error → keep last good snapshot; log once; no crash loop

### 5.3 Schema contract

Consumers follow [[SCHEMA.md]] / `SCHEMA.md`:

- Envelope `schema: 1`, `kind` `sage.board` | `sage.fleet`
- Ignore unknown fields
- Live collision surface rules unchanged (island **displays** dead/closed; heat uses same live-only notions as CLI for contested counts)

## 6. Visual language

- **Portable designed glass:** translucent layers, `backdrop-filter`, soft borders, rounded capsules, subtle specular edge.
- Progressive enhancement later: macOS vibrancy under webview if free and reliable.
- Glass on **chrome** (island shell, panel chrome), not every text row (readability).
- Respect Reduce Transparency / high contrast: solid fallback backgrounds.

## 7. Tech stack (v1)

| Layer | Choice |
|---|---|
| Shell | **Tauri 2** (tray optional; primary is island window) |
| UI | Web stack (React **or** Svelte — implementer picks one and sticks) + CSS glass |
| Backend | Thin Rust: window flags (always-on-top, frameless, transparent), spawn sage, clipboard, open paths |
| Data | CLI JSON; no new server protocol in v1 |

### 7.1 Why not Electron / pure SwiftUI

- Electron: workable but heavy for an always-on-top ambient dock.
- Pure SwiftUI Liquid Glass: best Mac materials, poor OSS cross-future and paid-ecosystem pressure; Mac-first glass in webview is enough for v1.

## 8. Distribution

| Channel | v1 |
|---|---|
| GitHub Releases | macOS `.dmg` or `.zip` app bundle |
| App Store | no |
| Notarization / Developer ID | **not required**; document Gatekeeper “Open anyway” |
| Homebrew | optional later |
| Source | `desktop/` build instructions for contributors |

Install copy: island requires **Node ≥ 20** and `agentic-sage` CLI installed for data; the app binary alone does not replace the CLI.

## 9. Repo layout (proposed)

```
agentic-sage/
  bin/ sage …                 # unchanged headless
  desktop/                    # optional Tauri app (not in npm tarball)
    src/                      # frontend
    src-tauri/                # Rust shell
    README.md                 # build + Gatekeeper notes
  agentic-sage-mind/specs/    # this design
```

`package.json` `files` / npm ignore must **exclude** `desktop/` build artifacts from the published tarball.

## 10. Security & privacy

- Capability-scoped filesystem access: only paths needed for soft actions and optional watch of sage home.
- No network requirement for core island function.
- Spawning only the resolved `sage` binary + `open`/Terminal helpers — no arbitrary shell from UI chrome.
- Same local-only privacy model as CLI ([PRIVACY.md](../../../PRIVACY.md)).

## 11. Success criteria (v1 done)

1. With SAGE on and live sessions, island reflects liveness without a terminal board open.
2. Contested heat badge appears; pinned expand shows enough context to act in the terminal.
3. Soft actions copy/open without mutating fleet state.
4. SAGE off / missing `sage` → calm empty state, no panic loops.
5. `npm pack` / published CLI remains zero runtime deps; desktop not required to install CLI.

## 12. Phase 2 (explicit backlog)

- Full War Room window (glass `sage war`)
- fs-watch live updates
- Linux / Windows builds + tray norms
- Notarization if desired
- Optional light write-through (claim) behind explicit UX
- Native vibrancy / material polish

## 13. Decisions locked (brainstorm)

| Topic | Choice |
|---|---|
| Primary UI | Top-edge magic island (not bottom dock, not War Room-first) |
| Density | Hybrid labels (≤4) / dots (5+) |
| Fullscreen | Always-on-top |
| Expand | Hover peek + click pin |
| Actions | Soft only (B) |
| Architecture | Optional Tauri consumer over CLI JSON |
| Distro | OSS self-download; no paid Apple program for v1 |

## 14. Related Atlas

- Zone: war-room (TTY cockpit remains separate; island is desktop companion, not a replacement for `lib/warroom.mjs`)
- Zone: judge-surface (board/fleet/territory JSON)
- Zone: session-store / cli (data authority)
