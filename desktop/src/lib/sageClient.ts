import { invoke } from '@tauri-apps/api/core';
import type { BoardEnvelope } from './types';

/**
 * Parse `sage board --json` stdout into a BoardEnvelope.
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
 * Invoke the native `run_sage` command with `board --json` and parse the envelope.
 */
export async function fetchBoard(): Promise<BoardEnvelope> {
  const stdout = await invoke<string>('run_sage', {
    args: ['board', '--json'],
  });
  return parseBoardJson(stdout);
}

/**
 * Best-effort contested heat from `merge-brief --json`. Returns 0 when the CLI
 * has no JSON kind or the invoke fails (fail-open; never invents contested math).
 */
export async function fetchHeat(): Promise<number> {
  try {
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
 */
export async function openPath(path: string): Promise<void> {
  await invoke('open_path', { path });
}
