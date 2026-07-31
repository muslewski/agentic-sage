import { describe, it, expect } from 'vitest';
import { ISLAND_SIZES, type UiMode } from './windowFit';

describe('ISLAND_SIZES', () => {
  it('collapsed is short capsule height', () => {
    expect(ISLAND_SIZES.collapsed.height).toBeLessThanOrEqual(64);
    expect(ISLAND_SIZES.collapsed.width).toBeGreaterThanOrEqual(400);
  });

  it('pinned is taller expand panel', () => {
    expect(ISLAND_SIZES.pinned.height).toBeGreaterThanOrEqual(360);
    expect(ISLAND_SIZES.pinned.height).toBeLessThanOrEqual(480);
    expect(ISLAND_SIZES.pinned.width).toBeGreaterThanOrEqual(400);
  });

  it('peek sits between collapsed and pinned height', () => {
    expect(ISLAND_SIZES.peek.height).toBeGreaterThan(ISLAND_SIZES.collapsed.height);
    expect(ISLAND_SIZES.peek.height).toBeLessThan(ISLAND_SIZES.pinned.height);
  });

  it('covers all UiMode keys', () => {
    const modes: UiMode[] = ['collapsed', 'peek', 'pinned'];
    for (const m of modes) {
      expect(ISLAND_SIZES[m].width).toBeGreaterThan(0);
      expect(ISLAND_SIZES[m].height).toBeGreaterThan(0);
    }
  });
});
