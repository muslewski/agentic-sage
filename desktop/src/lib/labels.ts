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
