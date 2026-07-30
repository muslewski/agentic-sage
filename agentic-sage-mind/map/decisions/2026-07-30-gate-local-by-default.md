---
type: decision
summary: "sage gate stays local by default (wired stamp only); npm registry probe is opt-in via `gate --check-latest` or packageFreshness.registry=true — everyday agent paths never phone the registry."
status: accepted
created: 2026-07-30
updated: 2026-07-30
related:
  - "[[judge-surface]]"
  - "[[install-wiring]]"
sources: []
---

# Gate local-by-default (no silent registry)

## Context

`sage gate` is on everyday agent paths (desk scripts, SessionStart soft checks, doctor-adjacent health). It previously defaulted `packageFreshness.registry: true`, so a cold install-state cache ran `npm view agentic-sage version` (network, ~0.5–2.5s). Independent research is unambiguous: explicit update verbs may hit the network; everyday diagnostics must not. Preferred-offline already fails soft; a silent registry probe undermines the local-only trust argument.

## Decision

1. **Default `packageFreshness.registry` is `false`.** Ordinary `sage gate` compares installed version to the wired stamp only (Tier A).
2. **Network ownership:** `sage gate --check-latest` (or config `packageFreshness.registry: true`, or `--force` with an explicit check path) runs the npm registry probe.
3. **Escapes:** `CI`, `OFFLINE`, `NO_NETWORK`, `SAGE_NO_REGISTRY` block the real probe (fail-open: no latest, no exit change on default warn mode).
4. **Preferred-offline remains soft** — never changes exit code.
5. **Offline default never changes exit code** solely because the network is unreachable.

## Consequences

- Agents and desk scripts that call `sage gate` stay offline and fast.
- Humans who want "is npm ahead?" use `sage gate --check-latest`.
- `wiredLagSoftLine` (SessionStart) was already network-free; unchanged.
- Tests must prove default path never invokes `fetchLatest` (spy call count 0).

## Anchors

- `lib/package-freshness.mjs` — `DEFAULT_PACKAGE_FRESHNESS.registry: false`, `registryProbeBlocked`
- `lib/gate.mjs` — `--check-latest` / `checkLatest`
- `test/gate.test.mjs` — default no-fetch + opt-in probe tests
