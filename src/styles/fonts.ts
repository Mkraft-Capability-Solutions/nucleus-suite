/**
 * Preloaded faces (self-hosted from @fontsource, no runtime Google Fonts calls). Only the Latin subset of each is
 * preloaded; `display: swap` plus next/font's metric-matched fallback (size-adjust, ascent/descent overrides) keeps
 * the swap free of layout shift. Other subsets and every script font load per locale (src/i18n/locale-fonts.ts).
 *
 * The faces are exposed as custom properties that the design tokens read (--font-sans / --font-display):
 *   uiFont       → --font-ui-face       (root layout, every route)
 *   displayFont  → --font-display-face  (marketing routes only, so its preload is scoped to them)
 */
import localFont from 'next/font/local';

/*
 * next/font requires every option to be a literal, so the Latin unicode-range (the fontsource "latin" slice:
 * Basic Latin + Latin-1 + common punctuation) is written out in both declarations below.
 */

export const uiFont = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  preload: true,
  variable: '--font-ui-face',
  adjustFontFallback: 'Arial',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});

/*
 * Fraunces upright (variable, Latin) plus the italic used only for gradient emphasis words. The italic is a static
 * instance at weight 380 (--font-weight-display-emphasis), subset to printable ASCII and common Latin punctuation, so it
 * costs 15 KB instead of 46 KB and the English first load stays inside the 120 KB font budget. Regenerate it with
 * fontTools from @fontsource-variable/fraunces fraunces-latin-wght-italic.woff2:
 *   instancer.instantiateVariableFont(font, {"wght": 380}) → Subsetter(U+0020–007E, U+00A0, U+00B7, U+2013/2014,
 *   U+2018/2019, U+201C/201D, U+2026, é è ä ö ü) → woff2.
 */
export const displayFont = localFont({
  src: [
    { path: '../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/fraunces-italic-380-latin.woff2', weight: '380', style: 'italic' },
  ],
  display: 'swap',
  preload: true,
  variable: '--font-display-face',
  adjustFontFallback: 'Times New Roman',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});
