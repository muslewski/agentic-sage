import { invoke } from '@tauri-apps/api/core';

export type UiMode = 'collapsed' | 'peek' | 'pinned';

/** Logical sizes for island chrome modes (matches tauri.conf collapsed defaults). */
export const ISLAND_SIZES: Record<UiMode, { width: number; height: number }> = {
  collapsed: { width: 480, height: 56 },
  peek: { width: 480, height: 140 },
  pinned: { width: 420, height: 420 },
};

/**
 * Resize + re-center the Tauri main window for the given UI mode.
 * No-ops / swallows errors outside a Tauri webview (e.g. vitest, bare Vite).
 */
export async function fitIslandWindow(mode: UiMode): Promise<void> {
  const { width, height } = ISLAND_SIZES[mode];
  try {
    await invoke('fit_island', { width, height });
  } catch {
    // browser-only / missing command
  }
}

/** Toggle main window visibility (hide ↔ show). Returns new visible state if known. */
export async function toggleIslandVisible(): Promise<boolean | null> {
  try {
    return await invoke<boolean>('toggle_island_visible');
  } catch {
    return null;
  }
}
