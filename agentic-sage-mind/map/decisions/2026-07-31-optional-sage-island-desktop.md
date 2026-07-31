---
type: decision
summary: "Optional Tauri Sage Island is a Mac-first top-edge glass consumer of sage --json; never owns fleet truth; soft actions only; OSS self-download without paid Apple program for v1."
status: accepted
created: 2026-07-31
updated: 2026-07-31
related:
  - "[[desktop-island]]"
  - "[[judge-surface]]"
  - "[[war-room]]"
  - "[[2026-07-31-sage-island-desktop-design]]"
sources:
  - "SCHEMA.md"
---

# Optional Sage Island desktop companion

## Context

SAGE is a headless/terminal fleet judge. Users want a modern Mac-style ambient UI
(top-edge “magic island”) without making desktop install required or bloating the
zero-dep npm CLI.

## Decision

1. **Separate optional app** under `desktop/` (Tauri 2 + Svelte). Not in npm
   `files` / runtime deps. CLI remains first-class and complete without it.
2. **Mac-first top-edge island**, always-on-top, hybrid density (labels ≤4 live
   sessions, dots at 5+), hover peek + click pin expand.
3. **Truth is CLI JSON on the agent host.** MacBook desk (mossferry pattern): set
   `SAGE_REMOTE=<ssh-host>` so the island runs `ssh … sage fleet --json` against
   manjaro’s store — not a second empty Mac-local sage home. Local `SAGE_BIN` remains
   for single-machine use. Soft actions only; remote paths → copy / ssh cd, not Finder.
4. **Distribution:** OSS self-download / build-from-source; no paid Apple
   Developer Program or notarization required for v1 (Gatekeeper Open Anyway).
5. **War Room full window** and write-through claims are phase 2, not v1.

## Consequences

- Contributors need Rust + platform WebView deps to build the island.
- Mac dogfood requires BatchMode SSH + `sage` on the remote PATH (same as ferry hop).
- Heat badge depends on stable merge-brief JSON contested counts when available;
  otherwise heat stays 0 rather than inventing overlap math in the UI.
- Linux/Windows are best-effort until phase 2 polish.
