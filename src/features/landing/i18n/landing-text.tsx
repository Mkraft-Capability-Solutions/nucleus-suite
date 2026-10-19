/**
 * Typed access to the "nucleus" catalog for the landing page (server-safe, no hooks). Keys are checked at compile time
 * against the English source (src/i18n/catalogs/nucleus/en.js). Server components render English (the landing route
 * is English-only today); client islands use useLandingText(), which follows the LocaleProvider.
 */
import { Fragment, type ReactNode } from 'react';
import type { MessageKey, MessageValues } from '@/i18n/catalog';
import nucleus from '@/i18n/catalogs/nucleus/index.js';
import type en from '@/i18n/catalogs/nucleus/en.js';
import { DEFAULT_LOCALE } from './locales.js';
import { lookup } from './catalog.js';
import { formatMessage, formatRich } from './format.js';

export type LandingKey = MessageKey<typeof en>;

/** Renders one rich tag: (children, react key) → node. */
export type TagRenderer = (children: ReactNode, key: string) => ReactNode;

export interface LandingText {
  (key: LandingKey, values?: MessageValues): string;
  /** Message with <tag> runs rendered through `tags` (unknown tags render their children). */
  rich: (key: LandingKey, tags: Readonly<Record<string, TagRenderer>>, values?: MessageValues) => ReactNode;
  /** The unformatted message (rich tags kept), e.g. for SplitHeading. */
  raw: (key: LandingKey) => string;
  readonly locale: string;
}

/** Wrap an untyped engine translator (JS) in the typed interface. */
export function typedText(locale: string, raw: (key: string) => string): LandingText {
  const t = (key: LandingKey, values?: MessageValues): string => formatMessage(raw(key), values ?? {}, locale);
  const rich = (key: LandingKey, tags: Readonly<Record<string, TagRenderer>>, values?: MessageValues): ReactNode => {
    const render = (name: string, children: ReactNode, key: string): ReactNode => {
      const renderer = tags[name];
      return renderer ? renderer(children, key) : <Fragment key={key}>{children}</Fragment>;
    };
    const parts: ReactNode[] = formatRich(raw(key), values ?? {}, render, locale);
    return parts;
  };
  return Object.assign(t, { rich, raw: (key: LandingKey): string => raw(key), locale });
}

/** English landing text for server components. */
export function landingText(): LandingText {
  return typedText(DEFAULT_LOCALE, (key) => lookup(nucleus, null, key, DEFAULT_LOCALE));
}
