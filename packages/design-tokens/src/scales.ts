/**
 * Theme-independent scales: spacing, radii, typography, elevation, z-index, motion, breakpoints and layout.
 * Values are typed so React Native can consume the same numbers (px / ms) that the web gets as CSS.
 */

/** 4px base grid. Key = step, value = px. */
export const SPACE = {
  '0': 0,
  '0-5': 2,
  '1': 4,
  '1-5': 6,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
  '24': 96,
  '32': 128,
} as const;

/** Corner radii in px (`full` = pill). */
export const RADIUS = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  full: 9999,
} as const;

/**
 * Font families. Fonts are fixed product-wide (tenants choose a theme and a logo, never fonts): one tested stack keeps
 * every screen legible, keeps the WCAG checks valid and guarantees glyph coverage for every supported script.
 * The web app supplies the faces through custom properties set on <html>:
 *   --font-ui-face       preloaded Inter Latin subset + metric-matched fallback (next/font), or full Inter per locale
 *   --font-display-face  preloaded Fraunces Latin subset (marketing pages only)
 *   --font-script        the script face of the active locale (from the locale registry)
 * React Native maps the same roles to its bundled fonts.
 */
export const FONT_FAMILY = {
  sans: 'var(--font-ui-face, "Inter Variable"), var(--font-script, "Inter Variable"), system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif',
  display: 'var(--font-display-face, "Fraunces Variable"), var(--font-script, "Fraunces Variable"), "Iowan Old Style", "Palatino Linotype", Georgia, serif',
  mono: '"JetBrains Mono Variable", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  /** System monospace for decorative code-like labels on marketing pages (no web-font download). */
  code: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
} as const;

/**
 * UI type scale (rem, 16px root). A 1.125 (major second) ratio near the body size keeps dense data screens calm;
 * display sizes are fluid (clamp) and only for marketing and page heroes.
 */
export const FONT_SIZE = {
  '2xs': '0.6875rem',
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  'display-sm': 'clamp(1.875rem, 1.45rem + 1.8vw, 2.5rem)',
  'display-md': 'clamp(2.25rem, 1.6rem + 2.8vw, 3.5rem)',
  'display-lg': 'clamp(2.75rem, 1.8rem + 4.2vw, 4.75rem)',
  /** Marketing hero headline (Horizon landing). */
  'display-hero': 'clamp(3.375rem, 5.8vw, 5.25rem)',
  /** Marketing section headline (Horizon landing). */
  'display-section': 'clamp(2.5rem, 4.2vw, 3.75rem)',
  /** Marketing lead paragraph. */
  lead: '1.1875rem',
} as const;

/** Pixel equivalents for React Native (display sizes use their maximum). */
export const FONT_SIZE_PX = {
  '2xs': 11,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  'display-sm': 40,
  'display-md': 56,
  'display-lg': 76,
  'display-hero': 84,
  'display-section': 60,
  lead: 19,
} as const;

export const FONT_WEIGHT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  /** Fraunces display weight (marketing headlines). */
  display: 420,
  /** Fraunces italic display weight (gradient emphasis words). */
  'display-emphasis': 380,
} as const;

export const LINE_HEIGHT = {
  display: 0.98,
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.65,
} as const;

export const LETTER_SPACING = {
  display: '-0.032em',
  'display-section': '-0.028em',
  tighter: '-0.03em',
  tight: '-0.015em',
  normal: '0em',
  wide: '0.02em',
  caps: '0.08em',
} as const;

/** Elevation: layered shadows built on the theme's shadow colour (stronger in dark mode). */
export const SHADOW = {
  xs: '0 1px 2px 0 var(--color-shadow)',
  sm: '0 1px 2px 0 var(--color-shadow), 0 1px 3px 0 var(--color-shadow)',
  md: '0 2px 4px -1px var(--color-shadow), 0 4px 8px -2px var(--color-shadow)',
  lg: '0 4px 6px -2px var(--color-shadow), 0 12px 20px -4px var(--color-shadow)',
  xl: '0 8px 12px -4px var(--color-shadow), 0 24px 40px -8px var(--color-shadow)',
} as const;

/** Stacking order. Never use raw z-index numbers in components. */
export const Z_INDEX = {
  base: 0,
  raised: 10,
  dropdown: 1000,
  sticky: 1100,
  header: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  toast: 1600,
  tooltip: 1700,
} as const;

/** Durations in ms. UI feedback 150–300 ms; `slower` only for marketing transitions. */
export const DURATION = {
  instant: 0,
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 500,
} as const;

export const EASING = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0, 1)',
  exit: 'cubic-bezier(0.3, 0, 1, 1)',
  emphasized: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  /** Quartic ease-out, 1 − (1 − t)⁴: the landing motion engine's shared curve (≈ cubic-bezier(.22, 1, .36, 1)). */
  'out-quart': 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

/** Min-width breakpoints in px (mobile first). CSS media queries cannot read custom properties: use these numbers. */
export const BREAKPOINT = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/** Layout: fluid full-width pages with responsive inline gutters; only long-form text caps its measure. */
export const LAYOUT = {
  gutter: 'clamp(1rem, 0.5rem + 2.5vw, 3rem)',
  'section-gap': 'clamp(3rem, 2rem + 4vw, 6rem)',
  measure: '72ch',
  'header-height': '4rem',
  /** Marketing grid (Horizon landing): 12 columns, 24px gutter, 1536px container, ≥ 40px side margin. */
  container: '1536px',
  columns: '12',
  'grid-gutter': '24px',
  'page-margin': 'max(40px, calc((100vw - 1536px) / 2))',
  'section-padding': '128px',
} as const;

/** Control sizes in px (44 = minimum touch target, WCAG 2.5.8 recommends ≥24, we use 44 on touch). */
export const CONTROL = {
  'height-sm': 32,
  'height-md': 40,
  'height-lg': 48,
  'touch-target': 44,
  'focus-ring-width': 2,
  'focus-ring-offset': 2,
} as const;
