import { describe, it, expect } from 'vitest';
import { parseBoardJson } from './sageClient';

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
