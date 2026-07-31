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
 * Invoke the native `run_sage` command with `board --json` and parse the envelope.
 */
export async function fetchBoard(): Promise<BoardEnvelope> {
  const stdout = await invoke<string>('run_sage', {
    args: ['board', '--json'],
  });
  return parseBoardJson(stdout);
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
