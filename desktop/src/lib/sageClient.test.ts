import { describe, it, expect } from 'vitest';
import {
  islandPollArgs,
  parseBoardJson,
  parseHeatFromMergeBrief,
  remoteCdCommand,
} from './sageClient';

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

describe('islandPollArgs', () => {
  it('uses fleet --json for remote without remote_cwd (Mac → manjaro desk)', () => {
    expect(
      islandPollArgs({ mode: 'remote', host: 'manjaro', remote_cwd: null }),
    ).toEqual(['fleet', '--json']);
  });

  it('uses board --json for local or remote with cwd', () => {
    expect(
      islandPollArgs({ mode: 'local', host: null, remote_cwd: null }),
    ).toEqual(['board', '--json']);
    expect(
      islandPollArgs({
        mode: 'remote',
        host: 'manjaro',
        remote_cwd: '/home/kento/Repositories/agentic-sage',
      }),
    ).toEqual(['board', '--json']);
  });
});

describe('remoteCdCommand', () => {
  it('builds an ssh cd one-liner', () => {
    const cmd = remoteCdCommand('manjaro', '/home/kento/Repositories/agentic-sage');
    expect(cmd).toContain('ssh -t manjaro');
    expect(cmd).toContain('agentic-sage');
    expect(cmd).toContain('cd');
  });
});
