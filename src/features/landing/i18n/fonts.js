/**
 * =============================================================================
 * Company     : MKraft Capability Solutions LLP
 * Copyright   : Copyright (c) 2026 MKraft Capability Solutions LLP
 * Author      : Dhanraj Dadhich
 * Reviewed By : Dhanraj Dadhich
 * Description : Landing fonts per locale: the shared per-script text font (src/i18n/locale-fonts.ts, driven by the
 *               locale registry) plus the marketing display serif for scripts Fraunces does not cover (Arabic, Bengali,
 *               Japanese, Chinese, Cyrillic) and the full Fraunces for latin-ext / Vietnamese. Self-hosted @fontsource,
 *               unicode-range sliced, loaded only when needed.
 * =============================================================================
 */
import { loadLocaleFonts as loadScriptFonts } from '@/i18n/locale-fonts';

/** Locale → display-face module loader (marketing headings only). */
export const DISPLAY_FONT_LOADERS = {
  zh: /** Chinese (Simplified).
   * @returns {Promise<object>} Module.
   */ () => import('./fonts/zh.js'),
  ja: /** Japanese.
   * @returns {Promise<object>} Module.
   */ () => import('./fonts/ja.js'),
  ar: /** Arabic.
   * @returns {Promise<object>} Module.
   */ () => import('./fonts/ar.js'),
  bn: /** Bengali.
   * @returns {Promise<object>} Module.
   */ () => import('./fonts/bn.js'),
  ru: /** Russian (Cyrillic display serif).
   * @returns {Promise<object>} Module.
   */ () => import('./fonts/ru.js'),
  tr: /** Turkish (Fraunces latin-ext).
   * @returns {Promise<object>} Module.
   */ () => import('./fonts/latin-extended.js'),
  vi: /** Vietnamese (Fraunces Vietnamese + latin-ext).
   * @returns {Promise<object>} Module.
   */ () => import('./fonts/latin-extended.js'),
};

const loading = {};

/** Load the display face a locale needs (once; later calls reuse the promise).
 * @param {string} code - Locale code.
 * @returns {Promise<void>} Resolves when the stylesheet is in.
 */
function loadDisplayFonts(code) {
  const load = DISPLAY_FONT_LOADERS[code];
  if (!load) return Promise.resolve();
  loading[code] ||= load().then(/** Done.
   * @returns {void} Nothing.
   */ () => undefined, /** A failed font load must never break the page (fallback fonts remain).
   * @returns {void} Nothing.
   */ () => { delete loading[code]; });
  return loading[code];
}

/** Load every font a locale needs on the landing page: script text face + display face.
 * @param {string} code - Locale code.
 * @returns {Promise<void>} Resolves when the stylesheets are in (font files then load on demand).
 */
export function loadLocaleFonts(code) {
  return Promise.all([loadScriptFonts(code), loadDisplayFonts(code)]).then(/** Settle.
   * @returns {void} Nothing.
   */ () => undefined);
}
