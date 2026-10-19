/**
 * Typed entry point to the i18n catalog engine for TypeScript code. The engine itself (catalog registry, ICU-style
 * formatter, English fallback, lazy per-locale chunks) is the JavaScript module ported with the landing page; it moves
 * under src/i18n/ in the restructure pass. This file only adds compile-time types: message keys are checked against
 * the English catalog, and every locale file must match the English shape.
 *
 * Layout: src/i18n/catalogs/<namespace>/<locale>.ts (en.ts is the source of truth) + index.ts that defines the
 * catalog with one lazy loader per translated locale. Server-safe (no React).
 */
import { defineCatalog as defineCatalogEngine, staticT as staticTEngine } from '@/features/landing/i18n/catalog.js';
import { DEFAULT_LOCALE, LOCALE_CODES, type LocaleCode } from './locales';

/** A message tree with every leaf widened to string (the shape every translation must match). */
export type MessageTree<T> = { readonly [K in keyof T]: T[K] extends string ? string : MessageTree<T[K]> };

/** Dot-joined keys of every leaf message, e.g. "switcher.title". */
export type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`;
}[keyof T & string];

/** Placeholder values for {name} / plural / select arguments. */
export type MessageValues = Readonly<Record<string, string | number>>;

export type Translate<T> = (key: MessageKey<T>, values?: MessageValues) => string;

type Loader<T> = () => Promise<{ readonly default: MessageTree<T> }>;

/** A catalog whose keys are known at compile time. `Messages` is a phantom type parameter. */
export interface Catalog<Messages extends object> {
  readonly namespace: string;
  readonly engine: ReturnType<typeof defineCatalogEngine>;
  /** Never set at runtime; carries the message type. */
  readonly messages?: Messages;
}

/** Define a namespace catalog: English inline, every other locale a lazily loaded chunk keyed by locale code. */
export function defineCatalog<Messages extends object>(
  namespace: string,
  english: Messages,
  loaders: Readonly<Partial<Record<Exclude<LocaleCode, typeof DEFAULT_LOCALE>, Loader<Messages>>>>,
): Catalog<Messages> {
  const byCode: Record<string, Loader<Messages>> = {};
  for (const code of LOCALE_CODES) {
    if (code === DEFAULT_LOCALE) continue;
    const load = loaders[code];
    if (load) byCode[code] = load;
  }
  return { namespace, engine: defineCatalogEngine(namespace, english, byCode) };
}

/** Plain-string translator without React (server components, metadata): English, or an already loaded locale. */
export function staticT<Messages extends object>(catalog: Catalog<Messages>, locale: LocaleCode = DEFAULT_LOCALE): Translate<Messages> {
  const translate = staticTEngine(catalog.engine, locale);
  return (key, values) => translate(key, values);
}
