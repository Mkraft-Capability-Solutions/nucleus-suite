'use client';

/**
 * =============================================================================
 * Company     : MKraft Capability Solutions LLP
 * Copyright   : Copyright (c) 2026 MKraft Capability Solutions LLP
 * Author      : Dhanraj Dadhich
 * Reviewed By : Dhanraj Dadhich
 * Description : Locale context for the public site: the active locale (from the URL prefix), <html lang/dir>, hreflang
 *               alternates + canonical + og:locale, per-script fonts, and the hooks every component uses: useLocale,
 *               useT (suspends until the namespace's language chunk is loaded), <T>, useLocalizedPath, LocalizedLink and
 *               useSwitchLocale. Outside a provider everything falls back to English synchronously (unit tests).
 * =============================================================================
 */
import React, { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from '@/shims/router';
import { DEFAULT_LOCALE, LOCALES, LOCALE_KEY, SITE_ORIGIN, findLocale, localeFontProperties, localizePath, splitLocalePath } from './locales.js';
import { formatMessage, formatRich, setActiveLocale } from './format.js';
import { loadCatalog, lookup, preloadLocale } from './catalog.js';
import { loadLocaleFonts } from './fonts.js';

const LocaleContext = createContext(null);
/** Font custom properties a locale may set on <html> (see localeFontProperties in the locale registry). */
const FONT_PROPERTIES = ['--font-script', '--font-ui-face'];
const ENGLISH = findLocale(DEFAULT_LOCALE);

/** Tags every rich message may use without passing components. */
const DEFAULT_TAGS = {
  em: /** Emphasis.
   * @param {React.ReactNode} children - Content.
   * @param {string} key - React key.
   * @returns {JSX.Element} Element.
   */ (children, key) => <em key={key}>{children}</em>,
  strong: /** Strong.
   * @param {React.ReactNode} children - Content.
   * @param {string} key - React key.
   * @returns {JSX.Element} Element.
   */ (children, key) => <strong key={key}>{children}</strong>,
  br: /** Line break.
   * @param {React.ReactNode} _children - Unused.
   * @param {string} key - React key.
   * @returns {JSX.Element} Element.
   */ (_children, key) => <br key={key} />,
};

/** Set or create a <link>/<meta> in <head>.
 * @param {string} selector - CSS selector of the element.
 * @param {string} tag - 'link' | 'meta'.
 * @param {Record<string,string>} attributes - Attributes to set.
 * @returns {HTMLElement} Element.
 */
function headElement(selector, tag, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement(tag);
    element.setAttribute('data-mk-i18n', '');
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

/** Provide the active locale to the public site and keep <html> and <head> in sync with it.
 * @param {{locale: string, path?: string, children: React.ReactNode}} props - Locale code from the URL, the locale-free route path (for hreflang/canonical) and the subtree.
 * @returns {JSX.Element} Provider.
 */
export function LocaleProvider({ locale, path = '/', children }) {
  const info = findLocale(locale) || ENGLISH;
  setActiveLocale(info.code);

  useEffect(/** Mirror the locale on <html> (lang, dir) and load the script fonts it needs.
   * @returns {Function} Cleanup restoring English when leaving the public site.
   */ () => {
    const root = document.documentElement;
    root.lang = info.tag;
    root.dir = info.dir;
    root.dataset.locale = info.code;
    const fonts = localeFontProperties(info.code);
    for (const property of FONT_PROPERTIES) {
      if (fonts[property]) root.style.setProperty(property, fonts[property]);
      else root.style.removeProperty(property);
    }
    loadLocaleFonts(info.code);
    return (/** Restore the English defaults (e.g. when the workspace takes over).
     * @returns {void} Resets.
     */ () => { root.lang = ENGLISH.tag; root.dir = ENGLISH.dir; FONT_PROPERTIES.forEach(/** Remove one font property.
       * @param {string} property - Custom property.
       * @returns {void} Removes it.
       */ (property) => root.style.removeProperty(property)); delete root.dataset.locale; });
  }, [info]);

  useEffect(/** hreflang alternates for every locale + x-default, the canonical URL and og:locale for this route.
   * @returns {Function} Cleanup removing the managed tags.
   */ () => {
    const clean = path.replace(/\/+$/, '') || '/';
    const managed = LOCALES.map(/** One alternate.
     * @param {{code: string, tag: string}} item - Locale.
     * @returns {HTMLElement} Link.
     */ (item) => headElement(`link[rel="alternate"][hreflang="${item.tag}"]`, 'link', { rel: 'alternate', hreflang: item.tag, href: SITE_ORIGIN + localizePath(clean, item.code) }));
    managed.push(headElement('link[rel="alternate"][hreflang="x-default"]', 'link', { rel: 'alternate', hreflang: 'x-default', href: SITE_ORIGIN + clean }));
    managed.push(headElement('link[rel="canonical"]', 'link', { rel: 'canonical', href: SITE_ORIGIN + localizePath(clean, info.code) }));
    managed.push(headElement('meta[property="og:locale"]', 'meta', { property: 'og:locale', content: info.og }));
    managed.push(headElement('meta[property="og:url"]', 'meta', { property: 'og:url', content: SITE_ORIGIN + localizePath(clean, info.code) }));
    return (/** Remove what this provider created.
     * @returns {void} Cleans up.
     */ () => managed.forEach(/** Remove one managed element.
       * @param {HTMLElement} element - Element.
       * @returns {void} Removes it when this provider created it.
       */ (element) => { if (element.hasAttribute('data-mk-i18n')) element.remove(); }));
  }, [info, path]);

  const value = useMemo(/** Context value.
   * @returns {object} Locale API.
   */ () => ({ locale: info.code, tag: info.tag, dir: info.dir, info, path }), [info, path]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** The active locale (English outside a provider).
 * @returns {{locale: string, tag: string, dir: 'ltr'|'rtl', info: object, path: string}} Locale state.
 */
export function useLocale() {
  return useContext(LocaleContext) || { locale: ENGLISH.code, tag: ENGLISH.tag, dir: 'ltr', info: ENGLISH, path: '/' };
}

/** Render one rich part's tag through the component map.
 * @param {Record<string, Function|React.ReactElement>} components - Tag renderers (function(children, key)) or elements to clone.
 * @returns {Function} renderTag(name, children, key).
 */
function tagRenderer(components) {
  /** Render a tag.
   * @param {string} name - Tag name.
   * @param {Array<any>} children - Rendered children.
   * @param {string} key - React key.
   * @returns {React.ReactNode} Node.
   */
  return function renderTag(name, children, key) {
    const component = components?.[name] ?? DEFAULT_TAGS[name];
    if (typeof component === 'function') return component(children, key);
    if (isValidElement(component)) return cloneElement(component, { key }, ...children);
    return <React.Fragment key={key}>{children}</React.Fragment>;
  };
}

/** Translator for one catalog in the active locale. Suspends (throws the cached load promise to the nearest <Suspense>)
 * while the language chunk loads; English is
 * inline and never suspends. t(key, values) → string; t.rich(key, values, components) → React nodes for <tag>s;
 * t.locale is the active code.
 * @param {object} catalog - Catalog from defineCatalog.
 * @returns {((key: string, values?: object) => string) & {rich: Function, raw: (key: string) => string, locale: string}} Translator.
 */
export function useT(catalog) {
  const { locale } = useLocale();
  let messages = null;
  if (locale !== DEFAULT_LOCALE) {
    const entry = loadCatalog(catalog, locale);
    // A thrown, cached thenable is the Suspense protocol React.lazy uses; React re-renders once it settles.
    if (entry.status === 'pending') throw entry.promise;
    messages = entry.messages;
  }
  return useMemo(/** Build the translator for this catalog + locale.
   * @returns {Function} t.
   */ () => {
    /** Translate a key to plain text.
     * @param {string} key - Dot key.
     * @param {object} [values] - Placeholder values.
     * @returns {string} Text.
     */
    return Object.assign(
      /** Translate a key to plain text.
       * @param {string} key - Dot key.
       * @param {object} [values] - Placeholder values.
       * @returns {string} Text.
       */
      (key, values) => formatMessage(lookup(catalog, messages, key, locale), values, locale),
      {
        /** Translate a key keeping its rich tags as React elements.
         * @param {string} key - Dot key.
         * @param {object} [values] - Placeholder values (may be React nodes).
         * @param {Record<string, Function|React.ReactElement>} [components] - Tag renderers (em/strong/br are built in).
         * @returns {React.ReactNode[]} Nodes.
         */
        rich: (key, values, components) => formatRich(lookup(catalog, messages, key, locale), values || {}, tagRenderer(components), locale),
        /** The unformatted message (e.g. to hand "*emphasis*" text to SplitText).
         * @param {string} key - Dot key.
         * @returns {string} Message.
         */
        raw: (key) => lookup(catalog, messages, key, locale),
        locale,
      },
    );
  }, [catalog, messages, locale]);
}

/** Declarative translation: <T catalog={home} k="hero.lead" values={{…}} components={{…}} />.
 * @param {{catalog: object, k: string, values?: object, components?: object}} props - Catalog, key, placeholder values and tag renderers.
 * @returns {JSX.Element} Translated content.
 */
export function T({ catalog, k, values, components }) {
  const t = useT(catalog);
  return <>{t.rich(k, values, components)}</>;
}

/** A function that localizes internal hrefs for the active locale ("/about" → "/es/about").
 * @returns {Function} (href) → localized href.
 */
export function useLocalizedPath() {
  const { locale } = useLocale();
  return useCallback(/** Localize.
   * @param {string} href - Internal href.
   * @returns {string} Localized href.
   */ (href) => localizePath(href, locale), [locale]);
}

/** navigate() that keeps the active locale.
 * @returns {Function} (to, options) → void.
 */
export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const localize = useLocalizedPath();
  return useCallback(/** Navigate within the locale.
   * @param {string|number} to - Path or history delta.
   * @param {object} [options] - Router options.
   * @returns {void} Navigates.
   */ (to, options) => (typeof to === 'string' ? navigate(localize(to), options) : navigate(to, options)), [navigate, localize]);
}

/** Drop-in replacement for react-router's <Link> that keeps the active locale.
 * @param {{to: string|object}} props - Link props (a string `to` or a {pathname} object).
 * @returns {JSX.Element} Link.
 */
export function LocalizedLink({ to, ...rest }) {
  const localize = useLocalizedPath();
  const target = typeof to === 'string' ? localize(to) : to && typeof to === 'object' && to.pathname ? { ...to, pathname: localize(to.pathname) } : to;
  return <Link to={target} {...rest} />;
}

/** Switch the site language: remembers the explicit choice, loads the new language first (no flash of the old one)
 * and moves to the same page in that language.
 * @returns {Function} (code) → Promise<void>.
 */
export function useSwitchLocale() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(/** Switch.
   * @param {string} code - Locale code.
   * @returns {Promise<void>} Resolves after navigating.
   */ async (code) => {
    if (!findLocale(code)) return;
    try { window.localStorage.setItem(LOCALE_KEY, code); } catch { /* storage unavailable: session-only choice */ }
    await Promise.all([preloadLocale(code), loadLocaleFonts(code)]);
    const { path } = splitLocalePath(location.pathname);
    navigate(localizePath(path, code) + location.search + location.hash, { state: { mkLocale: code } });
  }, [navigate, location]);
}
