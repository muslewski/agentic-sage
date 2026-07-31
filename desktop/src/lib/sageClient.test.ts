import { describe, it, expect } from 'vitest';
import { parseBoardJson, parseHeatFromMergeBrief } from './sageClient';

describe('parseBoardJson', () => {
  it('parses schema 1 board envelope', () => {
    const env = parseBoardJson(
      JSON.stringify({
        schema: 1,
        kind: 'sage.board',
        sessions: [{ session_id: 'a', liveness: 'idle' }],
      }),
    );
    expect(env.sessions[0].session_id).toBe('a');
  });

  it('rejects non-object', () => {
    expect(() => parseBoardJson('[]')).toThrow();
  });

  it('rejects missing sessions', () => {
    expect(() =>
      parseBoardJson(JSON.stringify({ schema: 1, kind: 'sage.board' })),
    ).toThrow(/sessions/);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseBoardJson('not-json')).toThrow();
  });
});

describe('parseHeatFromMergeBrief', () => {
  it('returns 0 for human TTY merge-brief (no --json kind yet)', () => {
    const human =
      'SAGE merge-brief · agentic-sage-0e480620 · 2 contested path(s)\n  path a\n';
    expect(parseHeatFromMergeBrief(human)).toBe(0);
  });

  it('reads contested_count / contested number / contested array', () => {
    expect(
      parseHeatFromMergeBrief(
        JSON.stringify({ kind: 'sage.merge_brief', contested_count: 3 }),
      ),
    ).toBe(3);
    expect(
      parseHeatFromMergeBrief(JSON.stringify({ contested: 5 })),
    ).toBe(5);
    expect(
      parseHeatFromMergeBrief(
        JSON.stringify({ contested: [{ path: 'a' }, { path: 'b' }] }),
      ),
    ).toBe(2);
  });

  it('returns 0 on invalid or empty JSON shapes', () => {
    expect(parseHeatFromMergeBrief('')).toBe(0);
    expect(parseHeatFromMergeBrief('{')).toBe(0);
    expect(parseHeatFromMergeBrief(JSON.stringify({ paths: 'nope' }))).toBe(0);
  });
});
