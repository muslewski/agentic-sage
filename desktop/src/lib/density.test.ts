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
