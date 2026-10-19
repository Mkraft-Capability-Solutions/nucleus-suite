/**
 * =============================================================================
 * Company     : MKraft Capability Solutions LLP
 * Copyright   : Copyright (c) 2026 MKraft Capability Solutions LLP
 * Author      : Dhanraj Dadhich
 * Reviewed By : Dhanraj Dadhich
 * Description : Catalog registry: one catalog per namespace (a page, the shell, a widget) with its English messages
 *               inline and one lazily imported module per other language (code-split, so a visitor downloads only the
 *               active language). Loading is cached per namespace + locale; a failed load falls back to English.
 * =============================================================================
 */
import { DEFAULT_LOCALE, findLocale } from './locales.js';
import { flattenCatalog, formatMessage } from './format.js';

/** Every catalog defined so far (namespace → catalog), in definition order. */
const registry = new Map();

/** Whether development warnings are on (Vite dev / vitest, never production builds).
 * @returns {boolean} Dev mode.
 */
function devMode() {
  try { return Boolean((process.env.NODE_ENV !== 'production')); } catch { return false; }
}

/** Define a namespace catalog. Call it once per i18n folder (its index.js) with the English module and an
 * import.meta.glob of the sibling language modules; the glob keeps each language in its own chunk.
 * @param {string} namespace - Unique namespace (e.g. 'home', 'chrome', 'about').
 * @param {object} en - English messages (nested object of strings; the source of truth).
 * @param {Record<string, Function>} [loaders] - Locale loaders keyed by file ('./fr.js') or by code ('fr') → () => import('./fr.js').
 * @returns {{namespace: string, en: Record<string,string>, loaders: Record<string, Function>, entries: object}} Catalog.
 */
export function defineCatalog(namespace, en, loaders = {}) {
  const byCode = {};
  for (const [file, load] of Object.entries(loaders)) {
    const code = /([\w-]+?)(?:\.(?:js|ts))?$/.exec(file)?.[1];
    if (code && code !== DEFAULT_LOCALE && findLocale(code)) byCode[code] = load;
  }
  const catalog = { namespace, en: flattenCatalog(en), loaders: byCode, entries: {} };
  registry.set(namespace, catalog);
  return catalog;
}

/** Every registered catalog.
 * @returns {object[]} Catalogs.
 */
export function catalogs() {
  return [...registry.values()];
}

/** Start (or reuse) loading one language of a catalog.
 * @param {object} catalog - Catalog from defineCatalog.
 * @param {string} code - Locale code.
 * @returns {{status: 'pending'|'done'|'error', promise: Promise<void>, messages: Record<string,string>|null}} Load entry.
 */
export function loadCatalog(catalog, code) {
  if (code === DEFAULT_LOCALE) return { status: 'done', promise: Promise.resolve(), messages: catalog.en };
  const existing = catalog.entries[code];
  if (existing) return existing;
  const load = catalog.loaders[code];
  const entry = { status: 'pending', promise: null, messages: null };
  catalog.entries[code] = entry;
  if (!load) {
    entry.status = 'error';
    entry.promise = Promise.resolve();
    if (devMode()) console.warn(`[i18n] ${catalog.namespace}: no "${code}" catalog; showing English.`);
    return entry;
  }
  entry.promise = load().then(/** Store the messages.
   * @param {{default: object}} module - Language module.
   * @returns {void} Marks the entry done.
   */ (module) => { entry.messages = flattenCatalog(module.default); entry.status = 'done'; }, /** Fall back to English.
   * @param {Error} error - Load failure (offline, stale deploy).
   * @returns {void} Marks the entry failed.
   */ (error) => { entry.status = 'error'; if (devMode()) console.warn(`[i18n] ${catalog.namespace}/${code} failed to load`, error); });
  return entry;
}

/** Load one language of every catalog registered so far (before switching language, so nothing suspends).
 * @param {string} code - Locale code.
 * @returns {Promise<void>} Resolves when all are loaded (or failed over to English).
 */
export function preloadLocale(code) {
  return Promise.all(catalogs().map(/** Load one.
   * @param {object} catalog - Catalog.
   * @returns {Promise<void>} Load promise.
   */ (catalog) => loadCatalog(catalog, code).promise)).then(/** Settle.
   * @returns {void} Nothing.
   */ () => undefined);
}

const warned = new Set();

/** Look up one message: the active language, then English, then the key itself (with a dev warning).
 * @param {object} catalog - Catalog.
 * @param {Record<string,string>|null} messages - Active-language messages (null = English only).
 * @param {string} key - Dot key.
 * @param {string} code - Locale code (for the warning).
 * @returns {string} Message.
 */
export function lookup(catalog, messages, key, code) {
  const own = messages?.[key];
  if (typeof own === 'string') return own;
  const english = catalog.en[key];
  if (devMode() && !warned.has(`${catalog.namespace}:${code}:${key}`)) {
    warned.add(`${catalog.namespace}:${code}:${key}`);
    if (typeof english !== 'string') console.warn(`[i18n] ${catalog.namespace}: unknown key "${key}".`);
    else if (messages && code !== DEFAULT_LOCALE) console.warn(`[i18n] ${catalog.namespace}/${code}: missing "${key}", showing English.`);
  }
  return typeof english === 'string' ? english : key;
}

/** A plain-string translator for module scope or tests (no React, no suspension): English, or an already loaded language.
 * @param {object} catalog - Catalog.
 * @param {string} [code] - Locale code (default English).
 * @returns {(key: string, values?: object) => string} t(key, values) → string.
 */
export function staticT(catalog, code = DEFAULT_LOCALE) {
  const messages = code === DEFAULT_LOCALE ? null : catalog.entries[code]?.messages || null;
  return (/** Translate.
   * @param {string} key - Dot key.
   * @param {object} [values] - Placeholder values.
   * @returns {string} Text.
   */ (key, values) => formatMessage(lookup(catalog, messages, key, code), values, code));
}
