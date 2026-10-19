import { createContext } from 'react';
import type { ModePreference, ThemeId, ThemeMode } from '@nucleus/design-tokens';

export interface ThemeContextValue {
  /** Effective theme id. */
  readonly themeId: ThemeId;
  /** The viewer's mode preference (light | dark | system). */
  readonly mode: ModePreference;
  /** The mode actually rendered (system resolved through prefers-color-scheme). */
  readonly resolvedMode: ThemeMode;
  readonly setThemeId: (themeId: ThemeId) => void;
  readonly setMode: (mode: ModePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
