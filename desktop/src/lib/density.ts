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
