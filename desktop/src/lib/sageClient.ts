import { invoke } from '@tauri-apps/api/core';
import type { BoardEnvelope } from './types';

/** Local Mac sage vs remote host (manjaro) over SSH. */
export type SageTransportInfo = {
  mode: 'local' | 'remote';
  host: string | null;
  remote_cwd: string | null;
};

/**
 * Parse `sage board --json` / `sage fleet --json` stdout into a BoardEnvelope.
 * Throws on invalid JSON or missing sessions array.
 */
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

/**
 * Parse contested heat from `sage merge-brief --json` stdout when present.
 *
 * Honest v1: if stdout is not JSON (CLI currently prints human text and ignores
 * `--json`), return 0. Do **not** invent contested math or scrape TTY prose.
 */
export function parseHeatFromMergeBrief(stdout: string): number {
  const trimmed = stdout.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return 0;
  }
  try {
    const data = JSON.parse(trimmed) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return 0;
    }
    const o = data as Record<string, unknown>;
    if (typeof o.contested_count === 'number' && Number.isFinite(o.contested_count)) {
      return Math.max(0, Math.floor(o.contested_count));
    }
    if (typeof o.contested === 'number' && Number.isFinite(o.contested)) {
      return Math.max(0, Math.floor(o.contested));
    }
    if (Array.isArray(o.contested)) {
      return o.contested.length;
    }
    if (Array.isArray(o.paths)) {
      return o.paths.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Which verbs to poll for the island.
 * - remote + no remote_cwd → `fleet --json` (full manjaro desk; Mac has no repo cwd)
 * - local or remote with SAGE_REMOTE_CWD → `board --json` (repo-scoped)
 */
export function islandPollArgs(transport: SageTransportInfo): string[] {
  if (transport.mode === 'remote' && !transport.remote_cwd) {
    return ['fleet', '--json'];
  }
  return ['board', '--json'];
}

/**
 * SSH one-liner to open a remote worktree in a Mac Terminal (soft action when remote).
 * Paths live on the host (e.g. manjaro) — paste into local Terminal; do not open in Finder.
 */
export function remoteCdCommand(host: string, worktree: string): string {
  const p = worktree.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `ssh -t ${host} "cd \\"${p}\\" && exec \\$SHELL -l"`;
}

/**
 * Ask native shell how sage is reached (local PATH vs SAGE_REMOTE ssh).
 */
export async function getSageTransport(): Promise<SageTransportInfo> {
  const raw = await invoke<string>('get_sage_transport');
  const data = JSON.parse(raw) as Partial<SageTransportInfo>;
  const mode = data.mode === 'remote' ? 'remote' : 'local';
  return {
    mode,
    host: typeof data.host === 'string' ? data.host : null,
    remote_cwd: typeof data.remote_cwd === 'string' ? data.remote_cwd : null,
  };
}

/**
 * Invoke native `run_sage` with the right poll verb and parse the envelope.
 */
export async function fetchBoard(
  transport?: SageTransportInfo,
): Promise<BoardEnvelope> {
  const t = transport ?? (await getSageTransport());
  const args = islandPollArgs(t);
  const stdout = await invoke<string>('run_sage', { args });
  return parseBoardJson(stdout);
}

/**
 * Best-effort contested heat from `merge-brief --json`. Returns 0 when the CLI
 * has no JSON kind or the invoke fails (fail-open; never invents contested math).
 * Remote without remote_cwd: merge-brief is cwd-scoped → skip (0).
 */
export async function fetchHeat(transport?: SageTransportInfo): Promise<number> {
  try {
    const t = transport ?? (await getSageTransport());
    if (t.mode === 'remote' && !t.remote_cwd) {
      return 0;
    }
    const stdout = await invoke<string>('run_sage', {
      args: ['merge-brief', '--json'],
    });
    return parseHeatFromMergeBrief(stdout);
  } catch {
    return 0;
  }
}

/**
 * Soft action: copy text via Tauri `copy_text` command.
 */
export async function copyText(text: string): Promise<void> {
  await invoke('copy_text', { text });
}

/**
 * Soft action: open a path (worktree/dir) via Tauri `open_path` command.
 * Only useful for **local** paths (Finder / file manager on this machine).
 */
export async function openPath(path: string): Promise<void> {
  await invoke('open_path', { path });
}
