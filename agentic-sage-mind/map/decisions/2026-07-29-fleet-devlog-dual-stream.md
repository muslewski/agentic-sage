---
type: decision
summary: "Emit fleet-devlog v1 alongside legacy sage telemetry; keep hashRepoRoot for old stream; use resolveRepoId for fleet events."
status: accepted
created: 2026-07-29
tags: [fleet-devlog, telemetry, privacy]
---

# Dual-stream fleet-devlog

## Decision

Vendor the work-kb reference emitter; call it from `trackCommand` with its own
enable gate (`FLEET_DEVLOG` / machine config). Do not change the legacy
install-id or `hashRepoRoot` so existing local history stays valid. Fleet
`repo_id` uses `lib/repo-id.mjs` contract form.
