/**
 * @nucleus/design-tokens — typed source of truth for every design token (web now, React Native later).
 *
 * Components consume semantic tokens only (`--color-surface`, `--color-text-primary`, `--color-accent-default`, …);
 * the raw OKLCH values live here and are generated into dist/tokens.css, dist/themes.json and dist/index.js by
 * scripts/build.mjs. Never copy a value out of this file into a component.
 */
export {
  APPROVED_THEME_IDS,
  COLOR_TOKEN_NAMES,
  DEFAULT_MODE_PREFERENCE,
  DEFAULT_THEME_ID,
  MODE_PREFERENCES,
  THEME_IDS,
  THEME_MODES,
  THEME_SPECS,
  deriveColors,
  resolveThemes,
} from './themes.ts';
export type { ColorSet, ColorTokenName, ModePreference, ResolvedTheme, ThemeId, ThemeMode, ThemeSpec } from './themes.ts';
export {
  BREAKPOINT,
  CONTROL,
  DURATION,
  EASING,
  FONT_FAMILY,
  FONT_SIZE,
  FONT_SIZE_PX,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  LINE_HEIGHT,
  RADIUS,
  SHADOW,
  SPACE,
  Z_INDEX,
} from './scales.ts';
export { CONTRAST_RULES, evaluateContrast } from './contrast.ts';
export type { ContrastResult, ContrastRule } from './contrast.ts';
export { contrastRatio, fromHex, oklch, toCss, toGamut, toHex } from './color.ts';
export type { Oklch } from './color.ts';
