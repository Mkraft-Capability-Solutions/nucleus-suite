'use client';

/**
 * Appearance state for the whole app: theme id + mode (light | dark | system), persisted in localStorage, synced
 * across tabs, applied to <html> as data-theme / data-mode (the generated tokens.css does the rest). The inline
 * THEME_INIT_SCRIPT applies the same values before first paint; this provider keeps <html> in sync afterwards
 * (including after React's development remount, which resets attributes on <html>).
 */
import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { ModePreference, ThemeId, ThemeMode } from '@nucleus/design-tokens';
import { ThemeContext, type ThemeContextValue } from './theme-context';
import { APPEARANCE_STORAGE_KEY, parsePreference, resolvePreference, serializePreference } from './theme-preference';

const CHANGE_EVENT = 'nucleus:appearance-change';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStored(): string | null {
  try {
    return window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribeStored(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === APPEARANCE_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function subscribeSystemMode(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readSystemMode(): ThemeMode {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function serverSnapshot(): null {
  return null;
}

function serverSystemMode(): ThemeMode {
  return 'light';
}

function subscribeNothing(): () => void {
  return () => undefined;
}

function isClient(): boolean {
  return true;
}

function isServer(): boolean {
  return false;
}

/** In-memory fallback when storage is blocked, so the choice still holds for the session. */
let sessionPreference: string | null = null;

function writeStored(value: string): void {
  sessionPreference = value;
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode, policy): the session value above is used instead.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface ThemeProviderProps {
  /** The tenant's theme (from tenant branding); the default theme when absent. */
  readonly tenantThemeId?: ThemeId;
  /** The tenant's default mode for viewers who have not chosen one. */
  readonly tenantDefaultMode?: ModePreference;
  readonly children: ReactNode;
}

export function ThemeProvider({ tenantThemeId, tenantDefaultMode, children }: ThemeProviderProps): ReactNode {
  const stored = useSyncExternalStore(subscribeStored, () => readStored() ?? sessionPreference, serverSnapshot);
  const systemMode = useSyncExternalStore(subscribeSystemMode, readSystemMode, serverSystemMode);
  const preference = useMemo(() => parsePreference(stored), [stored]);
  const { themeId, mode } = resolvePreference(preference, tenantThemeId, tenantDefaultMode);
  const resolvedMode: ThemeMode = mode === 'system' ? systemMode : mode;
  // During hydration the snapshots are the server defaults; the inline script already applied the stored values, so
  // <html> is only written once the client snapshot is in (the immediate post-hydration render).
  const hydrated = useSyncExternalStore(subscribeNothing, isClient, isServer);

  useLayoutEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.setAttribute('data-theme', themeId);
    root.setAttribute('data-mode', mode);
  }, [hydrated, themeId, mode]);

  const setThemeId = useCallback(
    (next: ThemeId) => writeStored(serializePreference({ ...parsePreference(readStored() ?? sessionPreference), themeId: next })),
    [],
  );
  const setMode = useCallback(
    (next: ModePreference) => writeStored(serializePreference({ ...parsePreference(readStored() ?? sessionPreference), mode: next })),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ themeId, mode, resolvedMode, setThemeId, setMode }),
    [themeId, mode, resolvedMode, setThemeId, setMode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
